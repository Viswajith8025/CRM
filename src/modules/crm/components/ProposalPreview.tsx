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
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 800px; margin: 20px auto; background: #fff; padding: 40px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .header-table { width: 100%; border-collapse: collapse; }
            .company-name { font-size: 24px; font-weight: bold; color: #000; margin: 0; }
            .meta-info { text-align: right; font-size: 14px; }
            .section-title { font-size: 16px; font-weight: bold; margin: 25px 0 10px; color: #1a202c; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #edf2f7; padding-bottom: 5px; }
            .client-info { margin-bottom: 30px; }
            .description { font-size: 14px; text-align: justify; color: #4a5568; margin-bottom: 30px; line-height: 1.8; }
            .pricing-table { width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #000; }
            .pricing-table th { background: #f8fafc; border: 1px solid #000; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 900; }
            .pricing-table td { border: 1px solid #000; padding: 12px; font-size: 14px; }
            .total-row { background: #1a202c; color: #fff; font-weight: bold; }
            .total-row td { color: #fff; border: 1px solid #000; }
            .terms { background: #f7fafc; padding: 20px; border-radius: 6px; font-size: 12px; color: #4a5568; }
            .terms ul { padding-left: 20px; margin: 0; }
            .terms li { margin-bottom: 8px; }
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.1em; border-top: 1px solid #edf2f7; padding-top: 20px; }
            .signature-table { width: 100%; margin-top: 60px; }
            .signature-box { border-top: 1px solid #000; padding-top: 10px; text-align: center; font-size: 11px; font-weight: bold; text-transform: uppercase; width: 40%; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <table class="header-table">
                <tr>
                  <td>
                    <div class="company-name">${data.company_name}</div>
                    <div style="font-size: 14px;">${data.company_email}</div>
                    <div style="font-size: 14px;">${data.company_phone}</div>
                    <div style="font-size: 12px; color: #718096;">GSTIN: ${data.company_gstin}</div>
                  </td>
                  <td class="meta-info">
                    <div><strong>Date:</strong> ${data.date}</div>
                    <div><strong>Proposal ID:</strong> ${data.proposal_id}</div>
                    <div style="color: #e53e3e;"><strong>Valid Until:</strong> ${data.valid_until}</div>
                  </td>
                </tr>
              </table>
            </div>

            <div class="client-info">
              <div style="font-weight: bold; color: #718096; font-size: 12px; text-transform: uppercase; margin-bottom: 5px;">Prepared For:</div>
              <div style="font-size: 18px; font-weight: bold;">${data.client_name}</div>
              <div style="font-size: 14px;">${data.client_company}</div>
              <div style="font-size: 14px;">${data.client_email}</div>
            </div>

            <div class="section-title">Service Requested</div>
            <div style="font-size: 20px; font-weight: bold; color: #2d3748;">
              ${data.service_name || (data.service_type ? data.service_type.replace('_', ' ').toUpperCase() : 'General Service')}
            </div>

            <div class="section-title">Project Description</div>
            <div class="description">${data.description}</div>

            <div class="section-title">Financial Quotation</div>
            <table class="pricing-table">
              <thead>
                <tr>
                  <th>Item / Service</th>
                  <th>Description</th>
                  <th style="text-align: right; width: 120px;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map((item: any) => `
                  <tr>
                    <td style="font-weight: bold;">${item.name}</td>
                    <td>${item.desc || ''}</td>
                    <td style="text-align: right; font-family: monospace;">${item.price.toLocaleString()}</td>
                  </tr>
                `).join('')}
                <tr>
                  <td colspan="2" style="text-align: right; font-weight: bold;">Subtotal</td>
                  <td style="text-align: right; font-weight: bold;">${data.subtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td colspan="2" style="text-align: right; font-style: italic; color: #718096;">GST (${data.gst_percent}%)</td>
                  <td style="text-align: right;">${data.gst_amount.toLocaleString()}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="2" style="text-align: right; font-size: 18px; text-transform: uppercase;">Total Payable</td>
                  <td style="text-align: right; font-size: 18px;">₹${data.total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="section-title">Terms & Conditions</div>
            <div class="terms">
              <ul>
                ${data.terms.map((term: string) => `<li>${term}</li>`).join('')}
              </ul>
            </div>

            <table class="signature-table">
              <tr>
                <td class="signature-box">Client Signature</td>
                <td style="width: 20%;"></td>
                <td class="signature-box">Authorized Signatory</td>
              </tr>
            </table>

            <div class="footer">
              This is a legally binding proposal from ${data.company_name}. <br/>
              Thank you for choosing our services.
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
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b bg-muted/50">
        <h2 className="text-sm font-black uppercase tracking-widest">Proposal Preview</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={handleSendEmail} disabled={isSending} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to Client
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-100/50 p-4 md:p-8 print:p-0 print:bg-white custom-scrollbar">
        <div id="proposal-content" className="bg-white mx-auto shadow-2xl p-6 md:p-12 w-full max-w-[800px] min-h-[1100px] print:shadow-none print:w-full print:p-0 mb-8" style={{ fontFamily: "'Segoe UI', sans-serif", color: '#222' }}>
          {/* HEADER */}
          <div className="flex justify-between border-b-2 border-black pb-4 mb-6">
            <div>
              <div className="text-2xl font-bold">{data.company_name}</div>
              <div>{data.company_email}</div>
              <div>{data.company_phone}</div>
              <div className="text-xs">GSTIN: {data.company_gstin}</div>
            </div>
            <div className="text-right">
              <div><strong>Date:</strong> {data.date}</div>
              <div><strong>Proposal ID:</strong> {data.proposal_id}</div>
            </div>
          </div>

          {/* CLIENT */}
          <div className="mt-6">
            <div className="font-semibold mb-1">To:</div>
            <div>{data.client_name}</div>
            <div>{data.client_company}</div>
            <div>{data.client_email}</div>
            <div>{data.client_phone}</div>
          </div>

          {/* SERVICE */}
          <div className="mt-6">
            <div className="font-semibold mb-1">Service Requested:</div>
            <div className="text-lg font-medium text-primary">
              {data.service_name || (data.service_type ? data.service_type.replace('_', ' ').toUpperCase() : 'General Service')}
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="mt-6">
            <div className="font-semibold mb-1">Project Description:</div>
            <div className="text-sm text-justify leading-relaxed">{data.description}</div>
          </div>

          {/* PRICING TABLE */}
          <div className="mt-8">
            <div className="font-semibold mb-2">Pricing Details:</div>
            <table className="w-full border-collapse border border-black">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-black p-3 text-left text-xs uppercase font-black">Item</th>
                  <th className="border border-black p-3 text-left text-xs uppercase font-black">Description</th>
                  <th className="border border-black p-3 text-right text-xs uppercase font-black w-32">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="border border-black p-3 text-sm font-semibold">{item.name}</td>
                    <td className="border border-black p-3 text-sm">{item.desc}</td>
                    <td className="border border-black p-3 text-right text-sm font-mono">₹{item.price.toLocaleString()}</td>
                  </tr>
                ))}

                <tr className="bg-slate-50/50">
                  <td colSpan={2} className="border border-black p-3 text-right font-bold text-sm">Subtotal</td>
                  <td className="border border-black p-3 text-right text-sm font-mono font-bold">₹{data.subtotal.toLocaleString()}</td>
                </tr>

                <tr>
                  <td colSpan={2} className="border border-black p-3 text-right text-sm italic">GST ({data.gst_percent}%)</td>
                  <td className="border border-black p-3 text-right text-sm font-mono">₹{data.gst_amount.toLocaleString()}</td>
                </tr>

                <tr className="bg-slate-900 text-white print:bg-slate-200 print:text-black">
                  <td colSpan={2} className="border border-black p-3 text-right font-black text-lg uppercase">Total</td>
                  <td className="border border-black p-3 text-right text-lg font-black font-mono">₹{data.total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TERMS */}
          <div className="mt-8">
            <div className="font-semibold mb-2">Terms & Conditions:</div>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {data.terms.map((term: string, idx: number) => (
                <li key={idx}>{term}</li>
              ))}
            </ul>
          </div>

          {/* SIGNATURE */}
          <div className="mt-12 flex justify-between items-end">
            <div className="w-48">
              <div className="border-t border-black pt-2 text-center text-xs font-bold uppercase">Client Signature</div>
            </div>
            <div className="w-48">
              <div className="border-t border-black pt-2 text-center text-xs font-bold uppercase">Authorized Signature</div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-16 pt-4 border-t border-slate-100 text-[10px] text-slate-400 text-center uppercase tracking-widest">
            Thank you for your business. This is a system-generated proposal.
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.3);
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #proposal-content, #proposal-content * {
            visibility: visible;
          }
          #proposal-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  )
}
