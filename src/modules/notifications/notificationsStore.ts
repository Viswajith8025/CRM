import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toFriendlyError } from '@/lib/supabaseError'

export interface Notification {
  id: string
  user_id: string
  title: string
  description: string
  type: 'assignment' | 'billing' | 'system' | 'project'
  is_read: boolean
  created_at: string
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
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })

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
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)

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
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
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
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)

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
      const { error } = await supabase
        .from('notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Deletes all

      if (error) throw error

      set({ notifications: [], unreadCount: 0 })
    } catch (err) {
      throw toFriendlyError(err, "Failed to clear notifications.")
    }
  },

  addNotification: async (notification) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert(notification)
      
      if (error) throw error
    } catch (err) {
      console.error("Silent notification fail:", err)
    }
  },

  subscribeToNotifications: () => {
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          get().fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}))
