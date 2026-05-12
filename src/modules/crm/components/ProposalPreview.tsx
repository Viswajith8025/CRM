import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, X, Send, Loader2, Building2, Mail, Phone, Globe, CreditCard, Clock, CheckSquare } from 'lucide-react'
import { sendEmail } from '@/lib/email'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface ProposalPreviewProps {
  data: any
  onClose: () => void
}

export function ProposalPreview({ data, onClose }: ProposalPreviewProps) {
  const [isSending, setIsSending] = useState(false)

  const handlePrint = () => {
    window.print()
  }

  const handleSendEmail = async () => {
    if (!data.client_email) {
      toast.error("Client email is missing!")
      return
    }

    setIsSending(true)
    try {
      // Use the premium HTML template (simplified for email but keeping the style)
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #0f172a; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 800px; margin: 40px auto; background: #fff; padding: 0; border-radius: 32px; overflow: hidden; box-shadow: 0 40px 80px -12px rgba(0,0,0,0.1); }
            .top-strip { height: 8px; background: linear-gradient(to right, #2563eb, #3b82f6, #10b981); }
            .content { padding: 60px; }
            .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 60px; }
            .logo-box { height: 60px; width: 60px; background: #0f172a; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
            .logo-inner { height: 30px; width: 30px; background: #fff; border-radius: 8px; transform: rotate(12deg); }
            .brand-name { font-size: 32px; font-weight: 900; color: #0f172a; letter-spacing: -2px; margin: 0; }
            .brand-tag { font-size: 10px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 4px; margin-top: 4px; }
            .meta-title { font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 4px; text-align: right; }
            .meta-value { font-size: 40px; font-weight: 900; color: #0f172a; letter-spacing: -2px; text-align: right; }
            .info-bar { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 24px; padding: 32px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; margin-bottom: 60px; }
            .info-item label { font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 4px; }
            .info-item value { font-size: 14px; font-weight: 900; color: #0f172a; display: block; }
            .recipient-header { display: inline-block; padding: 4px 16px; background: #0f172a; color: #fff; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; border-radius: 8px 8px 0 0; }
            .recipient-box { border: 2px solid #0f172a; border-radius: 0 24px 24px 24px; padding: 32px; display: flex; gap: 40px; margin-bottom: 60px; }
            .recipient-name { font-size: 36px; font-weight: 900; color: #0f172a; letter-spacing: -1px; margin: 0; }
            .pricing-table { width: 100%; border-collapse: collapse; margin-bottom: 60px; }
            .pricing-table th { padding: 24px 0; border-bottom: 4px solid #0f172a; font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 3px; text-align: left; }
            .pricing-table td { padding: 32px 0; border-bottom: 1px solid #f1f5f9; }
            .pricing-table .total-row { background: #f8fafc; }
            .footer-box { background: #0f172a; padding: 60px; text-align: center; color: #fff; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="top-strip"></div>
            <div class="content">
              <div class="header">
                <div>
                  <img src="/logogpt.png" alt="Logo" style="height: 60px; width: auto; object-fit: contain;" />
                </div>
                <div>
                  <p class="meta-title">Proposal Ref</p>
                  <p class="meta-value">#${data.proposal_id}</p>
                </div>
              </div>

              <div class="info-bar">
                <div class="info-item"><label>Date Issued</label><value>${data.date}</value></div>
                <div class="info-item"><label>Expiry Date</label><value>${data.expiry_date || 'N/A'}</value></div>
                <div class="info-item"><label>Project Track</label><value>${data.service_name}</value></div>
                <div class="info-item"><label>Currency</label><value>INR (₹)</value></div>
              </div>

              <div class="recipient-header">Recipient</div>
              <div class="recipient-box">
                <div style="flex: 1;">
                  <h2 class="recipient-name">${data.client_name}</h2>
                  <p style="font-size: 18px; font-weight: bold; color: #64748b; margin-top: 4px;">${data.client_company}</p>
                </div>
                <div style="flex: 1; font-size: 14px; color: #64748b;">
                  <p><strong>Email:</strong> ${data.client_email}</p>
                  <p><strong>Service:</strong> ${data.service_name}</p>
                </div>
              </div>

              <h3 style="font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 24px;">Scope of Work</h3>
              <div style="padding: 24px; background: #fff; border-left: 4px solid #2563eb; margin-bottom: 60px; font-size: 15px; color: #475569; line-height: 1.8;">
                ${data.description}
              </div>

              <table class="pricing-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th style="text-align: right;">Investment (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.map((item: any) => `
                    <tr>
                      <td>
                        <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${item.name}</div>
                        <div style="font-size: 12px; font-weight: bold; color: #94a3b8; margin-top: 4px;">Professional Service</div>
                      </td>
                      <td style="text-align: right; font-size: 20px; font-weight: 900; color: #0f172a;">₹${item.price.toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div style="background: #f8fafc; padding: 40px; border-radius: 32px; display: flex; justify-content: space-between; align-items: end;">
                <div>
                   <p style="font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px;">Total Investment</p>
                   <p style="font-size: 48px; font-weight: 900; color: #0f172a; letter-spacing: -2px; margin: 0;">₹${data.total.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div class="footer-box">
               <h3 style="font-size: 24px; font-weight: 900; letter-spacing: -1px; margin-bottom: 16px;">Ready to start your project?</h3>
               <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; opacity: 0.4;">Proprietary & Confidential • Professional CRM Solutions</p>
            </div>
          </div>
        </body>
        </html>
      `

      await sendEmail({
        to: data.client_email,
        subject: `Project Proposal: ${data.service_name} - ${data.company_name}`,
        html,
      })

      toast.success("Proposal sent to client successfully!")
    } catch (error) {
      console.error("Failed to send email:", error)
      toast.error("Failed to send proposal. Please check your Resend configuration.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#020617] p-4 md:p-12 print:p-0 print:bg-white custom-scrollbar">
        <div id="proposal-content" className="bg-white mx-auto shadow-[0_64px_128px_-24px_rgba(0,0,0,0.8)] overflow-hidden w-full max-w-5xl print:shadow-none print:w-full print:p-0 mb-20 relative" style={{ fontFamily: "'Inter', sans-serif" }}>
          
          {/* TOP DECORATIVE STRIP */}
          <div className="h-2 bg-gradient-to-r from-primary via-blue-600 to-emerald-500" />

          <div className="p-12 md:p-20">
            {/* 1. HEADER SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
              <div className="space-y-6">
                <div className="flex items-center gap-5">
                  <img src="/logogpt.png" alt="Logo" className="h-20 w-auto object-contain" />
                </div>
                
                <div className="space-y-2 text-xs text-slate-500 font-bold leading-relaxed max-w-xs">
                  <p className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-900" />
                    {data.company_email}
                  </p>
                  <p className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-900" />
                    {data.company_phone}
                  </p>
                  <p className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-slate-900" />
                    GSTIN: {data.company_gstin}
                  </p>
                </div>
              </div>

              <div className="text-left md:text-right space-y-6">
                <div className="space-y-2">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-300">Project Proposal</h2>
                  <p className="text-6xl font-black text-slate-950 tracking-tighter">#{data.proposal_id}</p>
                </div>
                <div className="inline-flex items-center px-5 py-2 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20">
                  <Clock className="w-4 h-4 mr-2" />
                  Valid for 7 Days
                </div>
              </div>
            </div>

            {/* 2. INFO BAR */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-10 rounded-[2rem] bg-slate-50 border border-slate-100 mb-20">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Issued On</p>
                <p className="text-sm font-black text-slate-950">{data.date}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valid Until</p>
                <p className="text-sm font-black text-slate-950">{data.expiry_date || 'N/A'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Track</p>
                <p className="text-sm font-black text-slate-950 truncate">{data.service_name}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Currency</p>
                <p className="text-sm font-black text-slate-950">INR (₹)</p>
              </div>
            </div>

            {/* 3. CLIENT SECTION */}
            <div className="mb-20">
              <div className="inline-block px-5 py-1.5 bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-t-xl">
                Prepared For
              </div>
              <div className="p-10 border-4 border-slate-950 rounded-b-[2rem] rounded-r-[2rem] flex flex-col md:flex-row justify-between items-center gap-12">
                <div className="space-y-4">
                  <p className="text-5xl font-black text-slate-950 tracking-tighter leading-none">{data.client_name}</p>
                  <p className="text-2xl font-bold text-slate-400 tracking-tight">{data.client_company}</p>
                </div>
                <div className="w-full md:w-auto space-y-4 text-sm text-slate-500 font-bold border-l-2 border-slate-100 pl-12">
                  <p className="flex items-center gap-4">
                    <Mail className="w-5 h-5 text-slate-950" />
                    {data.client_email}
                  </p>
                  <p className="flex items-center gap-4">
                    <Globe className="w-5 h-5 text-slate-950" />
                    B2B Relationship
                  </p>
                </div>
              </div>
            </div>

            {/* 4. SCOPE SECTION */}
            <div className="mb-20">
              <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-300 mb-8 flex items-center gap-6">
                Scope of Engagement
                <div className="h-px flex-1 bg-slate-100" />
              </h3>
              <div className="p-10 rounded-[2rem] bg-white border-2 border-slate-50 text-base text-slate-600 leading-relaxed italic text-justify relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                "{data.description}"
              </div>
            </div>

            {/* 5. PRICING TABLE */}
            <div className="mb-20">
              <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-300 mb-8 flex items-center gap-6">
                Investment Breakdown
                <div className="h-px flex-1 bg-slate-100" />
              </h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-8 border-slate-950">
                    <th className="py-8 text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Component</th>
                    <th className="py-8 px-6 text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 text-right">Investment (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-50">
                  {data.items.map((item: any, idx: number) => (
                    <tr key={idx} className="group">
                      <td className="py-10 pr-6">
                        <p className="text-2xl font-black text-slate-950 tracking-tight">{item.name}</p>
                        <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-2">Professional Service Package</p>
                      </td>
                      <td className="py-10 px-6 text-right font-black text-slate-950 text-3xl tracking-tighter">
                        {item.price.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 6. SUMMARY & TERMS */}
            <div className="grid md:grid-cols-2 gap-20 pt-16 border-t-4 border-slate-950">
              <div className="space-y-10">
                <div className="p-10 rounded-[2.5rem] bg-slate-950 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20" />
                  <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-4 opacity-50">
                      <CreditCard className="w-6 h-6" />
                      <h4 className="font-black text-[10px] uppercase tracking-[0.4em]">Engagement Terms</h4>
                    </div>
                    <ul className="space-y-4">
                      {data.terms.slice(0, 3).map((term: string, idx: number) => (
                        <li key={idx} className="flex gap-4 items-start text-xs font-bold leading-relaxed">
                           <div className="h-1.5 w-1.5 bg-primary rounded-full mt-1.5 shrink-0" />
                           {term}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-8 bg-slate-50 p-12 rounded-[2.5rem] flex flex-col justify-center">
                <div className="space-y-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] block">Total Project Value</span>
                  <span className="text-7xl font-black text-slate-950 tracking-tighter block">
                    ₹{data.total.toLocaleString()}
                  </span>
                </div>
                <div className="pt-8 border-t border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 text-center">Authorized Signatory</p>
                  <div className="h-16 flex items-end justify-center border-b-2 border-slate-950 pb-2">
                     <p className="text-xl font-bold italic text-slate-300">Authorized Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="bg-slate-950 p-20 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-50" />
            <div className="relative z-10 space-y-8">
              <p className="text-4xl font-black tracking-tighter leading-none">Ready to build your digital future?</p>
              <div className="flex justify-center items-center gap-10 text-[10px] font-black uppercase tracking-[0.5em] opacity-30">
                 <span>Proprietary</span>
                 <span className="h-1.5 w-1.5 bg-white rounded-full" />
                 <span>Confidential</span>
                 <span className="h-1.5 w-1.5 bg-white rounded-full" />
                 <span>2026</span>
              </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 20px; border: 3px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        @media print {
          body * { visibility: hidden; }
          #proposal-content, #proposal-content * { visibility: visible; }
          #proposal-content { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
        }
      ` }} />
    </div>
  )
}
