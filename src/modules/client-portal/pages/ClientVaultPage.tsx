import React, { useEffect, useState } from 'react'
import { PageWrapper } from "@/components/shared/PageWrapper"
import { FileVault } from "@/modules/documents/components/FileVault"
import { useAuthStore } from "@/store/useAuthStore"
import { supabase } from "@/lib/supabase"
import { Loader2, ShieldCheck } from "lucide-react"

export default function ClientVaultPage() {
  const { profile } = useAuthStore()
  const [clientId, setClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getClientId() {
      if (!profile) return
      
      // If user is a client, we need their internal client_id (from clients table)
      const { data, error } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', profile.id)
        .single()
      
      if (data) setClientId(data.id)
      setLoading(false)
    }
    getClientId()
  }, [profile])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <PageWrapper 
      title="File Vault" 
      description="Securely manage your assets, contracts, and project files."
    >
      <div className="space-y-8">
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-tight">Encrypted Storage</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your files are stored in an organization-isolated encrypted vault. Only you and authorized company representatives can access these documents.
            </p>
          </div>
        </div>

        <FileVault clientId={clientId || undefined} />
      </div>
    </PageWrapper>
  )
}
