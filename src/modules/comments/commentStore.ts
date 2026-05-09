import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface Comment {
  id: string
  user_id: string
  content: string
  entity_id: string
  entity_type: string
  parent_id: string | null
  mentions: Array<{ id: string, name: string }>
  attachment_url?: string
  created_at: string
  profiles?: {
    full_name: string
    avatar_url: string
  }
  replies?: Comment[]
}

interface CommentState {
  comments: Record<string, Comment[]> // entity_id -> comments
  isLoading: boolean
  fetchComments: (entityId: string) => Promise<void>
  addComment: (comment: Partial<Comment>) => Promise<void>
  deleteComment: (id: string, entityId: string) => Promise<void>
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: {},
  isLoading: false,

  fetchComments: async (entityId: string) => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Organize into threads
      const allComments = data as Comment[]
      const threadMap: Record<string, Comment> = {}
      const rootComments: Comment[] = []

      allComments.forEach(c => {
        threadMap[c.id] = { ...c, replies: [] }
      })

      allComments.forEach(c => {
        if (c.parent_id && threadMap[c.parent_id]) {
          threadMap[c.parent_id].replies?.push(threadMap[c.id])
        } else if (!c.parent_id) {
          rootComments.push(threadMap[c.id])
        }
      })

      set(state => ({
        comments: { ...state.comments, [entityId]: rootComments },
        isLoading: false
      }))
    } catch (error) {
      console.error('Error fetching comments:', error)
      set({ isLoading: false })
    }
  },

  addComment: async (comment) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert(comment)
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      // Refresh comments for this entity to show the new one in the right place
      if (comment.entity_id) {
        get().fetchComments(comment.entity_id)
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      throw error
    }
  },

  deleteComment: async (id, entityId) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', id)

      if (error) throw error
      get().fetchComments(entityId)
    } catch (error) {
      console.error('Error deleting comment:', error)
      throw error
    }
  }
}))
