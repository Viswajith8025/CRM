import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Printer, Download, ArrowLeft, Send, Loader2 } from "lucide-react"
import { useCRMStore } from "../crmStore"
import { LoadingState } from "@/components/shared/LoadingState"
import { toast } from "sonner"
import { ProposalPreview } from "../components/ProposalPreview"
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { sendEmail } from "@/lib/email"

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getProposalById } = useCRMStore()
  const [proposal, setProposal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    async function load() {
      if (!id) return
      const data = await getProposalById(id)
      if (data) {
        setProposal(data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <LoadingState />
  if (!proposal) return <div>Proposal not found</div>

  const handlePrint = () => {
    window.print()
  }

  const handleSendEmail = async () => {
    const data = proposal.content;
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
                  <div class="logo-box"><div class="logo-inner"></div></div>
                  <h1 class="brand-name">${data.company_name}</h1>
                  <p class="brand-tag">Digital Solutions</p>
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
               <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; opacity: 0.4;">Proprietary & Confidential • ECRAFTZ Digital Solutions</p>
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

  const handleExportPDF = () => {
    import('@/lib/exportUtils').then(({ exportProposalToPDF }) => {
      exportProposalToPDF(proposal)
    })
  }

  return (
    <PageWrapper 
      title={`Proposal Details`} 
      description={`Review and manage proposal #${proposal.id.split('-')[0].toUpperCase()}`}
      className="max-w-6xl mx-auto print:p-0"
      actions={
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export as PDF
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={handleSendEmail} disabled={isSending}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Dispatch Proposal
          </Button>
        </div>
      }
    >
      <div className="mt-8">
        <ProposalPreview data={proposal.content} onClose={() => navigate('/clients')} />
      </div>
    </PageWrapper>
  )
}
