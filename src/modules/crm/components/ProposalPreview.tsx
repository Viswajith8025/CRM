import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, X, Send, Loader2 } from 'lucide-react'
import { sendEmail } from '@/lib/email'
import { toast } from 'sonner'

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
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a202c; margin: 0; padding: 0; background-color: #f7fafc; }
            .container { max-width: 800px; margin: 40px auto; background: #fff; padding: 60px; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); border-top: 8px solid #000; }
            .header { margin-bottom: 50px; }
            .company-name { font-size: 32px; font-weight: 900; color: #000; letter-spacing: -1px; margin-bottom: 10px; }
            .meta-badge { display: inline-block; padding: 4px 12px; background: #000; color: #fff; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; border-radius: 4px; margin-top: 10px; }
            .section-title { font-size: 12px; font-weight: 900; color: #718096; text-transform: uppercase; letter-spacing: 0.2em; border-bottom: 2px solid #edf2f7; padding-bottom: 8px; margin: 40px 0 20px; }
            .client-card { background: #f8fafc; padding: 30px; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 40px; }
            .pricing-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 30px 0; border: 2px solid #000; border-radius: 12px; overflow: hidden; }
            .pricing-table th { background: #000; color: #fff; padding: 16px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; }
            .pricing-table td { padding: 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            .total-row { background: #f1f5f9; font-weight: 900; }
            .total-row td { font-size: 18px; border-top: 2px solid #000; }
            .terms { color: #4a5568; font-size: 12px; line-height: 1.8; }
            .footer { margin-top: 60px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 30px; font-size: 11px; color: #a0aec0; text-transform: uppercase; letter-spacing: 1px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="company-name">${data.company_name}</div>
              <div style="font-size: 14px; color: #4a5568; font-weight: bold;">${data.company_email} • ${data.company_phone}</div>
              <div class="meta-badge">OFFICIAL PROPOSAL</div>
            </div>

            <div class="client-card">
              <div style="font-size: 10px; font-weight: 900; color: #718096; text-transform: uppercase; margin-bottom: 15px;">Prepared For:</div>
              <div style="font-size: 24px; font-weight: 900; color: #000;">${data.client_name}</div>
              <div style="font-size: 16px; color: #4a5568; margin-top: 4px;">${data.client_company}</div>
            </div>

            <div class="section-title">Project Overview</div>
            <div style="font-size: 20px; font-weight: 900; color: #000; margin-bottom: 15px;">${data.service_name}</div>
            <div style="font-size: 14px; color: #4a5568; text-align: justify; line-height: 1.8;">${data.description}</div>

            <div class="section-title">Financial Quotation</div>
            <table class="pricing-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th style="text-align: right;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map((item: any) => `
                  <tr>
                    <td style="font-weight: bold; color: #000;">${item.name}<br/><span style="font-size: 11px; font-weight: normal; color: #718096;">${item.desc || ''}</span></td>
                    <td style="text-align: right; font-weight: 900;">${item.price.toLocaleString()}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td style="text-align: right; text-transform: uppercase;">Grand Total</td>
                  <td style="text-align: right;">₹${data.total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="section-title">Commitment & Terms</div>
            <div class="terms">
              <ul style="padding-left: 20px;">
                ${data.terms.map((term: string) => `<li>${term}</li>`).join('')}
              </ul>
            </div>

            <div class="footer">
              Proprietary & Confidential • Generated for ${data.client_name} • ${new Date().getFullYear()}
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
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center font-black text-white italic">P</div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Proposal Engine</h2>
        </div>
        <div className="flex gap-3">
          <Button size="sm" onClick={handleSendEmail} disabled={isSending} className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-full px-6 shadow-lg shadow-emerald-500/20 no-print">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Dispatch Proposal
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-2 border-white/20 text-white hover:bg-white/10 rounded-full px-6 no-print">
            <Printer className="h-4 w-4" /> Export PDF
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10 rounded-full no-print">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-800/50 p-6 md:p-12 print:p-0 print:bg-white custom-scrollbar">
        <div id="proposal-content" className="bg-white mx-auto shadow-[0_48px_80px_-16px_rgba(0,0,0,0.4)] p-12 md:p-20 w-full max-w-[850px] min-h-[1100px] print:shadow-none print:w-full print:p-0 mb-12 relative overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
          
          {/* DECORATIVE TOP */}
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-900" />
          
          {/* HEADER */}
          <div className="flex justify-between items-start mb-20">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-3xl font-black tracking-tighter text-slate-900">{data.company_name}</div>
                <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>{data.company_email}</span>
                  <span>•</span>
                  <span>{data.company_phone}</span>
                </div>
              </div>
              <div className="inline-block px-3 py-1 bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest rounded">
                GSTIN: {data.company_gstin}
              </div>
            </div>
            <div className="text-right space-y-2">
               <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Quotation Ref</div>
               <div className="text-xl font-black text-slate-900">#{data.proposal_id}</div>
               <div className="text-[10px] font-bold text-slate-400">{data.date}</div>
            </div>
          </div>

          {/* MAIN CONTENT TITLE */}
          <div className="mb-16">
            <h1 className="text-5xl font-black tracking-tighter text-slate-900 mb-4">Project Proposal</h1>
            <div className="h-1.5 w-20 bg-primary" />
          </div>

          {/* RECIPIENT */}
          <div className="grid grid-cols-2 gap-12 mb-20 p-8 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client Partner</div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-slate-900 leading-tight">{data.client_name}</div>
                <div className="text-lg font-bold text-slate-500">{data.client_company}</div>
              </div>
            </div>
            <div className="space-y-4 text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Track</div>
              <div className="text-lg font-black text-primary leading-tight">
                {data.service_name || (data.service_type ? data.service_type.replace('_', ' ').toUpperCase() : 'General Service')}
              </div>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="mb-20">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-6 flex items-center gap-4">
              Scope of Engagement
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="text-base text-slate-600 leading-relaxed text-justify whitespace-pre-wrap px-4 border-l-2 border-slate-100 italic">
              {data.description}
            </div>
          </div>

          {/* PRICING TABLE */}
          <div className="mb-20">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-6 flex items-center gap-4">
              Financial Breakdown
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-4 border-slate-900">
                  <th className="py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Component</th>
                  <th className="py-6 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Investment (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item: any, idx: number) => (
                  <tr key={idx} className="group">
                    <td className="py-8 pr-4">
                      <p className="text-lg font-black text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">{item.desc}</p>
                    </td>
                    <td className="py-8 px-4 text-right font-black text-slate-900 text-xl tracking-tighter">
                      {item.price.toLocaleString()}
                    </td>
                  </tr>
                ))}
                
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="py-8 px-6 text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Total Project Value</td>
                  <td className="py-8 px-6 text-right font-black text-slate-900 text-4xl tracking-tighter">
                    ₹{data.total.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TERMS */}
          <div className="mb-24">
             <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-6 flex items-center gap-4">
              Engagement Terms
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <ul className="grid grid-cols-1 gap-4 px-4">
              {data.terms.map((term: string, idx: number) => (
                <li key={idx} className="flex gap-4 items-start text-[11px] text-slate-500 font-medium leading-relaxed">
                   <span className="h-1.5 w-1.5 bg-primary rounded-full mt-1.5 shrink-0" />
                   {term}
                </li>
              ))}
            </ul>
          </div>

          {/* SIGNATURE SECTION */}
          <div className="grid grid-cols-2 gap-20 pt-20 border-t-2 border-slate-50">
            <div className="space-y-8 text-center">
              <div className="h-12 flex items-end justify-center">
                 <div className="h-px w-full bg-slate-200" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-900">Client Partner Approval</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sign & Date</div>
              </div>
            </div>
            <div className="space-y-8 text-center">
              <div className="h-12 flex items-end justify-center">
                 <div className="h-px w-full bg-slate-200" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-900">Authorized Signatory</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ECRAFTZ DIGITAL SOLUTIONS</div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-32 pt-8 border-t border-slate-50 text-[10px] text-slate-300 text-center uppercase tracking-[0.5em] font-black">
             Proprietary & Confidential • {data.company_name}
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 20px; border: 3px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); border: 3px solid transparent; background-clip: content-box; }
        
        @media print {
          body * { visibility: hidden; }
          #proposal-content, #proposal-content * { visibility: visible; }
          #proposal-content { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; box-shadow: none; border: none; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
