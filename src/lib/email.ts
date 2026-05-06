import { supabase } from './supabase'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

/**
 * Securely calls our Supabase Database Function to send an email via Resend.
 * This ensures our Resend API key is never exposed to the browser.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  try {
    // We use a secure Postgres function (RPC) instead of an Edge Function
    // so we don't need to mess with Supabase CLI logins.
    const { data, error } = await supabase.rpc('send_email_via_resend', {
      p_to_email: Array.isArray(to) ? to[0] : to,
      p_subject: subject,
      p_html: html
    })

    if (error) {
      console.error('Database Function Error:', error)
      throw new Error(error.message || 'Failed to trigger email function.')
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('Email sending failed:', error)
    throw error
  }
}
