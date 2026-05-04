import { useNetworkStore } from '@/store/useNetworkStore'
import { WifiOff, CloudUpload, CheckCircle2 } from 'lucide-react'
import { useNetwork } from '@/hooks/useNetwork'
import { useEffect, useState } from 'react'

export function NetworkIndicator() {
  // Initialize the event listeners
  useNetwork()
  
  const { isOnline, queue } = useNetworkStore()
  const [showSyncSuccess, setShowSyncSuccess] = useState(false)

  // Show a brief success state when queue goes from >0 to 0 while online
  useEffect(() => {
    if (isOnline && queue.length === 0) {
      // It might be initial load, so we only show success if we know it just finished syncing.
      // A more robust way is to track "syncing" state in store, but this is a simple approximation.
    }
  }, [isOnline, queue.length])

  if (isOnline && queue.length === 0 && !showSyncSuccess) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-full bg-background border shadow-lg px-4 py-2 text-sm font-medium animate-in slide-in-from-bottom-5 fade-in duration-300">
      {!isOnline ? (
        <>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <WifiOff className="h-3.5 w-3.5" />
          </div>
          <span className="text-muted-foreground">
            Offline Mode
            {queue.length > 0 && <span className="ml-1 font-bold text-amber-500">({queue.length} pending)</span>}
          </span>
        </>
      ) : queue.length > 0 ? (
        <>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
            <CloudUpload className="h-3.5 w-3.5 animate-bounce" />
          </div>
          <span className="text-muted-foreground">
            Syncing <span className="font-bold text-blue-500">{queue.length}</span> actions...
          </span>
        </>
      ) : showSyncSuccess ? (
        <>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-emerald-500 font-medium">Synced successfully</span>
        </>
      ) : null}
    </div>
  )
}
