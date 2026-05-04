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
    status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    currency?: string;
    items: InvoiceItem[];
    discount?: number;
    notes?: string;
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
  const currencySymbol = data.currency === 'INR' ? '₹' : '$';
  
  // Calculations
  const subtotal = data.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
  const totalTax = data.items.reduce((acc, item) => {
    const itemTotal = item.quantity * item.rate;
    return acc + (itemTotal * (item.taxRate / 100));
  }, 0);
  const discountAmount = data.discount || 0;
  const grandTotal = subtotal + totalTax - discountAmount;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'overdue': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />;
      case 'overdue': return <AlertCircle className="w-3.5 h-3.5 mr-1.5" />;
      default: return <Clock className="w-3.5 h-3.5 mr-1.5" />;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-card text-card-foreground border rounded-2xl shadow-2xl overflow-hidden print:border-0 print:shadow-none print:rounded-none">
      {/* 1. BRAND HEADER */}
      <div className="bg-primary/5 p-8 sm:p-12 border-b">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                <div className="h-6 w-6 bg-primary-foreground rounded-sm rotate-45" />
              </div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground">ECRAFTZ</h1>
            </div>
            <div className="space-y-1.5 text-sm text-muted-foreground max-w-xs">
              <p className="flex items-start gap-2">
                <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                NV Tower, 20/265, A9, First floor, Kallai, Kozhikode, Kerala 673003
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 text-primary" />
                +91 79949 71118
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0 text-primary" />
                mail@ecraftz.in
              </p>
              <p className="flex items-center gap-2">
                <Globe className="w-4 h-4 shrink-0 text-primary" />
                www.ecraftz.in
              </p>
            </div>
          </div>

          <div className="text-left md:text-right space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Invoice</h2>
              <p className="text-3xl font-mono font-black text-foreground">#{data.invoice_number}</p>
            </div>
            
            <div className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
              getStatusStyle(data.status)
            )}>
              {getStatusIcon(data.status)}
              {data.status}
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 sm:p-12 space-y-12">
        {/* 2. DATES & INFO */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-y border-dashed border-border/50">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Issued Date</p>
            <p className="font-bold">{format(new Date(data.issued_at), 'MMMM d, yyyy')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Due Date</p>
            <p className="font-bold">{format(new Date(data.due_date), 'MMMM d, yyyy')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project</p>
            <p className="font-bold">{data.project?.name || 'General Services'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Billing Type</p>
            <p className="font-bold">{data.project?.billing_type || 'Fixed Rate'}</p>
          </div>
        </div>

        {/* 3. CLIENT SECTION */}
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Billed To</h3>
            <div className="space-y-2">
              <p className="text-2xl font-black text-foreground">{data.client.name}</p>
              {data.client.company && (
                <p className="text-lg font-bold text-muted-foreground">{data.client.company}</p>
              )}
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {data.client.email}
                </p>
                <p className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
                  {data.client.address || 'Address not available'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. BILLING TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-primary/20">
                <th className="py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Description</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-center">Qty</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-right">Rate</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-right">Tax</th>
                <th className="py-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.items.map((item) => {
                const itemTotal = item.quantity * item.rate;
                return (
                  <tr key={item.id} className="group hover:bg-muted/30 transition-colors">
                    <td className="py-6">
                      <p className="font-bold text-foreground leading-none">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{data.project?.service_type || 'IT Consultation'}</p>
                    </td>
                    <td className="py-6 px-4 text-center font-medium">{item.quantity}</td>
                    <td className="py-6 px-4 text-right font-medium">
                      {currencySymbol}{item.rate.toLocaleString()}
                    </td>
                    <td className="py-6 px-4 text-right text-muted-foreground text-sm">
                      {item.taxRate}%
                    </td>
                    <td className="py-6 text-right font-black text-foreground">
                      {currencySymbol}{itemTotal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. SUMMARY & PAYMENT */}
        <div className="flex flex-col md:flex-row justify-between gap-12 pt-8">
          {/* Payment Details */}
          <div className="flex-1 space-y-6 max-w-sm">
            <div className="p-6 rounded-2xl bg-muted/30 border border-dashed border-border flex flex-col gap-4">
              <div className="flex items-center gap-3 text-primary">
                <CreditCard className="w-5 h-5" />
                <h4 className="font-black text-sm uppercase tracking-wider">Payment Information</h4>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-card border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">UPI ID</p>
                  <p className="font-mono font-black text-primary">ecraftz@upi</p>
                </div>
                <div className="p-3 rounded-xl bg-card border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Bank Transfer</p>
                  <p className="text-xs font-bold leading-relaxed">
                    A/C: 50200067891234<br/>
                    IFSC: HDFC0001234<br/>
                    Bank: HDFC Bank, Kozhikode
                  </p>
                </div>
              </div>
            </div>
            {data.notes && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Additional Notes</p>
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  {data.notes}
                </p>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="w-full md:w-80 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Subtotal</span>
              <span className="font-bold">{currencySymbol}{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">Estimated Tax</span>
              <span className="font-bold text-muted-foreground">+{currencySymbol}{totalTax.toLocaleString()}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-sm text-emerald-500">
                <span className="font-medium">Discount</span>
                <span className="font-bold">-{currencySymbol}{discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between items-center pt-2">
              <span className="text-lg font-black text-foreground">Amount Due</span>
              <span className="text-3xl font-black text-primary">
                {currencySymbol}{grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. FOOTER */}
      <div className="bg-primary/5 p-8 border-t">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          <div className="space-y-1">
            <p className="text-sm font-black text-foreground">Terms & Conditions</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
              Payment is due within 7 days. Please include the invoice number in your payment reference.
              Late payments may be subject to a 2% monthly fee.
            </p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-sm font-black text-primary mb-1">Thank you for choosing ECRAFTZ</p>
            <p className="text-[10px] text-muted-foreground">Questions? Reach out to mail@ecraftz.in</p>
          </div>
        </div>
      </div>
    </div>
  );
};
