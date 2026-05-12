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
      const { exportProposalToPDF } = await import('@/lib/exportUtils')
      const pdfBase64 = exportProposalToPDF(proposal, true) as string

      // Use the premium HTML template (simplified for email but keeping the style)
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; margin-bottom: 20px;">Project Proposal: ${data.service_name}</h2>
          <p>Hello <strong>${data.client_name}</strong>,</p>
          <p>Please find the project proposal for <strong>${data.service_name}</strong> attached to this email as a PDF.</p>
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #2563eb;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">Total Investment</p>
            <p style="margin: 5px 0; font-size: 24px; font-weight: bold; color: #0f172a;">Rs.${data.total.toLocaleString()}</p>
          </div>
          <p>The proposal is valid until <strong>${data.valid_until || data.expiry_date || 'N/A'}</strong>.</p>
          <p>If you have any questions or would like to proceed, please reply to this email.</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>The ${data.company_name} Team</strong></p>
        </div>
      `

      await sendEmail({
        to: data.client_email,
        subject: `Proposal: ${data.service_name} - ${data.company_name}`,
        html,
        attachments: [
          {
            filename: `Proposal-${data.proposal_id || id?.split('-')[0]}.pdf`,
            content: pdfBase64
          }
        ]
      })

      toast.success("Proposal and PDF attachment sent successfully!")
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
