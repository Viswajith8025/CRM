import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError } from '@/lib/supabaseError'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubmitLeaveRequestParams {
  leave_type_id: string
  start_date: string   // YYYY-MM-DD
  end_date: string     // YYYY-MM-DD
  reason: string
  is_emergency?: boolean
}

export interface SubmitLeaveRequestResult {
  success: boolean
  /** The UUID of the newly created leave_requests row (on success) */
  requestId?: string
  /** Human-readable error message (on failure) */
  error?: string
}

// ─── Core RPC Call ────────────────────────────────────────────────────────────

/**
 * Calls the `submit_leave_request` Supabase RPC.
 *
 * Matches the DB function signature:
 *   submit_leave_request(
 *     p_leave_type_id  uuid,
 *     p_start_date     date,
 *     p_end_date       date,
 *     p_reason         text,
 *     p_is_emergency   boolean  DEFAULT false
 *   ) RETURNS uuid
 *
 * The RPC internally:
 *  1. Validates the authenticated user is in the same org as the leave type.
 *  2. Checks leave balance (if applicable).
 *  3. Inserts into leave_requests.
 *  4. Logs to leave_request_actions.
 *  5. Optionally deducts from leave_balances.
 */
export async function submitLeaveRequest(
  params: SubmitLeaveRequestParams
): Promise<SubmitLeaveRequestResult> {
  // ── Client-side guard: require authenticated session ──────────────────────
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { success: false, error: 'You must be logged in to submit a leave request.' }
  }

  // ── Client-side validation ────────────────────────────────────────────────
  if (!params.leave_type_id?.trim()) {
    return { success: false, error: 'Please select a leave type.' }
  }
  if (!params.start_date || !params.end_date) {
    return { success: false, error: 'Please select both a start date and an end date.' }
  }
  if (new Date(params.end_date) < new Date(params.start_date)) {
    return { success: false, error: 'End date cannot be before the start date.' }
  }
  if (!params.reason?.trim() || params.reason.trim().length < 5) {
    return { success: false, error: 'Please provide a reason (at least 5 characters).' }
  }

  // ── RPC Call ──────────────────────────────────────────────────────────────
  try {
    const { data, error } = await supabase.rpc('submit_leave_request', {
      p_leave_type_id: params.leave_type_id,
      p_start_date:    params.start_date,
      p_end_date:      params.end_date,
      p_reason:        params.reason.trim(),
      p_is_emergency:  params.is_emergency ?? false,
    })

    if (error) {
      console.error('[submitLeaveRequest] RPC transport error:', error)
      return {
        success: false,
        error: getFriendlySupabaseError(error, 'Failed to submit leave request. Please try again.'),
      }
    }

    // The RPC returns JSON: { success: boolean, id?: string, error?: string }
    const result = data as { success: boolean; id?: string; error?: string }

    if (!result?.success) {
      const msg = result?.error ?? 'The server rejected the request.'
      console.error('[submitLeaveRequest] RPC logic error:', msg)
      return {
        success: false,
        error: getFriendlySupabaseError({ message: msg }, msg),
      }
    }

    return { success: true, requestId: result.id }
  } catch (err) {
    console.error('[submitLeaveRequest] Unexpected error:', err)
    return {
      success: false,
      error: getFriendlySupabaseError(err, 'An unexpected error occurred. Please try again.'),
    }
  }
}

// ─── Resubmit (Clarification Resolved) ────────────────────────────────────────

export interface ResubmitLeaveRequestParams {
  requestId: string
  actorId: string
  leave_type_id: string
  start_date: string
  end_date: string
  reason: string
  is_emergency: boolean
}

export interface ResubmitLeaveRequestResult {
  success: boolean
  error?: string
}

/**
 * Updates an existing leave_request (status → pending) and logs the resubmission.
 * Used when the employee is responding to a clarification_required status.
 */
export async function resubmitLeaveRequest(
  params: ResubmitLeaveRequestParams
): Promise<ResubmitLeaveRequestResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { success: false, error: 'You must be logged in.' }
  }

  if (new Date(params.end_date) < new Date(params.start_date)) {
    return { success: false, error: 'End date cannot be before the start date.' }
  }
  if (!params.reason?.trim() || params.reason.trim().length < 5) {
    return { success: false, error: 'Please provide a reason (at least 5 characters).' }
  }

  try {
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({
        leave_type_id: params.leave_type_id,
        start_date:    params.start_date,
        end_date:      params.end_date,
        reason:        params.reason.trim(),
        is_emergency:  params.is_emergency,
        status:        'pending',
      })
      .eq('id', params.requestId)

    if (updateError) {
      return {
        success: false,
        error: getFriendlySupabaseError(updateError, 'Failed to update leave request.'),
      }
    }

    // Audit trail
    const { error: actionError } = await supabase
      .from('leave_request_actions')
      .insert({
        leave_request_id: params.requestId,
        actor_id:         params.actorId,
        action:           'resubmit',
        note:             'Employee updated details and resubmitted for approval.',
      })

    if (actionError) {
      // Non-fatal: the update succeeded; log but don't surface this to user
      console.error('[resubmitLeaveRequest] Failed to log audit action:', actionError)
    }

    return { success: true }
  } catch (err) {
    console.error('[resubmitLeaveRequest] Unexpected error:', err)
    return {
      success: false,
      error: getFriendlySupabaseError(err, 'An unexpected error occurred.'),
    }
  }
}
