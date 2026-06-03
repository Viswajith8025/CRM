import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Server environment misconfiguration.')
    }

    // Initialize the Supabase client with the service role key to bypass RLS
    // and access the auth admin API.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get the requester's user from the authorization header to verify they are an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requesterUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !requesterUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized request' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse the request payload
    const { email, full_name, role, department_id, organization_id, status } = await req.json()

    if (!email || !organization_id) {
      return new Response(JSON.stringify({ error: 'Email and organization_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // We could add an additional check here to ensure requesterUser belongs to organization_id
    // and has admin privileges. We'll rely on the RLS of the profiles table (which we bypass here)
    // or just assume the frontend checked it, but for true security we should verify:
    const { data: reqProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', requesterUser.id)
      .single()

    if (!reqProfile || (reqProfile.role !== 'admin' && reqProfile.role !== 'super_admin' && reqProfile.role !== 'hr')) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    if (reqProfile.role !== 'super_admin' && reqProfile.organization_id !== organization_id) {
       return new Response(JSON.stringify({ error: 'Cross-tenant invite forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Invite the user via Supabase Auth Admin
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name,
        role: role || 'employee',
      }
    })

    if (inviteError) {
      throw inviteError
    }

    const newUserId = inviteData.user.id

    // 2. Wait a moment to ensure handle_new_user trigger has run
    await new Promise(resolve => setTimeout(resolve, 500))

    // 3. Update the newly created profile with the correct details
    // The handle_new_user trigger inserts them with default org. We fix it here.
    const profilePayload: any = {
      full_name: full_name,
      role: role || 'employee',
      status: status || 'active',
      organization_id: organization_id
    }
    
    // We update the profile to override the defaults set by the database trigger
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(profilePayload)
      .eq('id', newUserId)

    if (updateError) {
      console.error("Warning: Could not update profile after invite", updateError)
      // Even if this fails, the user is invited. But it shouldn't fail.
    }

    // 4. Assign department if provided
    if (department_id) {
      const { error: deptError } = await supabaseAdmin
        .from('department_members')
        .insert({
          organization_id: organization_id,
          department_id: department_id,
          profile_id: newUserId,
          role: role === 'manager' || role === 'team_lead' ? 'lead' : 'member'
        })
      if (deptError) {
        console.error("Warning: Could not assign department", deptError)
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user: inviteData.user 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
