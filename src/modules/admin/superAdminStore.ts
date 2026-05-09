import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Organization {
  id: string;
  company_name: string;
  corporate_email: string;
  status: 'active' | 'suspended';
  subscription_status: 'active' | 'past_due' | 'canceled' | 'trial';
  created_at: string;
  suspended_at: string | null;
  user_count?: number;
}

interface SuperAdminState {
  organizations: Organization[];
  isLoading: boolean;
  fetchOrganizations: () => Promise<void>;
  toggleOrganizationStatus: (orgId: string, currentStatus: string) => Promise<void>;
  generateDemoOrganization: (name: string) => Promise<void>;
}

export const useSuperAdminStore = create<SuperAdminState>((set, get) => ({
  organizations: [],
  isLoading: false,

  fetchOrganizations: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('organization_settings')
        .select(`
          id, 
          company_name, 
          corporate_email, 
          status, 
          subscription_status, 
          suspended_at,
          profiles(count)
        `)
        .order('company_name', { ascending: true });

      if (error) throw error;

      const formattedOrgs = (data as any[]).map(org => ({
        ...org,
        user_count: org.profiles?.[0]?.count || 0
      }));

      set({ organizations: formattedOrgs });
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  toggleOrganizationStatus: async (orgId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const suspendedAt = newStatus === 'suspended' ? new Date().toISOString() : null;

    try {
      const { error } = await supabase
        .from('organization_settings')
        .update({ 
          status: newStatus,
          suspended_at: suspendedAt
        })
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      set({
        organizations: get().organizations.map(org => 
          org.id === orgId ? { ...org, status: newStatus, suspended_at: suspendedAt } : org
        )
      });
    } catch (err) {
      console.error("Failed to toggle status:", err);
      throw err;
    }
  },

  generateDemoOrganization: async (name: string) => {
    set({ isLoading: true });
    try {
      // 1. Create the organization settings
      const { data: org, error: orgError } = await supabase
        .from('organization_settings')
        .insert({ 
          company_name: name,
          corporate_email: `demo@${name.toLowerCase().replace(/\s/g, '')}.com`,
          status: 'active',
          subscription_status: 'trial'
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Call the Seeder Function
      const { error: seedError } = await supabase.rpc('seed_demo_data', { org_id: org.id });
      if (seedError) throw seedError;

      await get().fetchOrganizations();
    } catch (err) {
      console.error("Failed to generate demo org:", err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  }
}));
