import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Save, ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { usePatients } from '../../hooks/usePatients';
import { useDoctors, useProcedures, useCreateInvoice, useIssueInvoice } from '../../hooks/useBilling';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";
import { format } from 'date-fns';

interface LineItem {
    id: string;
    procedureId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
}

export function NewInvoice() {
    const navigate = useNavigate();
    
    // Form State
    const [selectedPatientId, setSelectedPatientId] = useState<string>('');
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [notes, setNotes] = useState('');
    const [applyGst, setApplyGst] = useState(true);
    const [lineItems, setLineItems] = useState<LineItem[]>([
        { id: Math.random().toString(36).substring(2, 9), description: '', quantity: 1, unitPrice: 0 }
    ]);

    // Data Hooks
    const { data: patients = [] } = usePatients();
    const { data: doctors = [] } = useDoctors();
    const { data: procedures = [] } = useProcedures();
    const createInvoice = useCreateInvoice();
    const issueInvoice = useIssueInvoice();

    // Calculations
    const totals = useMemo(() => {
        const subtotal = lineItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        const taxPercent = applyGst ? 18 : 0;
        const taxAmount = (subtotal * taxPercent) / 100;
        const total = subtotal + taxAmount;
        return { subtotal, taxAmount, total };
    }, [lineItems, applyGst]);

    // Handlers
    const addLineItem = () => {
        setLineItems([...lineItems, { id: Math.random().toString(36).substr(2, 9), description: '', quantity: 1, unitPrice: 0 }]);
    };

    const removeLineItem = (id: string) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter(item => item.id !== id));
        }
    };

    const updateLineItem = (id: string, updates: Partial<LineItem>) => {
        setLineItems(lineItems.map(item => {
            if (item.id === id) {
                const updated = { ...item, ...updates };
                // If procedure changed, update price and description
                if (updates.procedureId) {
                    const proc = procedures.find((p: any) => p._id === updates.procedureId);
                    if (proc) {
                        updated.description = proc.name;
                        updated.unitPrice = proc.basePrice || 0;
                    }
                }
                return updated;
            }
            return item;
        }));
    };

    const handleSave = async () => {
        if (!selectedPatientId || !selectedDoctorId || lineItems.some(i => !i.description)) {
            alert("Please fill in all required fields.");
            return;
        }

        try {
            const invoiceData = {
                patientId: selectedPatientId,
                doctorId: selectedDoctorId,
                notes,
                lineItems: lineItems.map(item => ({
                    procedureId: item.procedureId,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    taxPercent: applyGst ? 18 : 0
                }))
            };

            const result = await createInvoice.mutateAsync(invoiceData);
            if (result?._id) {
                await issueInvoice.mutateAsync(result._id);
            }
            navigate('/billing');
        } catch (error) {
            console.error("Failed to create invoice:", error);
            alert("Failed to create invoice. Please try again.");
        }
    };

    const headerContent = (
        <Button variant="ghost" className="mb-2 -ml-4" onClick={() => navigate('/billing')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Billing
        </Button>
    );

    return (
        <PageWrapper
            title="Create Invoice"
            description="Generate a new bill for a patient's treatment."
            headerContent={headerContent}
            action={
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.print()}>Preview</Button>
                    <Button 
                        className="bg-blue-600 hover:bg-blue-700" 
                        onClick={handleSave}
                        disabled={createInvoice.isPending || issueInvoice.isPending}
                    >
                        {(createInvoice.isPending || issueInvoice.isPending) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save & Issue
                    </Button>
                </div>
            }
        >
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-6">
                    <div className="grid gap-8 md:grid-cols-2 mb-10">
                        {/* Patient Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                                Bill To (Patient) <span className="text-red-500">*</span>
                            </label>
                            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                                <SelectTrigger className="w-full bg-white border-slate-200 h-10">
                                    <SelectValue placeholder="Search or select patient..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {patients.map((p: any) => (
                                        <SelectItem key={p._id} value={p._id}>
                                            <div className="flex flex-col items-start">
                                                <span className="font-medium">{p.name}</span>
                                                <span className="text-xs text-slate-400">{p.phone}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Doctor Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Treating Doctor <span className="text-red-500">*</span></label>
                            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                                <SelectTrigger className="w-full bg-white border-slate-200 h-10">
                                    <SelectValue placeholder="Select doctor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {doctors.map((d: any) => (
                                        <SelectItem key={d._id} value={d._id}>
                                            {d.name} ({d.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 relative">
                            <label className="text-sm font-semibold text-slate-700">Date of Issue</label>
                            <Input 
                                type="date" 
                                value={issueDate} 
                                onChange={(e) => setIssueDate(e.target.value)}
                                className="border-slate-200 h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Invoice Status</label>
                            <Input defaultValue="Draft (auto-issued on save)" disabled className="bg-slate-50 text-slate-500 font-medium h-10" />
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50/80 backdrop-blur-sm p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                                <Plus className="h-4 w-4 text-blue-600" />
                                Treatment Line Items
                            </h3>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={addLineItem}
                                className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 font-medium"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add Item
                            </Button>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/30">
                                    <TableHead className="w-[45%] text-slate-600 font-semibold px-6">Service / Description</TableHead>
                                    <TableHead className="text-slate-600 font-semibold">Qty</TableHead>
                                    <TableHead className="text-slate-600 font-semibold">Unit Price (₹)</TableHead>
                                    <TableHead className="text-right text-slate-600 font-semibold px-6">Total (₹)</TableHead>
                                    <TableHead className="w-[60px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lineItems.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="px-6 py-4">
                                            <div className="space-y-2">
                                                <Select 
                                                    value={item.procedureId} 
                                                    onValueChange={(val) => updateLineItem(item.id, { procedureId: val })}
                                                >
                                                    <SelectTrigger className="w-full bg-white border-slate-200 h-9 text-sm">
                                                        <SelectValue placeholder="Choose a procedure..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {procedures.map((p: any) => (
                                                            <SelectItem key={p._id} value={p._id}>
                                                                {p.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Input 
                                                    placeholder="Custom description..."
                                                    value={item.description}
                                                    onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                                                    className="bg-white border-slate-200 h-9 text-xs"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                value={item.quantity} 
                                                min="1"
                                                onChange={(e) => updateLineItem(item.id, { quantity: parseInt(e.target.value) || 0 })}
                                                className="w-20 border-slate-200 h-9 text-center font-medium" 
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                value={item.unitPrice} 
                                                onChange={(e) => updateLineItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                                className="w-32 border-slate-200 h-9 text-right font-medium pr-3" 
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-900 border-l px-6 align-middle">
                                            ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="px-2">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => removeLineItem(item.id)}
                                                className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <div className="bg-slate-50/50 p-8 flex flex-col md:flex-row justify-between border-t gap-8">
                            <div className="flex-1 space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Notes / Remarks</label>
                                <textarea 
                                    className="w-full min-h-[100px] rounded-lg border border-slate-200 bg-white p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    placeholder="Add any special instructions or billing notes..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                            <div className="w-full md:w-80 space-y-4 pt-2">
                                <div className="flex justify-between text-slate-600 text-sm font-medium">
                                    <span>Subtotal</span>
                                    <span>₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-slate-600 text-sm font-medium items-center">
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex items-center space-x-2 mr-2">
                                            <input 
                                                type="checkbox" 
                                                id="applyGst" 
                                                checked={applyGst} 
                                                onChange={(e) => setApplyGst(e.target.checked)}
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label htmlFor="applyGst" className="text-[10px] items-center cursor-pointer font-bold text-slate-500 hover:text-blue-700 transition-colors">
                                                APPLY GST (18%)
                                            </label>
                                        </div>
                                    </div>
                                    <span className={applyGst ? "text-slate-900 font-bold" : "text-slate-400 line-through"}>
                                        ₹{totals.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="pt-4 border-t-2 border-slate-200 flex justify-between font-extrabold text-2xl text-blue-900">
                                    <span>Grand Total</span>
                                    <span>₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 text-right italic font-medium">
                                    * Final amount is verified by the backend.
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </PageWrapper>
    );
}
