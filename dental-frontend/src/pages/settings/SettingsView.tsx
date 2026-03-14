import { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import {
    Save, Plus, Trash2, GripVertical, Loader2, Pencil, X, CheckCircle2,
    Building2, Stethoscope,
} from 'lucide-react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../../components/ui/dialog';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useProcedures, useCreateProcedure } from '../../hooks/useBilling';
import { useDoctors } from '../../hooks/useBilling';
import api from '../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Procedure {
    _id?: string;
    name: string;
    code: string;
    category: string;
    defaultPrice: number;
    defaultDuration: number;
    taxable: boolean;
    isActive?: boolean;
}

interface Doctor {
    _id?: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    isActive?: boolean;
    doctorProfile?: {
        specialization?: string;
        registrationNumber?: string;
    };
}

const PROC_CATEGORIES = [
    'General', 'Endodontics', 'Surgery', 'Preventative', 'Prosthodontics',
    'Orthodontics', 'Cosmetic', 'Diagnostic', 'Periodontics',
];

const SPECIALIZATIONS = [
    'General Dentistry', 'Endodontics', 'Orthodontics', 'Periodontics',
    'Prosthodontics', 'Oral & Maxillofacial Surgery', 'Paediatric Dentistry',
    'Oral Medicine', 'Implantology', 'Cosmetic Dentistry',
];

// ─── Procedures Tab ───────────────────────────────────────────────────────────
function ProceduresTab() {
    const { data: rawProcs, isLoading } = useProcedures();
    const createProc = useCreateProcedure();
    const queryClient = useQueryClient();

    const updateProc = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Procedure> }) => {
            const res = await api.patch(`/procedures/${id}`, data);
            return res.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procedures'] }),
    });

    const procedures: Procedure[] = Array.isArray(rawProcs) ? rawProcs : [];
    const [showDialog, setShowDialog] = useState(false);
    const [editProc, setEditProc] = useState<Procedure | null>(null);
    const [form, setForm] = useState<Procedure>({
        name: '', code: '', category: 'General', defaultPrice: 0, defaultDuration: 30, taxable: true,
    });

    const openAdd = () => {
        setEditProc(null);
        setForm({ name: '', code: '', category: 'General', defaultPrice: 0, defaultDuration: 30, taxable: true });
        setShowDialog(true);
    };

    const openEdit = (proc: Procedure) => {
        setEditProc(proc);
        setForm({ ...proc });
        setShowDialog(true);
    };

    const handleSave = () => {
        if (editProc?._id) {
            updateProc.mutate({ id: editProc._id, data: form }, { onSuccess: () => setShowDialog(false) });
        } else {
            createProc.mutate(form as Record<string, unknown>, { onSuccess: () => setShowDialog(false) });
        }
    };

    const handleDeactivate = (proc: Procedure) => {
        if (proc._id) {
            updateProc.mutate({ id: proc._id, data: { isActive: false } });
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4 mt-2">
                <div>
                    <h3 className="font-semibold text-lg text-slate-800">Master Procedure List</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Define treatments offered and their default prices.</p>
                </div>
                <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Procedure
                </Button>
            </div>

            <Card className="shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead>Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Base Price (₹)</TableHead>
                                <TableHead>Taxable</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10">
                                        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && procedures.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-slate-400">
                                        No procedures yet. Click &ldquo;Add Procedure&rdquo; or visit{' '}
                                        <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/procedures/seed`} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                                            Seeder
                                        </a>{' '}
                                        to auto-populate.
                                    </TableCell>
                                </TableRow>
                            )}
                            {procedures.map((proc) => (
                                <TableRow key={proc._id}>
                                    <TableCell className="font-mono text-slate-500 text-xs">{proc.code}</TableCell>
                                    <TableCell className="font-medium text-slate-900">{proc.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">{proc.category}</Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-500">{proc.defaultDuration} min</TableCell>
                                    <TableCell className="font-semibold text-slate-800">
                                        ₹{Number(proc.defaultPrice).toLocaleString('en-IN')}
                                    </TableCell>
                                    <TableCell>
                                        {proc.taxable
                                            ? <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs border-none">GST</Badge>
                                            : <Badge variant="outline" className="text-xs text-slate-400">Exempt</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEdit(proc)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDeactivate(proc)} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Deactivate
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editProc ? 'Edit Procedure' : 'Add New Procedure'}</DialogTitle>
                        <DialogDescription>Fill in the procedure details below.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Name</label>
                                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Root Canal Treatment" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Code</label>
                                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. RCT-01" className="font-mono" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Category</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    {PROC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Duration (min)</label>
                                <Input type="number" value={form.defaultDuration} onChange={e => setForm(f => ({ ...f, defaultDuration: Number(e.target.value) }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Base Price (₹)</label>
                                <Input type="number" value={form.defaultPrice} onChange={e => setForm(f => ({ ...f, defaultPrice: Number(e.target.value) }))} />
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                                <Switch checked={form.taxable} onCheckedChange={v => setForm(f => ({ ...f, taxable: v }))} />
                                <label className="text-sm font-medium">Apply GST (18%)</label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                        <Button
                            onClick={handleSave}
                            className="bg-blue-600 hover:bg-blue-700"
                            disabled={createProc.isPending || updateProc.isPending || !form.name}
                        >
                            {(createProc.isPending || updateProc.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editProc ? 'Save Changes' : 'Add Procedure'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Doctors Tab ──────────────────────────────────────────────────────────────
function DoctorsTab() {
    const queryClient = useQueryClient();
    const { data: rawDoctors, isLoading } = useDoctors();
    const doctors: Doctor[] = Array.isArray(rawDoctors) ? rawDoctors : [];

    const [showDialog, setShowDialog] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: '', email: '', password: '',
        specialization: 'General Dentistry', registrationNumber: '',
    });

    const createDoctor = useMutation({
        mutationFn: async (data: typeof form) => {
            const res = await api.post('/auth/create-user', {
                name: data.name.trim(),
                email: data.email.trim(),
                password: data.password,
                role: 'DOCTOR',
                doctorProfile: {
                    specialization: data.specialization,
                    registrationNumber: data.registrationNumber.trim(),
                },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] });
            queryClient.invalidateQueries({ queryKey: ['users', 'doctors'] });
            setShowDialog(false);
            setServerError(null);
            setForm({ name: '', email: '', password: '', specialization: 'General Dentistry', registrationNumber: '' });
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message;
            setServerError(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to create doctor. Please try again.'));
        },
    });

    const handleAdd = () => {
        setServerError(null);
        if (!form.name || !form.email || form.password.length < 8) {
            setServerError('Name and email are required. Password must be at least 8 characters.');
            return;
        }
        createDoctor.mutate(form);
    };

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const AVATAR_GRADIENTS = [
        'from-blue-400 to-indigo-600',
        'from-indigo-400 to-purple-600',
        'from-pink-400 to-rose-600',
        'from-amber-400 to-orange-600',
        'from-blue-400 to-cyan-600',
    ];

    return (
        <div>
            <div className="flex items-center justify-between mb-6 mt-2">
                <div>
                    <h3 className="font-semibold text-lg text-slate-800">Doctors &amp; Dentists</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {doctors.length} doctor{doctors.length !== 1 ? 's' : ''} registered in this clinic
                    </p>
                </div>
                <Button
                    onClick={() => { setShowDialog(true); setServerError(null); }}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Doctor
                </Button>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                </div>
            )}

            {!isLoading && doctors.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Stethoscope className="h-12 w-12 mb-3 text-slate-200" />
                    <p className="font-medium text-slate-500">No doctors yet</p>
                    <p className="text-sm mt-1">Click &ldquo;Add Doctor&rdquo; to register the first practitioner.</p>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {doctors.map((doc, idx) => (
                    <div
                        key={doc._id}
                        className="relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                        <div className={`h-2 bg-gradient-to-r ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`} />
                        <div className="p-5">
                            <div className="flex items-start gap-4">
                                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]} flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm`}>
                                    {getInitials(doc.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-900 text-base truncate">Dr. {doc.name}</p>
                                    <p className="text-xs text-blue-700 font-medium mt-0.5">
                                        {doc.doctorProfile?.specialization ?? 'General Dentistry'}
                                    </p>
                                    {doc.doctorProfile?.registrationNumber && (
                                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                            Reg: {doc.doctorProfile.registrationNumber}
                                        </p>
                                    )}
                                </div>
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs border-none flex-shrink-0">
                                    Active
                                </Badge>
                            </div>

                            <div className="mt-4 space-y-1.5 border-t border-slate-50 pt-3">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="font-mono text-slate-300">@</span>
                                    <span className="truncate">{doc.email}</span>
                                </div>
                                {doc.phone && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span className="text-slate-300">☏</span>
                                        <span>{doc.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Doctor Dialog */}
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setServerError(null); }}>
                <DialogContent className="max-w-md">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 -mx-6 -mt-6 px-6 py-5 rounded-t-lg mb-4">
                        <DialogHeader>
                            <DialogTitle className="text-white flex items-center gap-2">
                                <Stethoscope className="h-5 w-5" /> Register New Doctor
                            </DialogTitle>
                            <DialogDescription className="text-blue-100 text-sm">
                                The doctor will immediately appear in appointment and billing dropdowns.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {serverError && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-2">
                            <X className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
                            {serverError}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-sm font-medium">Full Name <span className="text-red-500">*</span></label>
                            <Input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Priya Sharma"
                                className="bg-slate-50"
                            />
                            <p className="text-xs text-slate-400">&ldquo;Dr.&rdquo; prefix will be added automatically in the app.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Email Address <span className="text-red-500">*</span></label>
                            <Input
                                type="email"
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="doctor@clinic.com"
                                className="bg-slate-50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Login Password <span className="text-red-500">*</span></label>
                            <Input
                                type="password"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                placeholder="Min 8 characters"
                                className="bg-slate-50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Specialization</label>
                            <select
                                value={form.specialization}
                                onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}
                                className="flex h-10 w-full rounded-md border border-input bg-slate-50 px-3 py-2 text-sm"
                            >
                                {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">MCI / State Reg. Number</label>
                            <Input
                                value={form.registrationNumber}
                                onChange={e => setForm(f => ({ ...f, registrationNumber: e.target.value }))}
                                placeholder="e.g. MH-12345"
                                className="bg-slate-50 font-mono"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                        <Button
                            onClick={handleAdd}
                            className="bg-blue-600 hover:bg-blue-700 min-w-[130px]"
                            disabled={createDoctor.isPending}
                        >
                            {createDoctor.isPending
                                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering&hellip;</>
                                : <><CheckCircle2 className="mr-2 h-4 w-4" /> Add Doctor</>
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Clinic Tab ───────────────────────────────────────────────────────────────
function ClinicTab() {
    const [saved, setSaved] = useState(false);
    const [clinicName, setClinicName] = useState('Smile Dental Clinic');
    const [phone, setPhone] = useState('+91 98765 43210');
    const [email, setEmail] = useState('hello@smiledentalclinic.in');
    const [address, setAddress] = useState('123 Health Avenue, Mumbai, MH 400001');
    const [gstin, setGstin] = useState('27AADCB2230M1Z2');
    const [openTime, setOpenTime] = useState('09:00');
    const [closeTime, setCloseTime] = useState('20:00');
    const [slotDuration, setSlotDuration] = useState(30);
    const [workingDays, setWorkingDays] = useState({
        Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false,
    });

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-full md:col-span-2 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        General Information
                    </CardTitle>
                    <CardDescription>Public-facing details for your dental clinic.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Clinic Name</label>
                        <Input value={clinicName} onChange={e => setClinicName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Contact Phone</label>
                            <Input value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Contact Email</label>
                            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Full Address</label>
                        <Input value={address} onChange={e => setAddress(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">GSTIN</label>
                        <Input value={gstin} onChange={e => setGstin(e.target.value)} className="font-mono text-sm" placeholder="27AADCB2230M1Z2" />
                        <p className="text-xs text-slate-500">Required for GST invoices. Leave blank if not applicable.</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="col-span-full md:col-span-1 shadow-sm border-blue-50">
                <CardHeader>
                    <CardTitle>Operational Setup</CardTitle>
                    <CardDescription>Working hours and booking defaults.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Working Days</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(workingDays) as (keyof typeof workingDays)[]).map(day => (
                                <div key={day} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={day}
                                        checked={workingDays[day]}
                                        onCheckedChange={(v) => setWorkingDays(d => ({ ...d, [day]: !!v }))}
                                    />
                                    <label htmlFor={day} className="text-sm font-medium leading-none cursor-pointer">{day}</label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                        <label className="text-sm font-medium">Clinic Hours</label>
                        <div className="flex items-center gap-2">
                            <Input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} className="w-[120px]" />
                            <span className="text-slate-500 text-sm">to</span>
                            <Input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} className="w-[120px]" />
                        </div>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                        <label className="text-sm font-medium">Default Slot Duration</label>
                        <div className="flex items-center gap-2">
                            <Input type="number" value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))} className="w-24" />
                            <span className="text-sm text-slate-500">minutes</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="col-span-full flex justify-end">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 min-w-[140px]">
                    {saved ? (
                        <><CheckCircle2 className="mr-2 h-4 w-4" /> Saved!</>
                    ) : (
                        <><Save className="mr-2 h-4 w-4" /> Save Changes</>
                    )}
                </Button>
            </div>
        </div>
    );
}

// ─── Chairs Tab ───────────────────────────────────────────────────────────────
function ChairsTab() {
    const [chairs, setChairs] = useState([
        { id: '1', name: 'Chair 1 (Main Surgery)', isDefault: true },
        { id: '2', name: 'Chair 2 (Hygiene)', isDefault: false },
        { id: '3', name: 'Chair 3 (Orthodontics)', isDefault: false },
    ]);
    const [newChairName, setNewChairName] = useState('');
    const [saved, setSaved] = useState(false);

    const addChair = () => {
        if (!newChairName.trim()) return;
        setChairs(c => [...c, { id: String(Date.now()), name: newChairName.trim(), isDefault: false }]);
        setNewChairName('');
    };

    const removeChair = (id: string) => {
        setChairs(c => c.filter(chair => chair.id !== id));
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4 mt-2">
                <div>
                    <h3 className="font-semibold text-lg text-slate-800">Clinic Chairs</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Manage dental chairs available for appointment scheduling.</p>
                </div>
            </div>

            <div className="grid gap-4 max-w-2xl">
                <Card className="shadow-sm">
                    <CardContent className="p-4 space-y-2">
                        {chairs.map((chair) => (
                            <div key={chair.id} className="flex flex-row items-center justify-between p-3 border rounded-md bg-slate-50 group hover:bg-white hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <GripVertical className="h-4 w-4 text-slate-300 cursor-grab" />
                                    <span className="font-medium text-slate-800">{chair.name}</span>
                                    {chair.isDefault && <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-400 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                    onClick={() => removeChair(chair.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}

                        <div className="flex items-center gap-2 pt-2 border-t mt-2">
                            <Input
                                value={newChairName}
                                onChange={e => setNewChairName(e.target.value)}
                                placeholder="New chair name..."
                                className="flex-1"
                                onKeyDown={e => e.key === 'Enter' && addChair()}
                            />
                            <Button onClick={addChair} variant="outline" size="sm">
                                <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                        {saved ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Saved!</> : <><Save className="mr-2 h-4 w-4" /> Save Chairs</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SettingsView() {
    return (
        <PageWrapper
            title="Clinic Settings"
            description="Manage your facility information, team members, and service catalog."
        >
            <Tabs defaultValue="clinic" className="w-full">
                <TabsList className="mb-6">
                    <TabsTrigger value="clinic" className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> Clinic Details
                    </TabsTrigger>
                    <TabsTrigger value="doctors" className="flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5" /> Doctors
                    </TabsTrigger>
                    <TabsTrigger value="procedures" className="flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5" /> Procedures
                    </TabsTrigger>
                    <TabsTrigger value="chairs" className="flex items-center gap-1.5">
                        <GripVertical className="h-3.5 w-3.5" /> Chairs
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="clinic"><ClinicTab /></TabsContent>
                <TabsContent value="doctors"><DoctorsTab /></TabsContent>
                <TabsContent value="procedures"><ProceduresTab /></TabsContent>
                <TabsContent value="chairs"><ChairsTab /></TabsContent>
            </Tabs>
        </PageWrapper>
    );
}
