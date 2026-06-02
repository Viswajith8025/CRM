import { useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export function useSecurePermissions() {
  const { session } = useAuthStore(); // The raw Supabase session from the store

  return useMemo(() => {
    // If no session exists, default to fully restricted access.
    if (!session || !session.user) {
      return { 
        role: 'guest', 
        canSearch: false, 
        isAdmin: false, 
        isHR: false,
        organizationId: null
      };
    }

    // Safely extract from the cryptographically signed JWT payload
    const appMetadata = session.user.app_metadata || {};
    const role = appMetadata.role || 'employee';
    const organizationId = appMetadata.organization_id || null;

    // Derived flags for UI conditional rendering
    // These cannot be bypassed via DevTools state manipulation because
    // they are derived from the read-only JWT session object.
    return {
      role,
      organizationId,
      isAdmin: role === 'admin' || role === 'super_admin',
      isHR: role === 'hr',
      canSearch: ['admin', 'super_admin', 'hr'].includes(role),
    };
  }, [session]);
}
