import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { 
    ArrowLeft, 
    Download, 
    Printer, 
    AlertCircle, 
    CreditCard,
    FileText,
    Loader2
} from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { useInvoice } from '../../hooks/useBilling';
import api from '../../lib/api';

export function InvoiceDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: invoice, isLoading, isError } = useInvoice(id || '');
    const [downloading, setDownloading] = useState(false);

    const downloadPdf = async () => {
        if (!id) return;
        setDownloading(true);
        try {
            // Authenticated request — works in any environment
            const response = await api.get(`/invoices/${id}/download`, {
                responseType: 'blob',
            });
            // Extract filename from Content-Disposition header if present
            const disposition = response.headers['content-disposition'] as string | undefined;
            let filename = `invoice-${invoice?.invoiceNumber ?? id}.pdf`;
            if (disposition) {
                const match = disposition.match(/filename="?([^"]+)"?/);
                if (match) filename = match[1];
            }
            // Create a temporary Blob URL and trigger browser download
            const blobUrl = URL.createObjectURL(
                new Blob([response.data as BlobPart], { type: 'application/pdf' })
            );
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('PDF download failed:', err);
            alert('Failed to download invoice PDF. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'PAID': 
                return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Paid</Badge>;
            case 'ISSUED':
            case 'PARTIALLY_PAID':
                return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending Payment</Badge>;
            case 'CANCELLED':
                return <Badge variant="outline" className="bg-slate-50 text-slate-500">Cancelled</Badge>;
            case 'DRAFT':
                return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Draft</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (isError || !invoice) {
        return (
            <div className="flex h-96 flex-col items-center justify-center gap-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <h2 className="text-xl font-bold">Invoice Not Found</h2>
                <Button onClick={() => navigate('/billing')}>Back to Billing</Button>
            </div>
        );
    }

    const patient = invoice.patientId;
    const doctor = invoice.doctorId;

    return (
        <PageWrapper
            title={`Invoice #${invoice.invoiceNumber}`}
            description={`Generated on ${new Date(invoice.createdAt).toLocaleDateString()}`}
            headerContent={
                <Button variant="ghost" className="mb-2 -ml-4" onClick={() => navigate('/billing')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Billing
                </Button>
            }
            action={
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                    <Button 
                        className="bg-blue-600 hover:bg-blue-700 font-semibold shadow-md"
                        onClick={downloadPdf}
                        disabled={downloading}
                    >
                        {downloading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating PDF&hellip;</>
                        ) : (
                            <><Download className="mr-2 h-4 w-4" /> Download PDF</>
                        )}
                    </Button>
                </div>
            }
        >

            <div className="grid gap-6 md:grid-cols-3">
                {/* Main Invoice Content */}
                <Card className="md:col-span-2 border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b p-6 flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">Invoice Summary</h3>
                            <p className="text-sm text-slate-500 italic">#{invoice.invoiceNumber}</p>
                        </div>
                        {getStatusBadge(invoice.status)}
                    </div>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50">
                                    <TableHead className="px-6">Description</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right px-6">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoice.lineItems.map((item: any, idx: number) => (
                                    <TableRow key={idx}>
                                        <TableCell className="px-6 font-medium">
                                            {item.description}
                                            {item.procedureId?.name && (
                                                <span className="block text-[10px] text-slate-400 mt-0.5">
                                                    Procedure: {item.procedureId.name}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                        <TableCell className="text-right text-slate-600">
                                            ₹{item.unitPrice.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-slate-900 px-6">
                                            ₹{item.totalAmount.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <div className="p-8 border-t bg-slate-50/30">
                            <div className="flex flex-col items-end space-y-3">
                                <div className="w-64 space-y-2">
                                    <div className="flex justify-between text-slate-500 text-sm">
                                        <span>Subtotal</span>
                                        <span>₹{invoice.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-500 text-sm">
                                        <span>Tax (18%)</span>
                                        <span>₹{invoice.totalTax.toLocaleString()}</span>
                                    </div>
                                    {invoice.totalDiscount > 0 && (
                                        <div className="flex justify-between text-red-500 text-sm">
                                            <span>Discount</span>
                                            <span>-₹{invoice.totalDiscount.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-extrabold text-xl text-blue-900 pt-4 border-t border-slate-200">
                                        <span>Total</span>
                                        <span>₹{invoice.grandTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-semibold text-indigo-600 pt-1">
                                        <span>Paid Amount</span>
                                        <span>₹{invoice.paidAmount.toLocaleString()}</span>
                                    </div>
                                    {invoice.pendingAmount > 0 && (
                                        <div className="flex justify-between text-sm font-semibold text-amber-600">
                                            <span>Due Amount</span>
                                            <span>₹{invoice.pendingAmount.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    {/* Patient Info */}
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 border-b p-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                Bill To
                            </h3>
                        </div>
                        <CardContent className="p-6">
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Patient Name</p>
                                    <p className="font-bold text-slate-900">{patient?.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Contact</p>
                                    <p className="text-sm text-slate-600">{patient?.phone || 'N/A'}</p>
                                </div>
                                <div className="pt-3 border-t">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Treating Doctor</p>
                                    <p className="text-sm font-semibold text-blue-700">{doctor?.name || 'N/A'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment History Card (Optional but helpful) */}
                    {invoice.payments && invoice.payments.length > 0 && (
                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 border-b p-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-blue-600" />
                                    Payments
                                </h3>
                            </div>
                            <CardContent className="p-4">
                                <div className="space-y-3">
                                    {invoice.payments.map((p: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                                            <div>
                                                <p className="font-semibold">₹{p.amount.toLocaleString()}</p>
                                                <p className="text-[10px] text-slate-400">{new Date(p.paidAt).toLocaleDateString()}</p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] h-5 bg-slate-50">{p.mode}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Notes Card */}
                    {invoice.notes && (
                        <Card className="border-slate-200 bg-blue-50/30 border-dashed">
                            <CardContent className="p-4">
                                <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-2">Notes</p>
                                <p className="text-xs text-slate-600 italic">"{invoice.notes}"</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </PageWrapper>
    );
}
