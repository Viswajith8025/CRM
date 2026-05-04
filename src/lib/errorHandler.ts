import { toast } from 'sonner'
import { getFriendlySupabaseError } from './supabaseError'

// ─────────────────────────────────────────────────
// Error Classification
// ─────────────────────────────────────────────────

export type ErrorCategory = 'network' | 'auth' | 'validation' | 'permission' | 'not_found' | 'conflict' | 'server' | 'unknown'

export interface AppError {
  category: ErrorCategory
  message: string         // User-friendly message
  technical?: string      // For console/debug logging
  retryable: boolean
  statusCode?: number
}

function classifyError(error: unknown): AppError {
  const raw = getRawMessage(error)
  const lower = raw.toLowerCase()
  const code = getErrorCode(error)

  // Network errors
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('net::err') ||
    lower.includes('econnrefused') ||
    lower.includes('timeout') ||
    error instanceof TypeError && lower.includes('fetch')
  ) {
    return {
      category: 'network',
      message: 'Connection lost. Please check your internet and try again.',
      technical: raw,
      retryable: true,
    }
  }

  // Auth errors
  if (
    lower.includes('jwt expired') ||
    lower.includes('invalid token') ||
    lower.includes('not authenticated') ||
    lower.includes('session expired') ||
    lower.includes('refresh_token') ||
    code === 'PGRST301'
  ) {
    return {
      category: 'auth',
      message: 'Your session has expired. Please sign in again.',
      technical: raw,
      retryable: false,
    }
  }

  // Permission / RLS errors
  if (
    code === '42501' ||
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('rls') ||
    lower.includes('not authorized')
  ) {
    return {
      category: 'permission',
      message: 'You don\'t have permission to perform this action.',
      technical: raw,
      retryable: false,
    }
  }

  // Not found
  if (
    code === 'PGRST116' ||
    lower.includes('not found') ||
    lower.includes('no rows')
  ) {
    return {
      category: 'not_found',
      message: 'The requested record could not be found.',
      technical: raw,
      retryable: false,
    }
  }

  // Conflict / duplicate
  if (code === '23505' || lower.includes('duplicate key') || lower.includes('already exists')) {
    return {
      category: 'conflict',
      message: 'A record with these details already exists.',
      technical: raw,
      retryable: false,
    }
  }

  // Validation errors (missing fields, bad format)
  if (
    code === '23502' || code === '22P02' || code === '23503' ||
    lower.includes('not-null') ||
    lower.includes('invalid input') ||
    lower.includes('foreign key')
  ) {
    return {
      category: 'validation',
      message: getFriendlySupabaseError(error),
      technical: raw,
      retryable: false,
    }
  }

  // Catch-all
  return {
    category: 'unknown',
    message: 'Something went wrong. Please try again.',
    technical: raw,
    retryable: true,
  }
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function getRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String((error as any).message)
  if (typeof error === 'string') return error
  return 'Unknown error'
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error && 'code' in error) return String((error as any).code)
  return undefined
}

// ─────────────────────────────────────────────────
// Core Handler — the single entry point for all errors
// ─────────────────────────────────────────────────

interface HandleErrorOptions {
  /** A human-readable label for what the user was trying to do (e.g. "saving task") */
  context?: string
  /** If true, show a toast notification. Defaults to true. */
  showToast?: boolean
  /** If provided, will render a retry button in the toast */
  onRetry?: () => void
  /** Suppress console logging (e.g. for expected 404s) */
  silent?: boolean
}

export function handleError(error: unknown, options: HandleErrorOptions = {}): AppError {
  const { context, showToast = true, onRetry, silent = false } = options
  const appError = classifyError(error)

  // Console logging for debugging (never expose to user)
  if (!silent) {
    console.error(
      `[ECRAFTZ Error] ${appError.category.toUpperCase()}${context ? ` while ${context}` : ''}:`,
      appError.technical
    )
  }

  // Toast notification
  if (showToast) {
    const toastMessage = context
      ? `Error ${context}: ${appError.message}`
      : appError.message

    if (appError.retryable && onRetry) {
      toast.error(toastMessage, {
        action: {
          label: 'Retry',
          onClick: onRetry,
        },
        duration: 8000,
      })
    } else {
      toast.error(toastMessage, { duration: 5000 })
    }
  }

  // Auto-redirect on auth expiry
  if (appError.category === 'auth') {
    setTimeout(() => {
      window.location.href = '/login'
    }, 2000)
  }

  return appError
}

// ─────────────────────────────────────────────────
// API Call Wrapper — wraps any async operation with
// automatic error handling and optional retry
// ─────────────────────────────────────────────────

interface ApiCallOptions<T> extends HandleErrorOptions {
  /** Maximum retry attempts for retryable errors. Defaults to 0 (no auto-retry). */
  maxRetries?: number
  /** Delay between retries in ms. Defaults to 1000. */
  retryDelay?: number
  /** Value to return on failure instead of throwing */
  fallback?: T
  /** Queue the action if offline instead of failing immediately. Only use for mutations. */
  queueIfOffline?: boolean
}

export async function apiCall<T>(
  fn: () => Promise<T>,
  options: ApiCallOptions<T> = {}
): Promise<T | void> {
  const { maxRetries = 0, retryDelay = 1000, fallback, queueIfOffline = false, ...errorOptions } = options
  let attempt = 0

  // Optional offline queueing logic
  if (queueIfOffline && typeof window !== 'undefined') {
    // Dynamic import to avoid circular dependency issues at boot
    const { useNetworkStore } = await import('@/store/useNetworkStore')
    const { isOnline, enqueueAction } = useNetworkStore.getState()
    
    if (!isOnline) {
      enqueueAction(options.context || 'background action', fn)
      return fallback !== undefined ? fallback : undefined
    }
  }

  while (true) {
    try {
      return await fn()
    } catch (error) {
      attempt++
      const appError = classifyError(error)

      // Auto-retry for retryable errors (network, server)
      if (appError.retryable && attempt <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        continue
      }

      // Final failure
      handleError(error, errorOptions)

      if (fallback !== undefined) {
        return fallback
      }

      throw error
    }
  }
}
