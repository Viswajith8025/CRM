import { supabase } from '../../lib/supabase'
import { Contact } from './types'

export const crmService = {
  async getContacts() {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Contact[]
  },

  async createContact(contact: Partial<Contact>) {
    const { data, error } = await supabase
      .from('contacts')
      .insert(contact)
      .select()
      .single()
    
    if (error) throw error
    return data as Contact
  }
}
