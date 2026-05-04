import { useEffect } from 'react'
import { useNetworkStore } from '@/store/useNetworkStore'

export function useNetwork() {
  const { setOnline } = useNetworkStore()

  useEffect(() => {
    // Handler functions
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    // Add event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check (in case it changed before React hydrated)
    if (typeof navigator !== 'undefined') {
      setOnline(navigator.onLine)
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])
}
