import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Invoice } from '@/modules/billing'
import { format } from 'date-fns'

/**
 * CSV Export Logic
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) {
    console.error('No data to export')
    return
  }

  // Extract headers
  const headers = Object.keys(data[0])
  const csvRows = []

  // Add header row
  csvRows.push(headers.map(header => `"${header}"`).join(','))

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      let value = row[header]
      
      // Handle objects/arrays (e.g. nested client object)
      if (value && typeof value === 'object') {
        value = JSON.stringify(value)
      }
      
      // Escape double quotes and enclose in double quotes to handle commas within values
      const escapedValue = String(value ?? '').replace(/"/g, '""')
      return `"${escapedValue}"`
    })
    csvRows.push(values.join(','))
  }

  const csvString = csvRows.join('\n')
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  
  const link = document.createElement('a')
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * PDF Export Logic (Invoices) - Professional Design Version
 */
export function exportInvoiceToPDF(invoice: Invoice) {
  // Create a new PDF document (A4 portrait)
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  // Design Constants
  const colors = {
    primary: [37, 99, 235] as [number, number, number], // Blue-600
    slate900: [15, 23, 42] as [number, number, number],
    slate400: [148, 163, 184] as [number, number, number],
    slate500: [100, 116, 139] as [number, number, number],
    slate100: [241, 245, 249] as [number, number, number],
    slate50: [248, 250, 252] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    emerald600: [5, 150, 105] as [number, number, number]
  }

  const currencySymbol = invoice.currency === 'INR' ? 'Rs.' : '$'
  
  // 1. TOP DECORATIVE STRIP
  doc.setFillColor(...colors.primary)
  doc.rect(0, 0, pageWidth, 2, 'F')

  // 2. HEADER SECTION
  // Logo
  doc.setFillColor(...colors.slate900)
  doc.roundedRect(14, 15, 14, 14, 3, 3, 'F')
  doc.setFillColor(...colors.white)
  doc.roundedRect(17.5, 18.5, 7, 7, 1.5, 1.5, 'F')

  // Company Name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...colors.slate900)
  doc.text('ECRAFTZ', 32, 23)
  
  doc.setFontSize(7)
  doc.setTextColor(...colors.primary)
  doc.text('DIGITAL SOLUTIONS', 32, 27, { charSpace: 1 })

  // Invoice Number & Status
  doc.setFontSize(8)
  doc.setTextColor(...colors.slate400)
  doc.text('TAX INVOICE', pageWidth - 14, 20, { align: 'right' })
  
  doc.setFontSize(32)
  doc.setTextColor(...colors.slate900)
  doc.text(`#${invoice.invoice_number}`, pageWidth - 14, 32, { align: 'right' })

  // Status Badge
  const status = invoice.status.toUpperCase()
  doc.setFontSize(8)
  doc.setFillColor(...(invoice.status === 'paid' ? colors.emerald600 : [245, 158, 11]))
  doc.roundedRect(pageWidth - 40, 36, 26, 6, 3, 3, 'F')
  doc.setTextColor(...colors.white)
  doc.text(status, pageWidth - 27, 40.5, { align: 'center' })

  // 3. COMPANY CONTACT INFO
  doc.setFontSize(7)
  doc.setTextColor(...colors.slate500)
  const contactY = 38
  doc.text('NV Tower, 20/265, A9, Kallai, Kozhikode, 673003', 14, contactY)
  doc.text('+91 79949 71118  |  mail@ecraftz.in  |  www.ecraftz.in', 14, contactY + 4)

  // 4. INFO BAR (Date, Project, etc)
  const barY = 55
  doc.setFillColor(...colors.slate50)
  doc.setDrawColor(...colors.slate100)
  doc.roundedRect(14, barY, pageWidth - 28, 18, 4, 4, 'FD')

  const colWidth = (pageWidth - 28) / 4
  const barLabelY = barY + 6
  const barValueY = barY + 12

  doc.setFontSize(6)
  doc.setTextColor(...colors.slate400)
  doc.text('ISSUED ON', 22, barLabelY)
  doc.text('DUE BY', 22 + colWidth, barLabelY)
  doc.text('PROJECT REF', 22 + colWidth * 2, barLabelY)
  doc.text('CURRENCY', 22 + colWidth * 3, barLabelY)

  doc.setFontSize(9)
  doc.setTextColor(...colors.slate900)
  doc.setFont('helvetica', 'bold')
  doc.text(format(new Date(invoice.issued_at), 'MMM dd, yyyy'), 22, barValueY)
  doc.text(format(new Date(invoice.due_date), 'MMM dd, yyyy'), 22 + colWidth, barValueY)
  doc.text(invoice.project?.name || 'General', 22 + colWidth * 2, barValueY)
  doc.text(`${invoice.currency || 'INR'} (${currencySymbol})`, 22 + colWidth * 3, barValueY)

  // 5. RECIPIENT SECTION
  const recipientY = 85
  doc.setFillColor(...colors.slate900)
  doc.roundedRect(14, recipientY, 25, 6, 2, 2, 'F')
  doc.setTextColor(...colors.white)
  doc.setFontSize(7)
  doc.text('RECIPIENT', 18, recipientY + 4.5)

  doc.setDrawColor(...colors.slate900)
  doc.setLineWidth(0.5)
  doc.roundedRect(14, recipientY + 6, pageWidth - 28, 25, 4, 4, 'D')

  doc.setFontSize(18)
  doc.setTextColor(...colors.slate900)
  doc.text(invoice.client?.name || 'Valued Client', 20, recipientY + 18)
  
  doc.setFontSize(8)
  doc.setTextColor(...colors.slate500)
  doc.setFont('helvetica', 'normal')
  const clientInfoX = 110
  doc.text(`Email: ${invoice.client?.email || 'N/A'}`, clientInfoX, recipientY + 14)
  doc.text(`Addr: ${invoice.client?.address || 'Standard Service Location'}`, clientInfoX, recipientY + 19)

  // 6. ITEMS TABLE
  const tableData = []
  const items = (invoice as any).items || []
  if (items.length > 0) {
    items.forEach((item: any) => {
      tableData.push([
        { content: item.description, styles: { fontStyle: 'bold', fontSize: 10 } },
        item.quantity,
        `${currencySymbol}${item.rate.toLocaleString()}`,
        `${item.taxRate}%`,
        { content: `${currencySymbol}${(item.quantity * item.rate).toLocaleString()}`, styles: { fontStyle: 'bold', fontSize: 11 } }
      ])
    })
  } else {
    tableData.push([
      { content: invoice.project?.name || 'Services Rendered', styles: { fontStyle: 'bold', fontSize: 10 } },
      1,
      `${currencySymbol}${invoice.amount.toLocaleString()}`,
      `${invoice.tax_rate || 0}%`,
      { content: `${currencySymbol}${invoice.amount.toLocaleString()}`, styles: { fontStyle: 'bold', fontSize: 11 } }
    ])
  }

  autoTable(doc, {
    startY: 120,
    head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Line Total']],
    body: tableData,
    theme: 'plain',
    headStyles: { 
      textColor: colors.slate400, 
      fontSize: 7, 
      fontStyle: 'bold',
      cellPadding: { bottom: 5 }
    },
    styles: { 
      textColor: colors.slate900, 
      fontSize: 9,
      cellPadding: 6
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    },
    didDrawPage: (data) => {
      // Add a line under the header
      doc.setDrawColor(...colors.slate900)
      doc.setLineWidth(0.8)
      doc.line(14, data.settings.startY + 8, pageWidth - 14, data.settings.startY + 8)
    }
  })

  // 7. FOOTER SUMMARY SECTION
  const finalY = (doc as any).lastAutoTable.finalY + 10
  
  // Payment Instructions Box
  doc.setFillColor(...colors.slate900)
  doc.roundedRect(14, finalY, 85, 40, 6, 6, 'F')
  doc.setTextColor(...colors.slate400)
  doc.setFontSize(6)
  doc.text('PAYMENT INSTRUCTIONS', 20, finalY + 8)
  
  doc.setTextColor(...colors.white)
  doc.setFontSize(7)
  doc.text('UPI TRANSFER', 20, finalY + 16)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('ecraftz@upi', 20, finalY + 22)
  
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...colors.slate400)
  doc.text('BANK TRANSFER', 20, finalY + 28)
  doc.setTextColor(...colors.white)
  doc.setFontSize(7)
  doc.text('HDFC Bank, Kozhikode | A/C: 50200067891234', 20, finalY + 33)
  doc.text('IFSC: HDFC0001234', 20, finalY + 37)

  // Totals Box
  const totalsX = pageWidth - 90
  doc.setFillColor(...colors.slate50)
  doc.roundedRect(totalsX, finalY, 76, 40, 6, 6, 'F')
  
  doc.setFontSize(7)
  doc.setTextColor(...colors.slate400)
  doc.text('SUBTOTAL', totalsX + 8, finalY + 10)
  doc.setTextColor(...colors.slate900)
  doc.text(`${currencySymbol}${invoice.amount.toLocaleString()}`, pageWidth - 22, finalY + 10, { align: 'right' })
  
  doc.setTextColor(...colors.slate400)
  doc.text('TAX COMPONENT', totalsX + 8, finalY + 16)
  doc.text(`+${currencySymbol}${(invoice as any).tax_amount || 0}`, pageWidth - 22, finalY + 16, { align: 'right' })
  
  doc.setDrawColor(...colors.slate100)
  doc.line(totalsX + 8, finalY + 22, pageWidth - 22, finalY + 22)
  
  doc.setTextColor(...colors.slate400)
  doc.setFontSize(6)
  doc.text('TOTAL AMOUNT DUE', totalsX + 8, finalY + 28)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...colors.slate900)
  doc.text(`${currencySymbol}${invoice.amount.toLocaleString()}`, totalsX + 8, finalY + 36)

  // 8. FINAL FOOTER
  doc.setFillColor(...colors.slate900)
  doc.rect(0, pageHeight - 25, pageWidth, 25, 'F')
  doc.setTextColor(...colors.white)
  doc.setFontSize(14)
  doc.text('Thank you for your business.', pageWidth / 2, pageHeight - 12, { align: 'center' })

  // Save the PDF
  doc.save(`${invoice.invoice_number}.pdf`)
}
