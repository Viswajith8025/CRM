import { create } from 'zustand'
import { toast } from 'sonner'

export interface QueuedAction {
  id: string
  context: string
  action: () => Promise<any>
  timestamp: number
}

interface NetworkState {
  isOnline: boolean
  queue: QueuedAction[]
  setOnline: (status: boolean) => void
  enqueueAction: (context: string, action: () => Promise<any>) => void
  processQueue: () => Promise<void>
  clearQueue: () => void
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  // Initialize with the current browser state
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  queue: [],

  setOnline: (status: boolean) => {
    const wasOffline = !get().isOnline
    set({ isOnline: status })
    
    if (status && wasOffline) {
      const queueLength = get().queue.length
      if (queueLength > 0) {
        toast.success(`Back online! Processing ${queueLength} pending actions...`)
        get().processQueue()
      } else {
        toast.success('Connection restored.')
      }
    } else if (!status) {
      toast.warning('You are offline. Changes will be saved when you reconnect.', { duration: 10000 })
    }
  },

  enqueueAction: (context, action) => {
    const newItem: QueuedAction = {
      id: Math.random().toString(36).substring(7),
      context,
      action,
      timestamp: Date.now()
    }
    set((state) => ({ queue: [...state.queue, newItem] }))
    toast.info(`Offline: "${context}" queued to save later.`)
  },

  processQueue: async () => {
    const { queue, isOnline } = get()
    if (!isOnline || queue.length === 0) return

    // Create a copy and clear the main queue to prevent double processing
    set({ queue: [] })

    let successCount = 0
    let failCount = 0

    for (const item of queue) {
      try {
        await item.action()
        successCount++
      } catch (error) {
        console.error(`Failed to process queued action "${item.context}":`, error)
        failCount++
        // Optionally re-queue failed items, but for now we'll drop them to prevent infinite loops
        // unless it's another network error
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully synced ${successCount} offline actions.`)
    }
    if (failCount > 0) {
      toast.error(`Failed to sync ${failCount} actions.`)
    }
  },

  clearQueue: () => set({ queue: [] })
}))
