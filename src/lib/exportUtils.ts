import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Invoice } from '@/modules/billing/types'
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
 * PDF Export Logic (Invoices)
 */
export function exportInvoiceToPDF(invoice: Invoice, companyDetails?: any) {
  // Create a new PDF document (A4 portrait)
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Set fonts and colors
  doc.setFont('helvetica')
  const primaryColor = [37, 99, 235] as [number, number, number] // Blue-600
  const textColor = [55, 65, 81] as [number, number, number] // Gray-700
  
  // --- HEADER ---
  doc.setFontSize(24)
  doc.setTextColor(...primaryColor)
  doc.text('INVOICE', 14, 25)
  
  doc.setFontSize(10)
  doc.setTextColor(...textColor)
  doc.text(`Invoice Number: ${invoice.invoice_number}`, 14, 35)
  doc.text(`Date Issued: ${format(new Date(invoice.issued_at), 'MMM dd, yyyy')}`, 14, 40)
  doc.text(`Due Date: ${format(new Date(invoice.due_date), 'MMM dd, yyyy')}`, 14, 45)
  doc.text(`Status: ${invoice.status.toUpperCase()}`, 14, 50)

  // Company Details (Right aligned)
  const rightColX = pageWidth - 14
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(companyDetails?.name || 'ECRAFTZ', rightColX, 25, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (companyDetails?.address) {
    doc.text(companyDetails.address, rightColX, 30, { align: 'right' })
  }
  
  // --- BILL TO ---
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Bill To:', 14, 65)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.client?.name || 'Unknown Client', 14, 72)
  if (invoice.client?.address) {
    doc.text(invoice.client.address, 14, 77)
  }
  if (invoice.client?.email) {
    doc.text(invoice.client.email, 14, 82)
  }

  // --- ITEMS TABLE ---
  // In a real scenario, you'd map invoice line items here.
  // For this example, we'll assume a single line item for the project total
  // or a placeholder if no items array exists.
  
  const tableData = []
  if ((invoice as any).items && Array.isArray((invoice as any).items)) {
     (invoice as any).items.forEach((item: any) => {
        tableData.push([
           item.description,
           item.quantity,
           `$${item.unit_price.toFixed(2)}`,
           `$${(item.quantity * item.unit_price).toFixed(2)}`
        ])
     })
  } else {
     // Fallback to project name
     tableData.push([
       invoice.project?.name ? `Project: ${invoice.project.name}` : 'Services Rendered',
       1,
       `$${invoice.amount.toFixed(2)}`,
       `$${invoice.amount.toFixed(2)}`
     ])
  }

  autoTable(doc, {
    startY: 95,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255 },
    styles: { textColor: 50, fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    }
  })

  // --- TOTALS ---
  const finalY = (doc as any).lastAutoTable.finalY + 15
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Total Amount Due:', pageWidth - 55, finalY)
  doc.text(`$${invoice.amount.toFixed(2)}`, rightColX, finalY, { align: 'right' })

  // --- FOOTER ---
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100)
  doc.text('Thank you for your business!', pageWidth / 2, 280, { align: 'center' })

  // Save the PDF
  doc.save(`${invoice.invoice_number}.pdf`)
}
