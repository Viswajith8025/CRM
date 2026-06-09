import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toWords } from 'number-to-words'; // We'll assume or mock this. If not, we'll write a small converter.

// A simple utility to convert numbers to Indian Rupee words (fallback if library missing)
const numToWords = (num: number): string => {
  try {
    const { toWords } = require('number-to-words');
    return toWords(num).replace(/-/g, ' ') + ' Only';
  } catch {
    return 'Amount in words not available';
  }
};

export interface InvoiceItem {
  id: string;
  item_name: string;
  description?: string;
  hsn_sac?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  ugst_amount?: number;
  total_amount?: number;
  gst_rate?: number; // Added for display
}

export interface AccountingInvoiceProps {
  data: {
    document_type?: 'Estimate' | 'Proforma Invoice' | 'Tax Invoice' | 'GST Invoice' | 'Credit Note';
    invoice_number: string;
    estimate_number?: string;
    date: string;
    due_date: string;
    status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
    place_of_supply?: string;
    currency?: string;
    payment_terms?: string;
    items: InvoiceItem[];
    subtotal?: number;
    discount?: number;
    total_tax?: number;
    round_off?: number;
    grand_total?: number;
    amount_paid?: number;
    amount_due?: number;
    notes?: string;
    terms?: string;
    client: {
      name: string;
      company?: string;
      email: string;
      phone?: string;
      address?: string;
      state?: string;
      country?: string;
      pincode?: string;
      gstin?: string;
      contact_person?: string;
    };
    company?: {
      logo?: string;
      name: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
      gstin: string;
      phone: string;
      email: string;
      website: string;
    };
    bank_details?: {
      account_name: string;
      bank_name: string;
      branch: string;
      account_number: string;
      ifsc: string;
      swift: string;
      pan: string;
      tan?: string;
    };
    signatures?: {
      prepared_by?: string;
      approved_by?: string;
      authorized_sign?: string; // URL to image
      stamp?: string; // URL to image
    }
  };
}

export const AccountingInvoiceTemplate: React.FC<AccountingInvoiceProps> = ({ data }) => {
  const currencySymbol = data.currency || '₹';
  const docType = data.document_type || 'Tax Invoice';

  // Calculate totals if missing
  const subtotal = data.subtotal ?? data.items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalUGST = 0;

  data.items.forEach(item => {
    totalCGST += item.cgst_amount || 0;
    totalSGST += item.sgst_amount || 0;
    totalIGST += item.igst_amount || 0;
    totalUGST += item.ugst_amount || 0;
  });

  const grandTotal = data.grand_total ?? (subtotal + totalCGST + totalSGST + totalIGST + totalUGST - (data.discount || 0));

  return (
    <div className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-black p-[10mm] font-sans border border-gray-300 shadow-md print:shadow-none print:border-none">
      
      {/* DOCUMENT TITLE */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold uppercase tracking-widest border-b-2 border-black inline-block pb-1">
          {docType}
        </h1>
      </div>

      <div className="border border-black flex flex-col">
        {/* HEADER SECTION - Split in 2 */}
        <div className="flex border-b border-black">
          {/* Company Details (Left) */}
          <div className="w-1/2 p-3 border-r border-black">
            {data.company?.logo && (
              <img src={data.company.logo} alt="Company Logo" className="h-12 w-auto mb-2 object-contain" />
            )}
            <h2 className="font-bold text-base uppercase">{data.company?.name || 'Your Company Name'}</h2>
            <p className="text-xs mt-1 leading-tight whitespace-pre-wrap">
              {data.company?.address || '123 Business Street'}<br />
              {data.company?.city || 'City'}, {data.company?.state || 'State'} - {data.company?.pincode || '000000'}<br />
              {data.company?.country || 'India'}<br />
              <span className="font-semibold mt-1 block">GSTIN/UIN: {data.company?.gstin || '29XXXXX0000X1Z5'}</span>
              <span className="block mt-1">Ph: {data.company?.phone || '+91 0000000000'} | Email: {data.company?.email || 'info@company.com'}</span>
              {data.company?.website && <span>Web: {data.company.website}</span>}
            </p>
          </div>

          {/* Invoice Info (Right) */}
          <div className="w-1/2 flex flex-col">
            <div className="flex border-b border-black">
              <div className="w-1/2 p-2 border-r border-black">
                <p className="text-[10px] text-gray-600 font-semibold">Invoice No.</p>
                <p className="text-sm font-bold">{data.invoice_number}</p>
              </div>
              <div className="w-1/2 p-2">
                <p className="text-[10px] text-gray-600 font-semibold">Dated</p>
                <p className="text-sm font-bold">{format(new Date(data.date), 'dd-MMM-yyyy')}</p>
              </div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-1/2 p-2 border-r border-black">
                <p className="text-[10px] text-gray-600 font-semibold">Place of Supply</p>
                <p className="text-xs font-bold">{data.place_of_supply || data.client?.state || '-'}</p>
              </div>
              <div className="w-1/2 p-2">
                <p className="text-[10px] text-gray-600 font-semibold">Due Date</p>
                <p className="text-xs font-bold">{format(new Date(data.due_date), 'dd-MMM-yyyy')}</p>
              </div>
            </div>
            <div className="flex flex-1">
              <div className="w-1/2 p-2 border-r border-black">
                <p className="text-[10px] text-gray-600 font-semibold">Terms of Payment</p>
                <p className="text-xs">{data.payment_terms || 'Immediate'}</p>
              </div>
              <div className="w-1/2 p-2">
                <p className="text-[10px] text-gray-600 font-semibold">Reference/Estimate No.</p>
                <p className="text-xs">{data.estimate_number || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* BILL TO SECTION */}
        <div className="flex border-b border-black">
          <div className="w-1/2 p-3 border-r border-black">
            <p className="text-[10px] text-gray-600 font-semibold mb-1">Billed To (Buyer)</p>
            <h3 className="font-bold text-sm uppercase">{data.client.company || data.client.name}</h3>
            {data.client.contact_person && (
              <p className="text-xs font-semibold">Attn: {data.client.contact_person}</p>
            )}
            <p className="text-xs mt-1 leading-tight whitespace-pre-wrap">
              {data.client.address}<br />
              {data.client.state && `${data.client.state} `}{data.client.pincode && `- ${data.client.pincode}`}<br />
              {data.client.country && `${data.client.country}`}
            </p>
            <p className="text-xs mt-2">
              <span className="font-semibold block">GSTIN/UIN: {data.client.gstin || 'Unregistered'}</span>
              <span>State: {data.client.state || '-'}</span>
            </p>
            {(data.client.phone || data.client.email) && (
              <p className="text-xs mt-1">
                {data.client.phone && `Ph: ${data.client.phone} `}
                {data.client.email && `Email: ${data.client.email}`}
              </p>
            )}
          </div>
          <div className="w-1/2 p-3">
            <p className="text-[10px] text-gray-600 font-semibold mb-1">Status</p>
            <p className="text-sm font-bold uppercase">{data.status.replace('_', ' ')}</p>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-black bg-gray-50">
                <th className="p-2 border-r border-black font-semibold text-center w-10">Sl No.</th>
                <th className="p-2 border-r border-black font-semibold">Description of Goods / Services</th>
                <th className="p-2 border-r border-black font-semibold text-center w-20">HSN/SAC</th>
                <th className="p-2 border-r border-black font-semibold text-center w-16">Qty</th>
                <th className="p-2 border-r border-black font-semibold text-right w-24">Rate</th>
                {data.items.some(i => i.discount_amount) && (
                  <th className="p-2 border-r border-black font-semibold text-right w-20">Discount</th>
                )}
                <th className="p-2 border-r border-black font-semibold text-center w-16">GST %</th>
                <th className="p-2 font-semibold text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {data.items.map((item, idx) => {
                const hasDiscountCol = data.items.some(i => i.discount_amount);
                const lineAmount = (item.quantity * item.unit_price) - (item.discount_amount || 0);
                
                return (
                  <tr key={item.id} className="border-b border-gray-200 last:border-b-0">
                    <td className="p-2 border-r border-black text-center">{idx + 1}</td>
                    <td className="p-2 border-r border-black">
                      <p className="font-bold">{item.item_name}</p>
                      {item.description && <p className="text-[10px] text-gray-600 mt-1 whitespace-pre-wrap">{item.description}</p>}
                    </td>
                    <td className="p-2 border-r border-black text-center">{item.hsn_sac || '-'}</td>
                    <td className="p-2 border-r border-black text-center font-bold">{item.quantity}</td>
                    <td className="p-2 border-r border-black text-right">{item.unit_price.toFixed(2)}</td>
                    {hasDiscountCol && (
                      <td className="p-2 border-r border-black text-right">{item.discount_amount ? item.discount_amount.toFixed(2) : '-'}</td>
                    )}
                    <td className="p-2 border-r border-black text-center">{item.gst_rate || 0}%</td>
                    <td className="p-2 text-right font-bold">{lineAmount.toFixed(2)}</td>
                  </tr>
                );
              })}
              
              {/* Spacer row to push totals down if few items */}
              <tr className="h-10 border-t border-black">
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                {data.items.some(i => i.discount_amount) && <td className="border-r border-black"></td>}
                <td className="border-r border-black"></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* TOTALS SECTION */}
        <div className="flex border-t border-black">
          {/* Notes / Words (Left) */}
          <div className="w-3/5 p-3 border-r border-black flex flex-col justify-between">
            <div>
              <p className="text-[10px] text-gray-600 font-semibold">Amount Chargeable (in words)</p>
              <p className="text-xs font-bold uppercase capitalize-first italic">
                {currencySymbol} {numToWords(Math.round(grandTotal))}
              </p>
            </div>
            {data.notes && (
              <div className="mt-4">
                <p className="text-[10px] text-gray-600 font-semibold">Notes / Remarks</p>
                <p className="text-xs whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
          </div>
          
          {/* Calculations (Right) */}
          <div className="w-2/5">
            <div className="flex justify-between p-2 border-b border-black text-xs">
              <span className="font-semibold">Subtotal</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            {totalCGST > 0 && (
              <div className="flex justify-between p-2 border-b border-gray-200 text-xs">
                <span>Add: CGST</span>
                <span>{totalCGST.toFixed(2)}</span>
              </div>
            )}
            {totalSGST > 0 && (
              <div className="flex justify-between p-2 border-b border-gray-200 text-xs">
                <span>Add: SGST</span>
                <span>{totalSGST.toFixed(2)}</span>
              </div>
            )}
            {totalIGST > 0 && (
              <div className="flex justify-between p-2 border-b border-gray-200 text-xs">
                <span>Add: IGST</span>
                <span>{totalIGST.toFixed(2)}</span>
              </div>
            )}
            {totalUGST > 0 && (
              <div className="flex justify-between p-2 border-b border-gray-200 text-xs">
                <span>Add: UGST</span>
                <span>{totalUGST.toFixed(2)}</span>
              </div>
            )}
            {(data.round_off !== undefined && data.round_off !== 0) && (
              <div className="flex justify-between p-2 border-b border-gray-200 text-xs">
                <span>Round Off</span>
                <span>{data.round_off > 0 ? '+' : ''}{data.round_off.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between p-2 bg-gray-50 text-sm">
              <span className="font-bold">Total</span>
              <span className="font-bold">{currencySymbol}{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* BANK & SIGNATURE SECTION */}
        <div className="flex border-t border-black">
          {/* Bank Details (Left) */}
          <div className="w-1/2 p-3 border-r border-black">
            <p className="text-[10px] text-gray-600 font-semibold underline mb-1">Company's Bank Details</p>
            <div className="text-xs space-y-0.5">
              <p><span className="w-24 inline-block">Account Name</span>: <span className="font-bold">{data.bank_details?.account_name || '-'}</span></p>
              <p><span className="w-24 inline-block">Bank Name</span>: <span>{data.bank_details?.bank_name || '-'}</span></p>
              <p><span className="w-24 inline-block">A/C No.</span>: <span className="font-bold">{data.bank_details?.account_number || '-'}</span></p>
              <p><span className="w-24 inline-block">Branch & IFSC</span>: <span>{data.bank_details?.branch || '-'} & {data.bank_details?.ifsc || '-'}</span></p>
              <p><span className="w-24 inline-block">SWIFT Code</span>: <span>{data.bank_details?.swift || '-'}</span></p>
            </div>
            
            <div className="mt-4 text-xs space-y-0.5">
              <p><span className="w-24 inline-block">Company PAN</span>: <span className="font-bold uppercase">{data.bank_details?.pan || '-'}</span></p>
              {data.bank_details?.tan && <p><span className="w-24 inline-block">Company TAN</span>: <span className="font-bold uppercase">{data.bank_details?.tan}</span></p>}
            </div>
          </div>

          {/* Signatures (Right) */}
          <div className="w-1/2 flex flex-col justify-between p-3 relative">
            <div>
              <p className="text-[10px] text-gray-600 font-semibold mb-1">Declaration</p>
              <p className="text-[9px] leading-tight text-justify">
                We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.
              </p>
            </div>
            
            <div className="mt-8 text-right flex flex-col items-end">
              <p className="text-xs font-bold mb-8">for {data.company?.name || 'Company Name'}</p>
              
              {data.signatures?.authorized_sign && (
                <img 
                  src={data.signatures.authorized_sign} 
                  alt="Signature" 
                  className="h-12 w-32 object-contain absolute bottom-12 right-4 opacity-80 mix-blend-multiply" 
                />
              )}
              {data.signatures?.stamp && (
                <img 
                  src={data.signatures.stamp} 
                  alt="Stamp" 
                  className="h-16 w-16 object-contain absolute bottom-10 right-32 opacity-50 mix-blend-multiply" 
                />
              )}

              <p className="text-[10px] font-semibold border-t border-black pt-1 w-48 text-center mt-2">
                Authorized Signatory
              </p>
            </div>
          </div>
        </div>

        {/* TERMS SECTION */}
        {data.terms && (
          <div className="border-t border-black p-3 text-[9px] text-gray-700">
            <span className="font-bold underline">Terms & Conditions:</span>
            <p className="whitespace-pre-wrap mt-1">{data.terms}</p>
          </div>
        )}
      </div>

      <p className="text-center text-[8px] text-gray-400 mt-2 print:block">
        This is a computer generated document and does not require physical signature.
      </p>
    </div>
  );
};
