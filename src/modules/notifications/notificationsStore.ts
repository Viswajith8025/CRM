import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toFriendlyError } from '@/lib/supabaseError'

export interface Notification {
  id: string
  user_id: string
  organization_id: string
  title: string
  message: string
  type: 'assignment' | 'billing' | 'system' | 'project' | 'mention' | 'reply'
  is_read: boolean
  created_at: string
  link?: string
}

interface NotificationsState {
  notifications: Notification[]
  isLoading: boolean
  unreadCount: number
  fetchNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  subscribeToNotifications: () => () => void
  addNotification: (notification: Partial<Notification>) => Promise<void>
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  isLoading: false,
  unreadCount: 0,

  fetchNotifications: async () => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      set({ 
        notifications: data as Notification[], 
        unreadCount: (data as Notification[]).filter(n => !n.is_read).length 
      })
    } catch (err) {
      console.error("Failed to fetch notifications:", err)
    } finally {
      set({ isLoading: false })
    }
  },

  markAsRead: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error

      set(state => {
        const notifications = state.notifications.map(n => 
          n.id === id ? { ...n, is_read: true } : n
        )
        return {
          notifications,
          unreadCount: notifications.filter(n => !n.is_read).length
        }
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to mark notification as read.")
    }
  },

  markAllAsRead: async () => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('organization_id', orgId)
        .eq('is_read', false)

      if (error) throw error

      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, is_read: true })),
        unreadCount: 0
      }))
    } catch (err) {
      throw toFriendlyError(err, "Failed to mark all as read.")
    }
  },

  deleteNotification: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error

      set(state => {
        const notifications = state.notifications.filter(n => n.id !== id)
        return {
          notifications,
          unreadCount: notifications.filter(n => !n.is_read).length
        }
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to delete notification.")
    }
  },

  clearAll: async () => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', profile.id)
        .eq('organization_id', orgId)

      if (error) throw error

      set({ notifications: [], unreadCount: 0 })
    } catch (err) {
      throw toFriendlyError(err, "Failed to clear notifications.")
    }
  },

  addNotification: async (notification) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return
      
      const payload = { 
        ...notification, 
        organization_id: orgId,
        user_id: notification.user_id || profile.id
      }

      const { error } = await supabase
        .from('notifications')
        .insert(payload)
      
      if (error) throw error
    } catch (err) {
      console.error("Silent notification fail:", err)
    }
  },

  subscribeToNotifications: () => {
    let channel: any = null;
    let isUnsubscribed = false;

    import('@/store/useAuthStore').then(({ useAuthStore }) => {
      if (isUnsubscribed) return;
      const profile = useAuthStore.getState().profile
      if (!profile?.organization_id || !profile?.id) return

      channel = supabase
        .channel(`notifications_${profile.id}_${Math.random()}`)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'notifications', 
            filter: `user_id=eq.${profile.id}` 
          },
          () => {
            get().fetchNotifications()
          }
        )
        .subscribe()
    })

    return () => {
      isUnsubscribed = true;
      if (channel) supabase.removeChannel(channel)
    }
  }
}))
