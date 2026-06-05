import React from 'react';
import { format } from 'date-fns';
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  CreditCard, 
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseClientMetadata } from '@/lib/metadataFallback';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  taxRate: number;
}

export interface ProfessionalInvoiceProps {
  data: {
    invoice_number: string;
    issued_at: string;
    due_date: string;
    status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
    currency?: string;
    items: InvoiceItem[];
    discount?: number;
    notes?: string;
    paid_amount?: number;
    client: {
      name: string;
      company?: string;
      email: string;
      address?: string;
    };
    project?: {
      name: string;
      service_type?: string;
      billing_type?: string;
    };
  };
}

export const ProfessionalInvoice: React.FC<ProfessionalInvoiceProps> = ({ data }) => {
  const currencySymbol = '₹';
  
  // Calculations
  const subtotal = data.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
  const totalTax = data.items.reduce((acc, item) => {
    const itemTotal = item.quantity * item.rate;
    return acc + (itemTotal * (item.taxRate / 100));
  }, 0);
  const discountAmount = data.discount || 0;
  const grandTotal = subtotal + totalTax - discountAmount;
  const paidAmount = data.paid_amount || 0;
  const balanceDue = Math.max(0, grandTotal - paidAmount);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]';
      case 'partially_paid': return 'bg-sky-500 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)]';
      case 'overdue': return 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]';
      default: return 'bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />;
      case 'partially_paid': return <CreditCard className="w-3.5 h-3.5 mr-1.5" />;
      case 'overdue': return <AlertCircle className="w-3.5 h-3.5 mr-1.5" />;
      default: return <Clock className="w-3.5 h-3.5 mr-1.5" />;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white text-slate-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden print:shadow-none print:w-full">
      {/* TOP DECORATIVE STRIP */}
      <div className="h-2 bg-gradient-to-r from-primary via-blue-600 to-emerald-500" />

      <div className="p-8 sm:p-16">
        {/* 1. HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <img src="/ecraftzlogo.png" alt="Logo" className="h-16 w-auto object-contain" />
            </div>
            
            <div className="space-y-2 text-xs text-slate-500 font-medium leading-relaxed max-w-xs">
              <p className="flex items-start gap-3">
                <Building2 className="w-4 h-4 shrink-0 text-slate-900" />
                20/265, Kallai, Kozhikode, Kerala 673003
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-900" />
                  +91 79949 71118
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-900" />
                  contact@vbecraftz.com
                </p>
              </div>
              <p className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-900" />
                www.vbecraftz.com
              </p>
            </div>
          </div>

          <div className="text-left md:text-right space-y-6">
            <div className="space-y-1">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Tax Invoice</h2>
              <p className="text-5xl font-black text-slate-900 tracking-tighter">#{data.invoice_number}</p>
            </div>
            
            <div className="flex flex-col md:items-end gap-2">
               <div className={cn(
                "inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                getStatusStyle(data.status)
              )}>
                {getStatusIcon(data.status)}
                {data.status}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Status: Finalized</p>
            </div>
          </div>
        </div>

        {/* 2. INFO BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-8 rounded-3xl bg-slate-50 border border-slate-100 mb-16">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Issued On</p>
            <p className="text-sm font-black text-slate-900">{format(new Date(data.issued_at), 'MMM dd, yyyy')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due By</p>
            <p className="text-sm font-black text-slate-900">{format(new Date(data.due_date), 'MMM dd, yyyy')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Ref</p>
            <p className="text-sm font-black text-slate-900 truncate">{data.project?.name || 'General Services'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Currency</p>
            <p className="text-sm font-black text-slate-900">INR ({currencySymbol})</p>
          </div>
        </div>

        {/* 3. CLIENT SECTION */}
        <div className="mb-16">
          <div className="inline-block px-4 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-t-lg">
            Recipient
          </div>
          <div className="p-8 border-2 border-slate-900 rounded-b-2xl rounded-r-2xl grid md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <p className="text-4xl font-black text-slate-900 tracking-tight">{data.client.name}</p>
              {data.client.company && (
                <p className="text-xl font-bold text-slate-500">{data.client.company}</p>
              )}
            </div>
            <div className="space-y-3 text-sm text-slate-500 font-medium">
              <p className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-900" />
                {data.client.email}
              </p>
              <p className="flex items-start gap-3 leading-relaxed">
                <Building2 className="w-4 h-4 mt-1 shrink-0 text-slate-900" />
                {parseClientMetadata(data.client).cleanAddress || 'Standard Service Location'}
              </p>
            </div>
          </div>
        </div>

        {/* 4. BILLING TABLE */}
        <div className="mb-16">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-4 border-slate-900">
                <th className="py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Description</th>
                <th className="py-6 px-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-center">Qty</th>
                <th className="py-6 px-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Unit Price</th>
                <th className="py-6 px-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Tax (%)</th>
                <th className="py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((item) => {
                const itemTotal = item.quantity * item.rate;
                return (
                  <tr key={item.id} className="group">
                    <td className="py-8 pr-4">
                      <p className="text-lg font-black text-slate-900">{item.description}</p>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {data.project?.service_type || 'Professional Service'}
                      </p>
                    </td>
                    <td className="py-8 px-4 text-center font-black text-slate-900">{item.quantity}</td>
                    <td className="py-8 px-4 text-right font-black text-slate-900">
                      {currencySymbol}{item.rate.toLocaleString()}
                    </td>
                    <td className="py-8 px-4 text-right font-bold text-slate-400">
                      {item.taxRate}%
                    </td>
                    <td className="py-8 text-right font-black text-slate-900 text-xl tracking-tighter">
                      {currencySymbol}{itemTotal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. FOOTER SUMMARY */}
        <div className="grid md:grid-cols-2 gap-16 pt-12 border-t-2 border-slate-100">
          <div className="space-y-8">
            <div className="p-8 rounded-3xl bg-slate-900 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3 opacity-60">
                  <CreditCard className="w-5 h-5" />
                  <h4 className="font-black text-[10px] uppercase tracking-[0.3em]">Payment Instructions</h4>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">UPI Transfer</p>
                    <p className="font-mono font-black text-lg text-emerald-400">payment@upi</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bank Transfer</p>
                    <p className="text-xs font-bold leading-relaxed opacity-80">
                      HDFC Bank, Kozhikode branch<br/>
                      A/C: 50200067891234 | IFSC: HDFC0001234
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {data.notes && (
              <div className="space-y-2 px-4 border-l-4 border-primary">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrative Notes</p>
                <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
                  "{data.notes}"
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6 bg-slate-50 p-8 rounded-3xl">
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-slate-400 uppercase tracking-widest">Subtotal</span>
              <span className="text-slate-900">{currencySymbol}{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-slate-400 uppercase tracking-widest">Tax Component</span>
              <span className="text-slate-400">+{currencySymbol}{totalTax.toLocaleString()}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                <span className="uppercase tracking-widest">Loyalty Discount</span>
                <span>-{currencySymbol}{discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="h-px bg-slate-200" />
            <div className="flex justify-between items-end py-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block">Total Amount Due</span>
                <span className="text-5xl font-black text-slate-900 tracking-tighter">
                  {currencySymbol}{grandTotal.toLocaleString()}
                </span>
              </div>
            </div>
            
            {(data.paid_amount || 0) > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Already Paid</span>
                  <span className="font-black text-emerald-600">-{currencySymbol}{data.paid_amount?.toLocaleString()}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center shadow-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Balance Remaining</span>
                  <span className="text-2xl font-black">{currencySymbol}{balanceDue.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-slate-900 p-12 text-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-50" />
        <div className="relative z-10 space-y-6">
          <p className="text-2xl font-black tracking-tight">Thank you for your business.</p>
          <div className="flex flex-col md:flex-row justify-center items-center gap-8 text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
             <span>Terms: Net 7 Days</span>
             <span className="h-1 w-1 bg-white rounded-full hidden md:block" />
             <span>Overdue interest: 2% monthly</span>
             <span className="h-1 w-1 bg-white rounded-full hidden md:block" />
             <span>Support: contact@vbecraftz.com</span>
          </div>
        </div>
      </div>
    </div>
  );
};
