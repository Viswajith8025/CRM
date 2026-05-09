import { supabase } from './supabase'

export interface LockoutStatus {
  isLocked: boolean
  remainingSeconds: number
  message: string
}

/**
 * Enterprise Rate Limiter Utility
 * 
 * Works in tandem with the 'auth_events' table and 'check_auth_lockout' SQL function.
 */
export const rateLimiter = {
  /**
   * Checks if an email or IP address is currently under lockout.
   */
  async checkLockout(email: string): Promise<LockoutStatus> {
    try {
      // We don't have easy access to client IP in browser-side JS 
      // but Supabase RPC will see the client IP if we use 'p_ip' as optional or let DB handle it.
      // For now we primarily lock by email as it's the primary attack vector.
      const { data, error } = await supabase.rpc('check_auth_lockout', {
        p_email: email,
        p_ip: '' // DB will handle IP if needed or we can pass a placeholder
      })

      if (error) {
        console.error('[RateLimiter] Check failed:', error)
        return { isLocked: false, remainingSeconds: 0, message: '' }
      }

      const status = data?.[0] || { is_locked: false, remaining_seconds: 0, message: '' }
      
      return {
        isLocked: status.is_locked,
        remainingSeconds: status.remaining_seconds,
        message: status.message
      }
    } catch (err) {
      console.error('[RateLimiter] Critical error:', err)
      return { isLocked: false, remainingSeconds: 0, message: '' }
    }
  },

  /**
   * Logs an authentication event to the database.
   */
  async logAuthEvent(email: string, eventType: 'LOGIN_ATTEMPT' | 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOCKOUT', isSuccess: boolean, metadata: any = {}) {
    try {
      const { error } = await supabase
        .from('auth_events')
        .insert({
          email: email.toLowerCase().trim(),
          event_type: eventType,
          is_success: isSuccess,
          user_agent: navigator.userAgent,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            platform: navigator.platform
          }
        })

      if (error) console.warn('[RateLimiter] Logging failed:', error.message)
    } catch (err) {
      console.warn('[RateLimiter] Critical logging failure:', err)
    }
  }
}
