import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    // 1. Parse the payload from the Database Webhook Trigger
    const payload = await req.json()
    const newInvoice = payload.record // The newly created invoice row

    // IMPORTANT: Verify that this is an invoice event
    if (!newInvoice || !newInvoice.id) {
      return new Response(JSON.stringify({ error: "Invalid payload format" }), { status: 400 })
    }

    // 2. Ideally fetch Client Details (via Supabase Admin Client using client_id)
    // For this boilerplate, we'll assume an admin email for testing if no client details exist in payload
    // const clientEmail = "test@example.com"; 

    // 3. Send Email via Resend
    // Ensure you have added RESEND_API_KEY to your Supabase Secrets
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'billing@your-erp.com',
        to: 'client@example.com', // Replace with dynamically fetched client email
        subject: `Invoice #${newInvoice.id} is due`,
        html: `<h2>Invoice Generated</h2>
               <p>Please pay your invoice of <strong>$${newInvoice.amount}</strong>.</p>
               <p>Due Date: ${newInvoice.due_date}</p>`
      })
    })

    const emailResponse = await res.json()

    if (!res.ok) {
       console.error("Resend Error:", emailResponse)
       throw new Error(emailResponse.message || "Failed to send email")
    }

    return new Response(JSON.stringify({ success: true, id: newInvoice.id }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    })
  } catch (error: any) {
    console.error("Edge Function Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { "Content-Type": "application/json" },
      status: 500 
    })
  }
})
