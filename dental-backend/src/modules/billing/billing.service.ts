import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Invoice,
  InvoiceDocument,
  InvoiceStatus,
  PaymentMode,
} from './invoice.schema';
import { Procedure, ProcedureDocument } from './procedure.schema';
import {
  AdvancePayment,
  AdvancePaymentDocument,
} from './advance-payment.schema';
import { StorageService } from '../storage/storage.service';
import { PdfService } from './pdf.service';
import { EmailService } from '../notifications/email.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';
import {
  CreateInvoiceDto,
  RecordPaymentDto,
  LineItemDto as LineItemInput,
} from './billing.dto';

export { CreateInvoiceDto, RecordPaymentDto };

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Procedure.name)
    private procedureModel: Model<ProcedureDocument>,
    @InjectModel(AdvancePayment.name)
    private advanceModel: Model<AdvancePaymentDocument>,
    private storageService: StorageService,
    private pdfService: PdfService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  private getClinicInfo() {
    return {
      clinicName: this.configService.get<string>('CLINIC_NAME', 'Dental Clinic'),
      clinicAddress: this.configService.get<string>('CLINIC_ADDRESS', ''),
      clinicPhone: this.configService.get<string>('CLINIC_PHONE', ''),
      clinicGstin: this.configService.get<string>('CLINIC_GSTIN'),
    };
  }

  // ─── Invoice Number Generation ─────────────────────────────────────────────
  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.invoiceModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
    } as any);
    const seq = String(count + 1).padStart(4, '0');
    return `INV-${year}-${seq}`;
  }

  // ─── Amount Calculation ─────────────────────────────────────────────────────
  /**
   * All amounts are calculated server-side to float with 2 decimal precision.
   * Frontend values are NEVER trusted for totals.
   */
  private calculateLineItems(lineItems: LineItemInput[]) {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const calculated = lineItems.map((item) => {
      const qty = item.quantity || 1;
      const unitPrice = item.unitPrice;
      const discountAmount =
        item.discount ??
        (item.discountPercent
          ? (unitPrice * qty * item.discountPercent) / 100
          : 0);
      const taxPercent = item.taxPercent ?? 18;
      const taxableAmount = unitPrice * qty - discountAmount;
      const taxAmount = parseFloat(
        ((taxableAmount * taxPercent) / 100).toFixed(2),
      );
      const totalAmount = parseFloat((taxableAmount + taxAmount).toFixed(2));

      subtotal += unitPrice * qty;
      totalDiscount += discountAmount;
      totalTax += taxAmount;

      return {
        ...(item.procedureId
          ? { procedureId: new Types.ObjectId(item.procedureId) }
          : {}),
        description: item.description,
        quantity: qty,
        unitPrice,
        discount: parseFloat(discountAmount.toFixed(2)),
        discountPercent: item.discountPercent ?? 0,
        taxPercent,
        taxAmount,
        totalAmount,
      };
    });

    const grandTotal = parseFloat(
      (subtotal - totalDiscount + totalTax).toFixed(2),
    );
    return {
      items: calculated,
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      grandTotal,
    };
  }

  // ─── Procedures ─────────────────────────────────────────────────────────────
  async createProcedure(
    tenantId: string,
    dto: Partial<Procedure>,
  ): Promise<ProcedureDocument> {
    const proc = new this.procedureModel({
      ...dto,
      tenantId: new Types.ObjectId(tenantId),
    });
    return proc.save();
  }

  async getProcedures(tenantId: string) {
    return this.procedureModel.find({
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    } as any).lean().exec();
  }

  async updateProcedure(
    tenantId: string,
    id: string,
    dto: Partial<Procedure>,
  ): Promise<ProcedureDocument> {
    const proc = await this.procedureModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      } as any,
      { $set: dto },
      { new: true },
    );
    if (!proc) throw new NotFoundException('Procedure not found');
    return proc as unknown as ProcedureDocument;
  }

  async deleteProcedure(tenantId: string, id: string): Promise<void> {
    await this.procedureModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      } as any,
      { isActive: false },
    );
  }

  async seedProcedures(tenantId: string): Promise<void> {
    const procedures = [
      { name: 'Root Canal Treatment (RCT)', code: 'RCT-01', category: 'Endodontics', defaultPrice: 4500, defaultDuration: 60, taxable: true },
      { name: 'Dental Cleaning (Scaling)', code: 'SCAL-01', category: 'Preventative', defaultPrice: 1500, defaultDuration: 30, taxable: true },
      { name: 'Tooth Extraction', code: 'EXT-01', category: 'Surgery', defaultPrice: 1200, defaultDuration: 45, taxable: true },
      { name: 'Composite Filling', code: 'FILL-01', category: 'General', defaultPrice: 800, defaultDuration: 30, taxable: true },
      { name: 'Dental Crown (PFM)', code: 'CRN-01', category: 'Prosthodontics', defaultPrice: 5500, defaultDuration: 45, taxable: true },
      { name: 'Dental X-Ray (IOPA)', code: 'XRAY-01', category: 'Diagnostic', defaultPrice: 200, defaultDuration: 10, taxable: false },
    ];

    for (const p of procedures) {
      await this.procedureModel.updateOne(
        { tenantId: new Types.ObjectId(tenantId), name: p.name } as any,
        { $set: { ...p, isActive: true } },
        { upsert: true },
      );
    }
  }

  // ─── Invoices ───────────────────────────────────────────────────────────────
  async createInvoice(
    tenantId: string,
    userId: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceDocument> {
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);
    const { items, subtotal, totalDiscount, totalTax, grandTotal } =
      this.calculateLineItems(dto.lineItems);
    const advanceUsed = dto.advanceUsed ?? 0;
    const paidAmount = advanceUsed;
    const pendingAmount = parseFloat((grandTotal - paidAmount).toFixed(2));

    const invoice = new this.invoiceModel({
      tenantId: new Types.ObjectId(tenantId),
      invoiceNumber,
      patientId: new Types.ObjectId(dto.patientId),
      doctorId: new Types.ObjectId(dto.doctorId),
      ...(dto.appointmentId && {
        appointmentId: new Types.ObjectId(dto.appointmentId),
      }),
      lineItems: items,
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
      paidAmount,
      pendingAmount,
      advanceUsed,
      notes: dto.notes,
      createdBy: new Types.ObjectId(userId),
    });
    return invoice.save();
  }

  async getInvoices(
    tenantId: string,
    pagination: PaginationDto,
    filters: {
      status?: string;
      patientId?: string;
      doctorId?: string;
      from?: string;
      to?: string;
    },
  ) {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
    };
    if (filters.status) query.status = filters.status;
    if (filters.patientId)
      query.patientId = new Types.ObjectId(filters.patientId);
    if (filters.doctorId) query.doctorId = new Types.ObjectId(filters.doctorId);
    if (filters.from || filters.to) {
      query.createdAt = {
        ...(filters.from ? { $gte: new Date(filters.from) } : {}),
        ...(filters.to ? { $lte: new Date(filters.to + 'T23:59:59') } : {}),
      };
    }

    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.invoiceModel
        .find(query)
        .populate('patientId', 'name phone patientId')
        .populate('doctorId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.invoiceModel.countDocuments(query),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getInvoice(tenantId: string, id: string): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel
      .findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      } as any)
      .populate('patientId', 'name phone patientId')
      .populate('doctorId', 'name email')
      .populate('lineItems.procedureId', 'name code');
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async issueInvoice(tenantId: string, id: string): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          tenantId: new Types.ObjectId(tenantId),
          status: InvoiceStatus.DRAFT,
        } as any,
        { $set: { status: InvoiceStatus.ISSUED } },
        { new: true },
      )
      .populate('patientId', 'name phone email patientId')
      .populate('doctorId', 'name');

    if (!invoice) throw new NotFoundException('Draft invoice not found');

    const patient = invoice.patientId as any;

    // Generate PDF asynchronously, save URL, and send Email
    this.generateAndSavePdf(
      tenantId,
      invoice as unknown as InvoiceDocument,
    ).then((pdfUrl) => {
      this.emailService.sendInvoiceEmail({
        patientName: patient?.name ?? '',
        patientEmail: patient?.email ?? '',
        clinicName: 'Dental Clinic',
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: new Date((invoice as any).createdAt).toLocaleDateString('en-IN'),
        grandTotal: invoice.grandTotal,
        pdfUrl,
        lineItems: invoice.lineItems,
      }).catch(err => this.logger.error(`Failed to send invoice email: ${err.message}`));
    }).catch((err) =>
      this.logger.error(
        `PDF generation failed for ${id}: ${(err as Error).message}`,
      ),
    );

    return invoice as unknown as InvoiceDocument;
  }

  async sendReminder(tenantId: string, id: string): Promise<{ success: boolean; message: string }> {
    const invoice = await this.invoiceModel
      .findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      } as any)
      .populate('patientId', 'name email');

    if (!invoice) throw new NotFoundException('Invoice not found');

    const patient = invoice.patientId as any;
    if (!patient?.email) throw new BadRequestException('Patient has no email address configured');

    let pdfUrl = invoice.pdfUrl;
    if (!pdfUrl) {
      pdfUrl = await this.generateAndSavePdf(tenantId, invoice as unknown as InvoiceDocument);
    }

    this.emailService.sendInvoiceEmail({
      patientName: patient.name,
      patientEmail: patient.email,
      clinicName: this.getClinicInfo().clinicName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: new Date((invoice as any).createdAt).toLocaleDateString('en-IN'),
      grandTotal: invoice.grandTotal,
      pdfUrl,
      lineItems: invoice.lineItems || [],
    }).catch(err => this.logger.error(`Failed to send invoice reminder: ${err.message}`));

    return { success: true, message: 'Reminder sent successfully' };
  }

  private async generateAndSavePdf(tenantId: string, invoice: InvoiceDocument) {
    const patient = invoice.patientId as any;
    const clinic = this.getClinicInfo();
    const pdfBuffer = await this.pdfService.generateInvoice({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: new Date(
        (invoice as any).createdAt as Date,
      ).toLocaleDateString('en-IN'),
      clinicName: clinic.clinicName,
      clinicAddress: clinic.clinicAddress,
      clinicPhone: clinic.clinicPhone,
      clinicGstin: clinic.clinicGstin,
      patientName: patient?.name ?? '',
      patientId: patient?.patientId ?? '',
      patientPhone: patient?.phone ?? '',
      lineItems: invoice.lineItems || [],
      subtotal: invoice.subtotal,
      totalDiscount: invoice.totalDiscount,
      totalTax: invoice.totalTax,
      grandTotal: invoice.grandTotal,
      paidAmount: invoice.paidAmount,
      pendingAmount: invoice.pendingAmount,
      payments: (invoice.payments || []).map((p) => ({
        amount: p.amount,
        mode: p.mode,
        paidAt: new Date(p.paidAt).toLocaleDateString('en-IN'),
      })),
    });

    const pdfUrl = await this.storageService.uploadInvoicePDF(
      tenantId,
      invoice._id.toString(),
      pdfBuffer,
    );

    await this.invoiceModel.updateOne(
      { _id: invoice._id },
      { $set: { pdfUrl } },
    );
    return pdfUrl;
  }

  async recordPayment(
    tenantId: string,
    id: string,
    userId: string,
    dto: RecordPaymentDto,
  ): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    } as any);
    if (!invoice) throw new NotFoundException('Invoice not found');

    const newPaidAmount = parseFloat(
      (invoice.paidAmount + dto.amount).toFixed(2),
    );
    const newPendingAmount = parseFloat(
      (invoice.grandTotal - newPaidAmount).toFixed(2),
    );

    let newStatus = invoice.status;
    if (newPendingAmount <= 0) newStatus = InvoiceStatus.PAID;
    else if (newPaidAmount > 0) newStatus = InvoiceStatus.PARTIALLY_PAID;

    const updated = await this.invoiceModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) } as any,
      {
        $set: {
          paidAmount: newPaidAmount,
          pendingAmount: Math.max(0, newPendingAmount),
          status: newStatus,
        },
        $push: {
          payments: {
            amount: dto.amount,
            mode: dto.mode,
            reference: dto.reference,
            paidAt: new Date(),
            recordedBy: new Types.ObjectId(userId),
          },
        },
      },
      { new: true },
    );
    return updated as unknown as InvoiceDocument;
  }

  async cancelInvoice(
    tenantId: string,
    id: string,
    reason?: string,
  ): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      } as any,
      { $set: { status: InvoiceStatus.CANCELLED, notes: reason } },
      { new: true },
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice as unknown as InvoiceDocument;
  }

  async getInvoicePdf(tenantId: string, id: string): Promise<string> {
    const invoice = await this.invoiceModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    } as any);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.pdfUrl) {
      const filePath = invoice.pdfUrl.split(`storage.googleapis.com/`)[1];
      return this.storageService.getSignedUrl(
        filePath.split('/').slice(1).join('/'),
      );
    }
    // Regenerate if missing
    await this.generateAndSavePdf(tenantId, invoice);
    return (await this.invoiceModel.findById(id))?.pdfUrl ?? '';
  }

  /**
   * Production-safe PDF download: regenerates the PDF directly from DB data
   * and returns a Buffer — no dependency on stored pdfUrl or localhost.
   */
  async downloadInvoicePdf(
    tenantId: string,
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.invoiceModel
      .findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      } as any)
      .populate('patientId', 'name phone patientId')
      .populate('doctorId', 'name');

    if (!invoice) throw new NotFoundException('Invoice not found');

    const patient = invoice.patientId as any;
    const clinic = this.getClinicInfo();

    const buffer = await this.pdfService.generateInvoice({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: new Date(
        (invoice as any).createdAt as Date,
      ).toLocaleDateString('en-IN'),
      clinicName: clinic.clinicName,
      clinicAddress: clinic.clinicAddress,
      clinicPhone: clinic.clinicPhone,
      clinicGstin: clinic.clinicGstin,
      patientName: patient?.name ?? 'Patient',
      patientId: patient?.patientId ?? id,
      patientPhone: patient?.phone ?? '',
      lineItems: invoice.lineItems || [],
      subtotal: invoice.subtotal,
      totalDiscount: invoice.totalDiscount,
      totalTax: invoice.totalTax,
      grandTotal: invoice.grandTotal,
      paidAmount: invoice.paidAmount,
      pendingAmount: invoice.pendingAmount,
      payments: (invoice.payments || []).map((p) => ({
        amount: p.amount,
        mode: p.mode,
        paidAt: new Date(p.paidAt).toLocaleDateString('en-IN'),
      })),
    });

    const filename = `invoice-${invoice.invoiceNumber}.pdf`;
    return { buffer, filename };
  }

  // ─── Advance Payments ──────────────────────────────────────────────────────
  async createAdvancePayment(
    tenantId: string,
    userId: string,
    dto: {
      patientId: string;
      amount: number;
      mode: PaymentMode;
      reference?: string;
      notes?: string;
    },
  ): Promise<AdvancePaymentDocument> {
    const advance = new this.advanceModel({
      tenantId: new Types.ObjectId(tenantId),
      patientId: new Types.ObjectId(dto.patientId),
      amount: dto.amount,
      balance: dto.amount,
      notes: dto.notes,
      payments: [
        {
          amount: dto.amount,
          mode: dto.mode,
          reference: dto.reference,
          paidAt: new Date(),
          recordedBy: new Types.ObjectId(userId),
        },
      ],
    });
    return advance.save();
  }

  async getAdvanceBalance(tenantId: string, patientId: string) {
    return this.advanceModel.find({
      tenantId: new Types.ObjectId(tenantId),
      patientId: new Types.ObjectId(patientId),
    } as any);
  }

  async useAdvance(
    tenantId: string,
    advanceId: string,
    invoiceId: string,
    amount: number,
  ): Promise<void> {
    const advance = await this.advanceModel.findOne({
      _id: new Types.ObjectId(advanceId),
      tenantId: new Types.ObjectId(tenantId),
    } as any);
    if (!advance) throw new NotFoundException('Advance payment not found');
    if (advance.balance < amount)
      throw new BadRequestException('Insufficient advance balance');

    advance.balance = parseFloat((advance.balance - amount).toFixed(2));
    await advance.save();

    await this.invoiceModel.updateOne(
      { _id: new Types.ObjectId(invoiceId) } as any,
      {
        $inc: { advanceUsed: amount, paidAmount: amount },
        $set: { pendingAmount: 0 },
      },
    );
  }

  async refundInvoice(
    tenantId: string,
    id: string,
    reason?: string,
  ): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      } as any,
      { $set: { status: InvoiceStatus.REFUNDED, notes: reason } },
      { new: true },
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice as unknown as InvoiceDocument;
  }

  async updateDraftInvoice(
    tenantId: string,
    id: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceDocument> {
    const existing = await this.invoiceModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
      status: InvoiceStatus.DRAFT,
    } as any);
    if (!existing)
      throw new NotFoundException(
        'Draft invoice not found or cannot be updated',
      );

    const { items, subtotal, totalDiscount, totalTax, grandTotal } =
      this.calculateLineItems(dto.lineItems);
    const paidAmount = dto.advanceUsed ?? 0;
    const pendingAmount = parseFloat((grandTotal - paidAmount).toFixed(2));

    const invoice = await this.invoiceModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) } as any,
      {
        $set: {
          patientId: new Types.ObjectId(dto.patientId),
          doctorId: new Types.ObjectId(dto.doctorId),
          ...(dto.appointmentId && {
            appointmentId: new Types.ObjectId(dto.appointmentId),
          }),
          lineItems: items,
          subtotal,
          totalDiscount,
          totalTax,
          grandTotal,
          paidAmount,
          pendingAmount,
          notes: dto.notes,
        },
      },
      { new: true },
    );
    return invoice as unknown as InvoiceDocument;
  }
}
