import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token, payload } = await req.json()
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown'

    // 1. Initialize Supabase Admin Client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. IP Rate Limiting Check (Using our PostgreSQL RPC)
    const { data: isAllowed, error: rlError } = await supabaseAdmin
      .rpc('check_rate_limit', { p_ip_address: clientIp })
    
    if (rlError || !isAllowed) {
      // Log the attack
      await supabaseAdmin.from('security_audit_logs').insert({
        event_type: 'RATE_LIMIT_EXCEEDED',
        ip_address: clientIp,
        payload: payload
      })
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      )
    }

    // 3. Cloudflare Turnstile Verification
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
    if (!turnstileSecret) {
      throw new Error("Missing Turnstile Secret")
    }

    const formData = new FormData()
    formData.append('secret', turnstileSecret)
    formData.append('response', token)
    formData.append('remoteip', clientIp)

    const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })
    
    const turnstileOutcome = await turnstileRes.json()

    if (!turnstileOutcome.success) {
      // Log the failed challenge
      await supabaseAdmin.from('security_audit_logs').insert({
        event_type: 'TURNSTILE_FAILED',
        ip_address: clientIp,
        payload: { errorCodes: turnstileOutcome['error-codes'] }
      })
      return new Response(
        JSON.stringify({ error: "Security check failed. Please refresh the page." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      )
    }

    // 4. Safe Insertion (Bypassing Public RLS because we verified the bot check)
    // Map your payload appropriately. Assume it's a client intake form.
    const { error: insertError } = await supabaseAdmin
      .from('leads')
      .insert({
        ...payload,
        source: 'Public Intake Form',
        status: 'new'
      })

    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
