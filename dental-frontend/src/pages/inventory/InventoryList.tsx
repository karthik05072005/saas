import { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card, CardContent } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
    MoreHorizontal, Plus, Search, AlertCircle, Package, TrendingUp, Loader2,
    FlaskConical, ArrowDownCircle, ArrowUpCircle, BarChart2
} from 'lucide-react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '../../components/ui/dialog';
import {
    useInventoryItems, useInventoryValuation, useLabCases,
    useCreateInventoryItem, useCreateInventoryTransaction,
    useCreateLabCase, useUpdateLabCase,
} from '../../hooks/useInventory';
import { useDoctors } from '../../hooks/useBilling';
import { usePatients } from '../../hooks/usePatients';

// ─── Item categories from schema ─────────────────────────────────────────────
const ITEM_CATEGORIES = ['CONSUMABLE', 'INSTRUMENT', 'MEDICATION', 'LAB_MATERIAL', 'IMPLANT', 'CROWN', 'OTHER'];
const LAB_STATUSES = ['SENT', 'IN_PROGRESS', 'RECEIVED', 'FITTED', 'CANCELLED'];

type InventoryItem = {
    _id: string;
    name: string;
    category: string;
    unit: string;
    currentStock: number;
    minimumStock: number;
    unitCost: number;
    vendor?: { name?: string; phone?: string; email?: string };
    notes?: string;
};

type LabCase = {
    _id: string;
    caseId?: string;
    patientId?: { _id?: string; name?: string } | string;
    doctorId?: { _id?: string; name?: string } | string;
    labName?: string;
    caseType?: string;
    shade?: string;
    sentDate?: string;
    expectedReturnDate?: string;
    status: string;
    cost?: number;
    notes?: string;
};

// ─── Stock Tab ────────────────────────────────────────────────────────────────
function StockTab() {
    const [searchTerm, setSearchTerm] = useState('');

    // Dialogs
    const [showAddItem, setShowAddItem] = useState(false);
    const [showTransaction, setShowTransaction] = useState(false);
    const [transactionType, setTransactionType] = useState<'PURCHASE' | 'USAGE' | 'ADJUSTMENT'>('PURCHASE');
    const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);

    // Item form
    const [itemForm, setItemForm] = useState({
        name: '', category: 'CONSUMABLE', unit: 'Units', currentStock: 0,
        minimumStock: 5, unitCost: 0, notes: '',
        vendor: { name: '', phone: '', email: '' }
    });

    // Transaction form
    const [txForm, setTxForm] = useState({ quantity: 1, unitCost: 0, referenceNote: '' });

    const { data: inventoryData, isLoading: itemsLoading } = useInventoryItems();
    const { data: valuationData } = useInventoryValuation();
    const createItem = useCreateInventoryItem();
    const createTx = useCreateInventoryTransaction();

    const inventoryItems: InventoryItem[] = Array.isArray(inventoryData)
        ? inventoryData as InventoryItem[]
        : (((inventoryData as any)?.data ?? (inventoryData as any)?.items ?? []) as InventoryItem[]);

    const lowStockCount = inventoryItems.filter(i => i.currentStock <= i.minimumStock).length;
    const totalValue = Array.isArray(valuationData)
        ? valuationData.reduce((sum: number, row: { totalValue: number }) => sum + (row.totalValue ?? 0), 0)
        : inventoryItems.reduce((acc, i) => acc + (i.currentStock * (i.unitCost ?? 0)), 0);

    const filteredItems = inventoryItems.filter(item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openTransaction = (item: InventoryItem, type: 'PURCHASE' | 'USAGE' | 'ADJUSTMENT') => {
        setActiveItem(item);
        setTransactionType(type);
        setTxForm({ quantity: 1, unitCost: item.unitCost, referenceNote: '' });
        setShowTransaction(true);
    };

    const handleAddItem = () => {
        createItem.mutate(itemForm as unknown as Record<string, unknown>, {
            onSuccess: () => {
                setShowAddItem(false);
                setItemForm({ name: '', category: 'CONSUMABLE', unit: 'Units', currentStock: 0, minimumStock: 5, unitCost: 0, notes: '', vendor: { name: '', phone: '', email: '' } });
            }
        });
    };

    const handleTransaction = () => {
        if (!activeItem) return;
        createTx.mutate({
            itemId: activeItem._id,
            type: transactionType,
            quantity: txForm.quantity,
            unitCost: txForm.unitCost,
            referenceNote: txForm.referenceNote,
        }, { onSuccess: () => setShowTransaction(false) });
    };

    const txLabel = transactionType === 'PURCHASE' ? 'Restock (Purchase)' : transactionType === 'USAGE' ? 'Record Usage' : 'Stock Adjustment';

    const getStatusBadge = (item: InventoryItem) => {
        const isLow = item.currentStock <= item.minimumStock;
        const isEmpty = item.currentStock === 0;
        if (isEmpty) return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 text-xs border-none">Out of Stock</Badge>;
        if (isLow) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs border-none">Low Stock</Badge>;
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs border-none">In Stock</Badge>;
    };

    return (
        <div>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Items in Catalog</p>
                            <h3 className="text-2xl font-bold mt-1 text-slate-900">
                                {itemsLoading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : inventoryItems.length}
                            </h3>
                        </div>
                        <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Package className="h-6 w-6 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className={lowStockCount > 0 ? "border-amber-200 bg-amber-50/30" : ""}>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Low / Out of Stock</p>
                            <h3 className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                                {itemsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : lowStockCount}
                            </h3>
                        </div>
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${lowStockCount > 0 ? 'bg-amber-100' : 'bg-slate-100'}`}>
                            <AlertCircle className={`h-6 w-6 ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Inventory Value</p>
                            <h3 className="text-2xl font-bold mt-1 text-slate-900">
                                {itemsLoading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : `₹${Number(totalValue).toLocaleString('en-IN')}`}
                            </h3>
                        </div>
                        <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <TrendingUp className="h-6 w-6 text-indigo-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search + Actions */}
            <div className="flex items-center justify-between mb-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search items by name or category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-white"
                    />
                </div>
                <Button onClick={() => setShowAddItem(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" /> Add New Item
                </Button>
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead>Item Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Current Stock</TableHead>
                            <TableHead>Min. Stock</TableHead>
                            <TableHead>Unit Cost</TableHead>
                            <TableHead>Total Value</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {itemsLoading && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                                </TableCell>
                            </TableRow>
                        )}
                        {!itemsLoading && filteredItems.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-14 text-slate-400">
                                    <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                    No inventory items found. Add your first item to get started.
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredItems.map((item) => (
                            <TableRow key={item._id} className="hover:bg-slate-50/50">
                                <TableCell className="font-semibold text-slate-900">
                                    {item.name}
                                    {item.currentStock <= item.minimumStock && (
                                        <AlertCircle className="inline h-3.5 w-3.5 text-amber-500 ml-1.5" />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs font-normal capitalize">{item.category?.toLowerCase()}</Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                    {item.currentStock}
                                    <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
                                </TableCell>
                                <TableCell className="text-slate-500 text-sm">{item.minimumStock} {item.unit}</TableCell>
                                <TableCell className="text-slate-700">₹{(item.unitCost ?? 0).toLocaleString('en-IN')}</TableCell>
                                <TableCell className="font-semibold text-slate-800">
                                    ₹{((item.currentStock ?? 0) * (item.unitCost ?? 0)).toLocaleString('en-IN')}
                                </TableCell>
                                <TableCell>{getStatusBadge(item)}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Manage Stock</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => openTransaction(item, 'PURCHASE')}>
                                                <ArrowUpCircle className="mr-2 h-4 w-4 text-indigo-600" /> Restock (Purchase)
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openTransaction(item, 'USAGE')}>
                                                <ArrowDownCircle className="mr-2 h-4 w-4 text-blue-600" /> Record Usage
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openTransaction(item, 'ADJUSTMENT')}>
                                                <BarChart2 className="mr-2 h-4 w-4 text-amber-600" /> Manual Adjustment
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Add Item Dialog */}
            <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add New Inventory Item</DialogTitle>
                        <DialogDescription>Add a new material, medication, or instrument to your stock.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-sm font-medium">Item Name *</label>
                                <Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Composite Resin A1" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Category</label>
                                <select value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Unit</label>
                                <Input value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. Units, ml, gm, Box" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Current Stock</label>
                                <Input type="number" value={itemForm.currentStock} onChange={e => setItemForm(f => ({ ...f, currentStock: Number(e.target.value) }))} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Min. Stock</label>
                                <Input type="number" value={itemForm.minimumStock} onChange={e => setItemForm(f => ({ ...f, minimumStock: Number(e.target.value) }))} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Unit Cost (₹)</label>
                                <Input type="number" value={itemForm.unitCost} onChange={e => setItemForm(f => ({ ...f, unitCost: Number(e.target.value) }))} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Vendor Name (Optional)</label>
                            <Input value={itemForm.vendor.name} onChange={e => setItemForm(f => ({ ...f, vendor: { ...f.vendor, name: e.target.value } }))} placeholder="Supplier / vendor name" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Notes (Optional)</label>
                            <Input value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any storage or usage notes" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
                        <Button onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700" disabled={createItem.isPending || !itemForm.name}>
                            {createItem.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transaction Dialog */}
            <Dialog open={showTransaction} onOpenChange={setShowTransaction}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{txLabel}</DialogTitle>
                        <DialogDescription>
                            Item: <strong>{activeItem?.name}</strong> — Current Stock: <strong>{activeItem?.currentStock} {activeItem?.unit}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Quantity *</label>
                                <Input type="number" min={1} value={txForm.quantity} onChange={e => setTxForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                            </div>
                            {transactionType === 'PURCHASE' && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Unit Cost (₹)</label>
                                    <Input type="number" value={txForm.unitCost} onChange={e => setTxForm(f => ({ ...f, unitCost: Number(e.target.value) }))} />
                                </div>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Notes / Reference</label>
                            <Input value={txForm.referenceNote} onChange={e => setTxForm(f => ({ ...f, referenceNote: e.target.value }))} placeholder="Invoice no., patient name, reason..." />
                        </div>
                        <div className={`p-3 rounded-lg text-sm border ${transactionType === 'PURCHASE' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : transactionType === 'USAGE' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                            New stock after this transaction:{' '}
                            <strong>
                                {transactionType === 'PURCHASE' || transactionType === 'ADJUSTMENT'
                                    ? (activeItem?.currentStock ?? 0) + txForm.quantity
                                    : Math.max(0, (activeItem?.currentStock ?? 0) - txForm.quantity)
                                } {activeItem?.unit}
                            </strong>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTransaction(false)}>Cancel</Button>
                        <Button onClick={handleTransaction} className="bg-blue-600 hover:bg-blue-700" disabled={createTx.isPending || txForm.quantity <= 0}>
                            {createTx.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Lab Cases Tab ────────────────────────────────────────────────────────────
function LabCasesTab() {
    const [labSearch, setLabSearch] = useState('');
    const [showNewCase, setShowNewCase] = useState(false);
    const [showUpdateCase, setShowUpdateCase] = useState(false);
    const [activeCase, setActiveCase] = useState<LabCase | null>(null);
    const [newStatus, setNewStatus] = useState('SENT');

    const { data: rawLabCases, isLoading: labLoading } = useLabCases();
    const { data: rawDoctors } = useDoctors();
    const { data: rawPatients } = usePatients();
    const createLabCase = useCreateLabCase();
    const updateCaseMutation = useUpdateLabCase(activeCase?._id ?? '');

    const labCases: LabCase[] = Array.isArray(rawLabCases) ? rawLabCases as LabCase[] : (((rawLabCases as any)?.data ?? []) as LabCase[]);
    const doctors: { _id?: string; name: string }[] = Array.isArray(rawDoctors) ? rawDoctors as { _id?: string; name: string }[] : [];
    const patients: { _id?: string; name: string }[] = Array.isArray(rawPatients) ? rawPatients as { _id?: string; name: string }[] : (((rawPatients as any)?.data ?? []) as { _id?: string; name: string }[]);

    const [caseForm, setCaseForm] = useState({
        patientId: '', doctorId: '', labName: '', caseType: 'Crown', shade: '',
        sentDate: new Date().toISOString().split('T')[0],
        expectedReturnDate: '', cost: 0, notes: ''
    });

    const handleCreateCase = () => {
        createLabCase.mutate(caseForm as unknown as Record<string, unknown>, {
            onSuccess: () => {
                setShowNewCase(false);
                setCaseForm({ patientId: '', doctorId: '', labName: '', caseType: 'Crown', shade: '', sentDate: new Date().toISOString().split('T')[0], expectedReturnDate: '', cost: 0, notes: '' });
            }
        });
    };

    const filteredCases = labCases.filter(c => {
        const pat = typeof c.patientId === 'object' ? c.patientId?.name : String(c.patientId ?? '');
        return pat?.toLowerCase().includes(labSearch.toLowerCase()) ||
            c.labName?.toLowerCase().includes(labSearch.toLowerCase());
    });

    const getLabStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            SENT: 'bg-blue-100 text-blue-800',
            IN_PROGRESS: 'bg-amber-100 text-amber-800',
            RECEIVED: 'bg-green-100 text-green-800',
            FITTED: 'bg-blue-100 text-blue-800',
            CANCELLED: 'bg-red-100 text-red-800',
        };
        return <Badge className={`${styles[status] ?? 'bg-slate-100 text-slate-700'} hover:opacity-90 text-xs border-none`}>{status.replace('_', ' ')}</Badge>;
    };

    const getPatientName = (patientId: LabCase['patientId']): string => {
        if (!patientId) return 'Unknown';
        if (typeof patientId === 'object') return patientId.name ?? 'Unknown';
        return String(patientId);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4 mt-2">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search patient or lab..." value={labSearch} onChange={e => setLabSearch(e.target.value)} className="pl-9 bg-white" />
                </div>
                <Button onClick={() => setShowNewCase(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" /> New Lab Case
                </Button>
            </div>

            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead>Case ID</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Lab Name</TableHead>
                            <TableHead>Case Type (Shade)</TableHead>
                            <TableHead>Expected Return</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {labLoading && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                                </TableCell>
                            </TableRow>
                        )}
                        {!labLoading && filteredCases.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-14 text-slate-400">
                                    <FlaskConical className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                    No lab cases found. Create your first one to get started.
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredCases.map((caseItem) => (
                            <TableRow key={caseItem._id} className="hover:bg-slate-50/50">
                                <TableCell className="font-mono text-slate-500 text-xs font-medium">
                                    #{(caseItem.caseId ?? caseItem._id?.slice(-6))?.toUpperCase()}
                                </TableCell>
                                <TableCell className="font-semibold text-slate-900">{getPatientName(caseItem.patientId)}</TableCell>
                                <TableCell className="text-slate-700">{caseItem.labName ?? '-'}</TableCell>
                                <TableCell>
                                    <span className="text-slate-800">{caseItem.caseType ?? '-'}</span>
                                    {caseItem.shade && (
                                        <span className="block text-xs text-slate-400 mt-0.5">Shade: {caseItem.shade}</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-slate-600 text-sm">
                                    {caseItem.expectedReturnDate
                                        ? new Date(caseItem.expectedReturnDate).toLocaleDateString('en-IN')
                                        : '-'}
                                </TableCell>
                                <TableCell>{getLabStatusBadge(caseItem.status)}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setActiveCase(caseItem);
                                            setNewStatus(caseItem.status);
                                            setShowUpdateCase(true);
                                        }}
                                    >
                                        Update Status
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* New Lab Case Dialog */}
            <Dialog open={showNewCase} onOpenChange={setShowNewCase}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Lab Case</DialogTitle>
                        <DialogDescription>Track a dental prosthetic or lab order sent to an external lab.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Patient *</label>
                                <select value={caseForm.patientId} onChange={e => setCaseForm(f => ({ ...f, patientId: e.target.value }))}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Select patient</option>
                                    {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Doctor *</label>
                                <select value={caseForm.doctorId} onChange={e => setCaseForm(f => ({ ...f, doctorId: e.target.value }))}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Select doctor</option>
                                    {doctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Lab Name *</label>
                                <Input value={caseForm.labName} onChange={e => setCaseForm(f => ({ ...f, labName: e.target.value }))} placeholder="e.g. Premier Dental Lab" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Case Type</label>
                                <Input value={caseForm.caseType} onChange={e => setCaseForm(f => ({ ...f, caseType: e.target.value }))} placeholder="Crown, Bridge, Denture..." />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Shade</label>
                                <Input value={caseForm.shade} onChange={e => setCaseForm(f => ({ ...f, shade: e.target.value }))} placeholder="A1, A2, B1..." />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Sent Date</label>
                                <Input type="date" value={caseForm.sentDate} onChange={e => setCaseForm(f => ({ ...f, sentDate: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Expected Return</label>
                                <Input type="date" value={caseForm.expectedReturnDate} onChange={e => setCaseForm(f => ({ ...f, expectedReturnDate: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Cost (₹)</label>
                                <Input type="number" value={caseForm.cost} onChange={e => setCaseForm(f => ({ ...f, cost: Number(e.target.value) }))} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Notes</label>
                                <Input value={caseForm.notes} onChange={e => setCaseForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewCase(false)}>Cancel</Button>
                        <Button onClick={handleCreateCase} className="bg-blue-600 hover:bg-blue-700"
                            disabled={createLabCase.isPending || !caseForm.patientId || !caseForm.doctorId || !caseForm.labName}>
                            {createLabCase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Lab Case
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Update Case Status Dialog */}
            <Dialog open={showUpdateCase} onOpenChange={setShowUpdateCase}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Lab Case Status</DialogTitle>
                        <DialogDescription>
                            Case for <strong>{activeCase ? getPatientName(activeCase.patientId) : ''}</strong> at <strong>{activeCase?.labName}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-3">
                        <label className="text-sm font-medium">New Status</label>
                        <select
                            value={newStatus}
                            onChange={e => setNewStatus(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                        >
                            {LAB_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUpdateCase(false)}>Cancel</Button>
                        <Button
                            onClick={() => updateCaseMutation.mutate({ status: newStatus }, { onSuccess: () => setShowUpdateCase(false) })}
                            className="bg-blue-600 hover:bg-blue-700"
                            disabled={updateCaseMutation.isPending}
                        >
                            {updateCaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Status
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function InventoryList() {
    return (
        <PageWrapper
            title="Inventory & Lab Cases"
            description="Manage clinic stock, record usage and purchases, and track dental lab orders."
        >
            <Tabs defaultValue="stock" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="stock" className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" /> Stock Items
                    </TabsTrigger>
                    <TabsTrigger value="lab" className="flex items-center gap-1.5">
                        <FlaskConical className="h-3.5 w-3.5" /> Lab Cases
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="stock"><StockTab /></TabsContent>
                <TabsContent value="lab"><LabCasesTab /></TabsContent>
            </Tabs>
        </PageWrapper>
    );
}
