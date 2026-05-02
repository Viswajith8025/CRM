import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import type { Campaign, SEOKeyword, SocialPost } from './types'

interface MarketingState {
  campaigns: Campaign[]
  keywords: SEOKeyword[]
  posts: SocialPost[]
  isLoading: boolean
  error: string | null

  fetchCampaigns: () => Promise<void>
  fetchKeywords: () => Promise<void>
  fetchPosts: () => Promise<void>

  addCampaign: (campaign: Partial<Campaign>) => Promise<void>
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>
  
  addKeyword: (keyword: Partial<SEOKeyword>) => Promise<void>
  updateKeyword: (id: string, updates: Partial<SEOKeyword>) => Promise<void>
  
  addPost: (post: Partial<SocialPost>) => Promise<void>
  updatePostStatus: (id: string, status: SocialPost['status']) => Promise<void>
}

export const useMarketingStore = create<MarketingState>((set, get) => ({
  campaigns: [],
  keywords: [],
  posts: [],
  isLoading: false,
  error: null,

  fetchCampaigns: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error

      // Also fetch leads count per campaign
      const { data: leads } = await supabase.from('leads').select('campaign_id')
      const leadsCountByCampaign = (leads || []).reduce((acc: any, lead) => {
        if (lead.campaign_id) {
          acc[lead.campaign_id] = (acc[lead.campaign_id] || 0) + 1
        }
        return acc
      }, {})

      const campaignsWithLeads = (data as Campaign[]).map(c => ({
        ...c,
        leads_count: leadsCountByCampaign[c.id] || 0
      }))

      set({ campaigns: campaignsWithLeads, error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load campaigns.") })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchKeywords: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('marketing_keywords')
        .select('*')
        .order('search_volume', { ascending: false })
      
      if (error) throw error
      set({ keywords: data as SEOKeyword[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load keywords.") })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchPosts: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('marketing_posts')
        .select('*')
        .order('scheduled_for', { ascending: true })
      
      if (error) throw error
      set({ posts: data as SocialPost[], error: null })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load social posts.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addCampaign: async (campaign) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...campaign, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('marketing_campaigns')
        .insert(payload)
        .select('*')
        .single()
      
      if (error) throw error
      set(state => ({ campaigns: [{ ...data, leads_count: 0 } as Campaign, ...state.campaigns] }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  updateCampaign: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()
      
      if (error) throw error
      set(state => ({
        campaigns: state.campaigns.map(c => c.id === id ? { ...c, ...data } : c)
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  addKeyword: async (keyword) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...keyword, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('marketing_keywords')
        .insert(payload)
        .select('*')
        .single()
      
      if (error) throw error
      set(state => ({ keywords: [data as SEOKeyword, ...state.keywords] }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  updateKeyword: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('marketing_keywords')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()
      
      if (error) throw error
      set(state => ({
        keywords: state.keywords.map(k => k.id === id ? { ...k, ...data } : k)
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  addPost: async (post) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...post, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('marketing_posts')
        .insert(payload)
        .select('*')
        .single()
      
      if (error) throw error
      set(state => ({ posts: [data as SocialPost, ...state.posts] }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  },

  updatePostStatus: async (id, status) => {
    try {
      const { data, error } = await supabase
        .from('marketing_posts')
        .update({ status })
        .eq('id', id)
        .select('*')
        .single()
      
      if (error) throw error
      set(state => ({
        posts: state.posts.map(p => p.id === id ? { ...p, ...data } : p)
      }))
    } catch (err) {
      throw toFriendlyError(err)
    }
  }
}))
