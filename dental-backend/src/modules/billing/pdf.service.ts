import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicGstin?: string;
  patientName: string;
  patientId: string;
  patientPhone: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxPercent: number;
    taxAmount: number;
    totalAmount: number;
  }>;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  paidAmount: number;
  pendingAmount: number;
  payments: Array<{ amount: number; mode: string; paidAt: string }>;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Generate invoice PDF as a Buffer (never writes to disk).
   * Uses pdfkit streams collected into a Buffer.
   */
  async generateInvoice(data: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Standard Fonts for Vercel Serverless Reliability
      const fontRegular = 'Helvetica';
      const fontBold = 'Helvetica-Bold';

      // Colors
      const primaryColor = '#0D9488'; // Teal-600
      const secondaryColor = '#475569'; // Slate-600
      const borderColor = '#CBD5E1'; // Slate-300

      // ── Header Background ─────────────────────────────────────────────
      doc
        .rect(0, 0, doc.page.width, 120)
        .fill(primaryColor);

      // ── Clinic Branding ───────────────────────────────────────────────
      doc
        .fillColor('white')
        .fontSize(24)
        .font(fontBold)
        .text(data.clinicName, 40, 40)
        .fontSize(10)
        .font(fontRegular)
        .text(data.clinicAddress, 40, 70, { width: 300 })
        .text(`Phone: ${data.clinicPhone}`, 40, 95);

      if (data.clinicGstin) {
        doc.text(`GSTIN: ${data.clinicGstin}`, 40, 107);
      }

      doc
        .fontSize(28)
        .font(fontBold)
        .text('INVOICE', 400, 45, { align: 'right' });

      // Reset text color
      doc.fillColor('black');

      // ── Invoice & Patient Details ─────────────────────────────────────
      doc.moveDown(5);
      const detailsTop = 150;
      
      // Patient Box
      doc
        .roundedRect(40, detailsTop, 250, 90, 5)
        .lineWidth(0.5)
        .strokeColor(borderColor)
        .stroke();
      
      doc
        .fontSize(10)
        .font(fontBold)
        .fillColor(primaryColor)
        .text('BILL TO:', 55, detailsTop + 15)
        .fillColor('black')
        .fontSize(12)
        .text(data.patientName, 55, detailsTop + 30)
        .fontSize(9)
        .font(fontRegular)
        .fillColor(secondaryColor)
        .text(`ID: ${data.patientId}`, 55, detailsTop + 50)
        .text(`Phone: ${data.patientPhone}`, 55, detailsTop + 65);

      // Invoice Info Box
      doc
        .fontSize(10)
        .font(fontBold)
        .text('Invoice #:', 350, detailsTop + 15)
        .text('Date:', 350, detailsTop + 35)
        .text('Status:', 350, detailsTop + 55);

      const statusColor = data.pendingAmount <= 0 ? '#10B981' : '#F59E0B';
      
      doc
        .font(fontRegular)
        .text(data.invoiceNumber, 450, detailsTop + 15)
        .text(data.invoiceDate, 450, detailsTop + 35)
        .fillColor(statusColor)
        .font(fontBold)
        .text(data.pendingAmount <= 0 ? 'PAID' : 'PENDING', 450, detailsTop + 55);

      doc.fillColor('black');

      // ── Table Header ──────────────────────────────────────────────────
      const tableTop = 270;
      doc
        .rect(40, tableTop, 515, 25)
        .fill(primaryColor);

      doc
        .fillColor('white')
        .fontSize(9)
        .font(fontBold)
        .text('Description', 50, tableTop + 8)
        .text('Qty', 280, tableTop + 8, { width: 40, align: 'center' })
        .text('Unit Price', 330, tableTop + 8, { width: 70, align: 'right' })
        .text('Tax', 410, tableTop + 8, { width: 60, align: 'right' })
        .text('Total', 480, tableTop + 8, { width: 65, align: 'right' });

      // ── Line Items ────────────────────────────────────────────────────
      let itemY = tableTop + 35;
      doc.fillColor('black').font(fontRegular).fontSize(9);

      for (const item of data.lineItems) {
        // Alternating background or subtle border
        doc.lineWidth(0.1).strokeColor(borderColor)
           .moveTo(40, itemY + 15).lineTo(555, itemY + 15).stroke();

        doc.text(item.description, 50, itemY, { width: 220 });
        doc.text(String(item.quantity), 280, itemY, { width: 40, align: 'center' });
        doc.text(`Rs. ${item.unitPrice.toFixed(2)}`, 330, itemY, { width: 70, align: 'right' });
        doc.text(`Rs. ${item.taxAmount.toFixed(2)}`, 410, itemY, { width: 60, align: 'right' });
        doc.text(`Rs. ${item.totalAmount.toFixed(2)}`, 480, itemY, { width: 65, align: 'right' });

        itemY += 25;
      }

      // ── Summary & Totals ──────────────────────────────────────────────
      const summaryY = itemY + 20;
      const colX = 350;

      doc
        .fontSize(10)
        .font(fontRegular)
        .fillColor(secondaryColor)
        .text('Subtotal:', colX, summaryY)
        .text(`Rs. ${data.subtotal.toFixed(2)}`, 480, summaryY, { align: 'right' });

      doc
        .text('Discount:', colX, summaryY + 20)
        .text(`-Rs. ${data.totalDiscount.toFixed(2)}`, 480, summaryY + 20, { align: 'right' });

      doc
        .text('GST (18%):', colX, summaryY + 40)
        .text(`Rs. ${data.totalTax.toFixed(2)}`, 480, summaryY + 40, { align: 'right' });

      doc
        .rect(340, summaryY + 60, 215, 35)
        .fill('#F8FAFC');

      doc
        .fillColor(primaryColor)
        .fontSize(14)
        .font(fontBold)
        .text('Grand Total:', colX, summaryY + 70)
        .text(`Rs. ${data.grandTotal.toFixed(2)}`, 450, summaryY + 70, { align: 'right', width: 95 });

      // ── Payments ──────────────────────────────────────────────────────
      if (data.payments.length > 0) {
        doc
          .fillColor('black')
          .fontSize(10)
          .font(fontBold)
          .text('Payment History:', 40, summaryY);
        
        let py = summaryY + 20;
        doc.fontSize(8).font(fontRegular).fillColor(secondaryColor);
        for (const p of data.payments) {
          doc.text(`${p.paidAt} — ${p.mode} — Rs. ${p.amount.toFixed(2)}`, 40, py);
          py += 15;
        }
      }

      // ── Footer ────────────────────────────────────────────────────────
      const footerY = doc.page.height - 70;
      doc
        .lineWidth(0.5)
        .strokeColor(borderColor)
        .moveTo(40, footerY).lineTo(555, footerY).stroke();

      doc
        .fontSize(8)
        .fillColor(secondaryColor)
        .text('This is a computer-generated invoice.', 0, footerY + 15, { align: 'center' })
        .font(fontBold)
        .text(`Thank you for visiting ${data.clinicName}!`, 0, footerY + 30, { align: 'center' });

      doc.end();
    });
  }
}
