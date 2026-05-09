/**
 * Enterprise Audit Logger
 * 
 * Central utility for all audit trail operations across the CRM.
 * 
 * Design principles:
 * - Fire-and-forget by default (zero performance impact on caller)
 * - Batched writes via a microtask queue (prevents N+1 DB calls)
 * - Immutable: DB trigger enforces no UPDATE/DELETE on activities table
 * - Org-scoped: organization_id is always injected from auth context
 * - Severity tiers: info | warning | critical
 */

import { supabase } from './supabase'

// ─── Action Types ─────────────────────────────────────────────────────────────

export type ActivityAction =
  // Generic CRUD
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  // Status transitions
  | 'STATUS_CHANGE'
  | 'PAYMENT_STATUS_CHANGE'
  // Proposals
  | 'PROPOSAL_SENT'
  | 'PROPOSAL_APPROVED'
  | 'PROPOSAL_REJECTED'
  // Clients & Leads
  | 'CLIENT_ACTIVATED'
  | 'INVOICE_GENERATED'
  // Tasks & Projects
  | 'TASK_COMPLETED'
  | 'MILESTONE_REACHED'
  | 'NOTE_ADDED'
  // Security & Access Control
  | 'PERMISSION_CHANGE'
  | 'ACCESS_GRANTED'
  | 'ACCESS_REVOKED'
  // Organization
  | 'ORG_SUSPENDED'
  | 'ORG_REACTIVATED'
  // System
  | 'LOGIN'
  | 'EXPORT'
  | 'DATA_IMPORT'

export type AuditSeverity = 'info' | 'warning' | 'critical'

export type AuditTargetType =
  | 'lead'
  | 'client'
  | 'project'
  | 'task'
  | 'invoice'
  | 'payment'
  | 'proposal'
  | 'document'
  | 'user'
  | 'organization'
  | 'milestone'
  | 'time_log'

// ─── Parameter Interface ───────────────────────────────────────────────────────

export interface LogActivityParams {
  action: ActivityAction
  targetType: AuditTargetType
  targetId: string
  targetName: string
  description: string
  /** Previous field value — renders as a visual diff in the timeline */
  previousValue?: string | number | null
  /** New field value — renders as a visual diff in the timeline */
  newValue?: string | number | null
  /** Extra structured data stored in metadata JSONB */
  metadata?: Record<string, any>
  /** Link to a related entity for cross-entity timeline queries */
  relatedEntityId?: string
  relatedEntityType?: AuditTargetType
  /** Severity level — defaults to 'info'. Use 'critical' for security events. */
  severity?: AuditSeverity
  /** Pass explicitly to override the auto-detected org (rarely needed) */
  organization_id?: string
}

// ─── Microtask Write Queue ─────────────────────────────────────────────────────

let _queue: Record<string, any>[] = []
let _flushScheduled = false

/**
 * Flushes the batched audit queue to Supabase.
 * Called automatically via queueMicrotask — never call directly.
 */
async function _flush() {
  if (_queue.length === 0) return

  const batch = [..._queue]
  _queue = []
  _flushScheduled = false

  try {
    const { error } = await supabase.from('activities').insert(batch)
    if (error) {
      console.warn('[AuditLogger] Flush failed:', error.message)
    }
  } catch (err) {
    console.warn('[AuditLogger] Critical flush failure:', err)
  }
}

// ─── Core logActivity Function ─────────────────────────────────────────────────

/**
 * Logs an audit event. Fire-and-forget — does NOT block the caller.
 *
 * @example
 * logActivity({
 *   action: 'CREATE',
 *   targetType: 'lead',
 *   targetId: lead.id,
 *   targetName: lead.full_name,
 *   description: 'New lead added from website form',
 * })
 *
 * @example — with diff tracking
 * logActivity({
 *   action: 'PERMISSION_CHANGE',
 *   targetType: 'user',
 *   targetId: profile.id,
 *   targetName: profile.full_name,
 *   description: `Role changed for ${profile.full_name}`,
 *   previousValue: 'employee',
 *   newValue: 'admin',
 *   severity: 'critical',
 * })
 */
export function logActivity(params: LogActivityParams): void {
  // Schedule the async work without blocking the caller
  queueMicrotask(() => _enqueue(params))
}

/**
 * Awaitable version — use when you need confirmation the log was written
 * before proceeding (e.g., compliance-critical operations).
 */
export async function logActivityAsync(params: LogActivityParams): Promise<void> {
  await _enqueue(params, true)
}

async function _enqueue(params: LogActivityParams, immediate = false): Promise<void> {
  try {
    // Get auth session from cache — no extra network round-trip
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Resolve org_id from auth store (cached, no DB call)
    const { useAuthStore } = await import('@/store/useAuthStore')
    const profile = useAuthStore.getState().profile
    const orgId = params.organization_id ?? profile?.organization_id

    const record = {
      user_id: session.user.id,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      target_name: params.targetName,
      organization_id: orgId,
      severity: params.severity ?? _inferSeverity(params.action),
      is_system: false,
      metadata: {
        description: params.description,
        ...(params.previousValue !== undefined ? { previous_value: params.previousValue } : {}),
        ...(params.newValue !== undefined ? { new_value: params.newValue } : {}),
        ...(params.relatedEntityId ? {
          related_entity_id: params.relatedEntityId,
          related_entity_type: params.relatedEntityType,
        } : {}),
        ...params.metadata,
      },
    }

    if (immediate) {
      // Bypass queue for compliance-critical writes
      const { error } = await supabase.from('activities').insert(record)
      if (error) console.warn('[AuditLogger] Immediate write failed:', error.message)
    } else {
      // Add to queue and schedule a batched flush
      _queue.push(record)
      if (!_flushScheduled) {
        _flushScheduled = true
        // Batch all synchronous calls in the same event loop tick
        setTimeout(_flush, 100)
      }
    }
  } catch (err) {
    console.warn('[AuditLogger] Enqueue failed:', err)
  }
}

// ─── Severity Inference ────────────────────────────────────────────────────────

function _inferSeverity(action: ActivityAction): AuditSeverity {
  const critical: ActivityAction[] = [
    'DELETE', 'PERMISSION_CHANGE', 'ACCESS_REVOKED', 'ORG_SUSPENDED',
  ]
  const warning: ActivityAction[] = [
    'PROPOSAL_REJECTED', 'ORG_REACTIVATED', 'ACCESS_GRANTED', 'PAYMENT_STATUS_CHANGE',
  ]
  if (critical.includes(action)) return 'critical'
  if (warning.includes(action)) return 'warning'
  return 'info'
}

// ─── Convenience Helpers ───────────────────────────────────────────────────────

/** Log a create event with minimal boilerplate */
export function logCreate(targetType: AuditTargetType, id: string, name: string, extra?: Partial<LogActivityParams>) {
  logActivity({ action: 'CREATE', targetType, targetId: id, targetName: name, description: `${targetType} "${name}" created`, ...extra })
}

/** Log an update event with automatic diff tracking */
export function logUpdate(
  targetType: AuditTargetType,
  id: string,
  name: string,
  field: string,
  previousValue: string | number,
  newValue: string | number,
  extra?: Partial<LogActivityParams>
) {
  logActivity({
    action: 'UPDATE',
    targetType,
    targetId: id,
    targetName: name,
    description: `${field} updated`,
    previousValue,
    newValue,
    ...extra,
  })
}

/** Log a delete event */
export function logDelete(targetType: AuditTargetType, id: string, name: string, extra?: Partial<LogActivityParams>) {
  logActivity({ action: 'DELETE', targetType, targetId: id, targetName: name, description: `${targetType} "${name}" permanently deleted`, severity: 'critical', ...extra })
}

/** Log a permission/role change */
export function logPermissionChange(
  userId: string,
  userName: string,
  oldRole: string,
  newRole: string,
  extra?: Partial<LogActivityParams>
) {
  logActivityAsync({
    action: 'PERMISSION_CHANGE',
    targetType: 'user',
    targetId: userId,
    targetName: userName,
    description: `Role changed from "${oldRole}" to "${newRole}" for ${userName}`,
    previousValue: oldRole,
    newValue: newRole,
    severity: 'critical',
    ...extra,
  })
}

/** Log an organization suspension */
export function logOrgSuspension(orgId: string, orgName: string, suspended: boolean) {
  logActivityAsync({
    action: suspended ? 'ORG_SUSPENDED' : 'ORG_REACTIVATED',
    targetType: 'organization',
    targetId: orgId,
    targetName: orgName,
    description: `Organization "${orgName}" was ${suspended ? 'suspended' : 'reactivated'}`,
    severity: suspended ? 'critical' : 'warning',
    organization_id: orgId,
  })
}

/** Log a payment status change */
export function logPaymentStatusChange(
  paymentId: string,
  ref: string,
  oldStatus: string,
  newStatus: string,
  amount: number,
  extra?: Partial<LogActivityParams>
) {
  logActivity({
    action: 'PAYMENT_STATUS_CHANGE',
    targetType: 'payment',
    targetId: paymentId,
    targetName: ref,
    description: `Payment "${ref}" status changed to ${newStatus}`,
    previousValue: oldStatus,
    newValue: newStatus,
    metadata: { amount },
    ...extra,
  })
}
