import { supabase } from './supabase'

export interface RateLimitStatus {
  allowed: boolean
  remaining: number
  limit: number
  resetAfter: number
  message?: string
}

/**
 * Enterprise Rate Limiter Utility (OWASP Hardened)
 * 
 * Interacts with the 'check_rate_limit' SQL function to enforce 
 * IP and User-based throttling across all sensitive actions.
 */
export const rateLimiter = {
  /**
   * Checks if a specific action is allowed for a given identifier (email, IP, or userId).
   * 
   * @param identifier The unique string to rate limit (e.g. email, user UUID)
   * @param action The name of the action (e.g. 'login', 'create_invoice')
   * @param maxHits Maximum allowed hits in the window
   * @param windowSeconds The time window in seconds
   */
  async check(
    identifier: string, 
    action: string, 
    maxHits: number = 5, 
    windowSeconds: number = 60
  ): Promise<RateLimitStatus> {
    try {
      const key = `${action}:${identifier.toLowerCase().trim()}`
      
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_key: key,
        p_max_hits: maxHits,
        p_window_seconds: windowSeconds
      })

      if (error) {
        console.error('[RateLimiter] RPC Check failed:', error)
        // SECURITY AUDIT: Fail closed. If the rate limiter is unreachable or failing,
        // we must block access to prevent security bypasses.
        return { allowed: false, remaining: 0, limit: maxHits, resetAfter: windowSeconds, message: "Security service unavailable. Please try again later." }
      }

      return {
        allowed: data.allowed,
        remaining: data.remaining,
        limit: data.limit,
        resetAfter: data.reset_after,
        message: data.message
      }
    } catch (err) {
      console.error('[RateLimiter] Critical error:', err)
      return { allowed: false, remaining: 0, limit: maxHits, resetAfter: windowSeconds, message: "Internal security error." }
    }
  },

  /**
   * Logs security-related events for auditing.
   */
  async logSecurityEvent(eventType: string, metadata: any = {}) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('security_logs')
        .insert({
          user_id: user?.id || null,
          event_type: eventType,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        })

      if (error) console.warn('[Security] Logging failed:', error.message)
    } catch (err) {
      console.warn('[Security] Critical logging failure:', err)
    }
  }
}
