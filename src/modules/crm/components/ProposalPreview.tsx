import React from 'react'
import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'

interface ProposalPreviewProps {
  data: any
  onClose: () => void
}

export function ProposalPreview({ data, onClose }: ProposalPreviewProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b bg-muted/50">
        <h2 className="text-sm font-black uppercase tracking-widest">Proposal Preview</h2>
        <div className="flex gap-2">
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
            <div className="text-lg font-medium text-primary">{data.service_name}</div>
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
