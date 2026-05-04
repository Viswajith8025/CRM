import { supabase } from './supabase'

export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'PAYMENT' | 'LOGIN' | 'EXPORT'

export interface LogActivityParams {
  action: ActivityAction
  targetType: 'lead' | 'client' | 'project' | 'task' | 'invoice' | 'payment' | 'document' | 'user'
  targetId: string
  targetName: string
  description: string
  metadata?: Record<string, any>
}

/**
 * Senior Architect Note: 
 * This helper provides a standardized way to track user actions across the platform.
 * It's designed to be used in 'fire-and-forget' mode or awaited depending on consistency needs.
 */
export async function logActivity({
  action,
  targetType,
  targetId,
  targetName,
  description,
  metadata = {}
}: LogActivityParams) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Get org_id from profile (cached in store or fetched if needed)
    // For simplicity, we assume the user is authenticated and RLS will handle the profile check
    // or we fetch it once.
    
    const { error } = await supabase
      .from('activities')
      .insert({
        user_id: session.user.id,
        action,
        target_type: targetType,
        target_id: targetId,
        target_name: targetName,
        metadata: {
          ...metadata,
          description // Including description in metadata for flexibility
        },
        // organization_id will be handled by the public.get_my_org_id() default in DB
      })

    if (error) {
      console.error('Audit Log Error:', error)
    }
  } catch (err) {
    console.error('Critical Audit Logging Failure:', err)
  }
}
