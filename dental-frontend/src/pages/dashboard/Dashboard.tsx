import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Download, Users, CalendarCheck, IndianRupee, TrendingUp, Loader2 } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { useDashboard } from '../../hooks/useReports';
import { useTodayAppointments } from '../../hooks/useAppointments';
import { useLowStockItems } from '../../hooks/useInventory';

export function Dashboard() {
    const { data: dashData, isLoading: dashLoading } = useDashboard();
    const { data: todayAppts, isLoading: apptLoading } = useTodayAppointments();
    const { data: lowStock } = useLowStockItems();

    // Flatten today's appointments (backend returns them grouped by doctorId: { doctorId1: [...], doctorId2: [...] })
    const appointments: {
        time?: string;
        startTime?: string;
        patient?: { name?: string };
        patientId?: { name?: string };
        patientName?: string;
        procedure?: string;
        procedures?: string[];
        doctor?: string;
        doctorId?: { name?: string };
        doctorName?: string;
        status?: string;
    }[] = Array.isArray(todayAppts)
        ? todayAppts
        : todayAppts && typeof todayAppts === 'object'
            ? Object.values(todayAppts as Record<string, unknown[]>).flat()
            : [];

    // Revenue chart data from backend or fallback
    const revenueData = dashData?.revenueChart ?? dashData?.dailyRevenue ?? [
        { name: 'Mon', revenue: 0 }, { name: 'Tue', revenue: 0 }, { name: 'Wed', revenue: 0 },
        { name: 'Thu', revenue: 0 }, { name: 'Fri', revenue: 0 }, { name: 'Sat', revenue: 0 },
    ];

    return (
        <PageWrapper
            title="Hospital Overview"
            description="Quick summary of today's activities and overall metrics."
            action={
                <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" /> Download Report
                </Button>
            }
        >
            {/* Top Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Total Patients</CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">
                            {dashLoading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : (dashData?.totalPatients ?? dashData?.monthNewPatients ?? 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            <span className="text-indigo-500 flex items-center inline-flex">
                                <TrendingUp className="h-3 w-3 mr-1" /> {dashData?.todayNewPatients ?? 0} new today
                            </span>
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Appointments Today</CardTitle>
                        <CalendarCheck className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">
                            {dashLoading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : (dashData?.todayAppointments ?? 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-slate-500">
                            {dashData?.monthAppointments ?? 0} this month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Revenue (MTD)</CardTitle>
                        <IndianRupee className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">
                            {dashLoading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : `₹${(dashData?.monthRevenue ?? 0).toLocaleString('en-IN')}`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-slate-500">
                            ₹{(dashData?.pendingPaymentsTotal ?? 0).toLocaleString('en-IN')} outstanding
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Low Stock Items</CardTitle>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-orange-500">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {dashLoading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : (dashData?.lowStockCount ?? 0)}
                        </div>
                        <p className="text-xs text-orange-500 mt-1">Items need restocking</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-8">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-slate-800">Revenue Overview (7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full mt-4">
                            {dashLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={revenueData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `₹${v}`} dx={-10} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v) => [`₹${v}`, 'Revenue']} />
                                        <Line type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={3} dot={{ r: 4, fill: '#0d9488', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-slate-800">Appointments by Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full mt-4">
                            {dashLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                </div>
                            ) : !dashData?.appointmentsByStatus?.length ? (
                                <div className="flex items-center justify-center h-full text-slate-400 text-sm">No appointment data this month</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashData.appointmentsByStatus}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                        <YAxis hide />
                                        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Today's Appointments & Alerts */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-8">
                <Card className="col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-semibold text-slate-800">Today's Appointments</CardTitle>
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">View All</Button>
                    </CardHeader>
                    <CardContent>
                        {apptLoading && (
                            <div className="flex justify-center items-center h-20">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            </div>
                        )}
                        <div className="space-y-3 mt-4">
                            {appointments.length === 0 && !apptLoading && (
                                <p className="text-sm text-slate-400 text-center py-8">No appointments scheduled for today</p>
                            )}
                            {appointments.slice(0, 5).map((apt, i) => {
                                // startTime is a time string like "09:30", not a full ISO date
                                const time = apt.startTime ?? apt.time ?? '-';
                                // Backend populates patientId as { name, phone, patientId }
                                const patientName = apt.patientId?.name ?? apt.patient?.name ?? apt.patientName ?? 'Unknown';
                                const procedure = (apt.procedures && apt.procedures[0]) ?? apt.procedure ?? '-';
                                // Backend populates doctorId as { name, email }
                                const doctor = apt.doctorId?.name ?? apt.doctorName ?? apt.doctor ?? '-';
                                const status = apt.status ?? 'SCHEDULED';
                                return (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-md min-w-[85px] text-center">{time}</div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{patientName}</p>
                                                <p className="text-xs text-slate-500">{procedure} • {doctor}</p>
                                            </div>
                                        </div>
                                        <Badge variant={status === 'IN_PROGRESS' || status === 'In Progress' ? 'default' : status === 'WAITING' || status === 'Waiting' ? 'destructive' : 'secondary'}
                                            className={status === 'IN_PROGRESS' || status === 'In Progress' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}>
                                            {status.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-semibold text-slate-800">Tasks & Alerts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 mt-4">
                            {Array.isArray(lowStock) && lowStock.length > 0 && (
                                <div className="flex gap-3 items-start p-3 bg-red-50 text-red-900 rounded-lg border border-red-100">
                                    <div className="mt-0.5 h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">Low Stock Alert</p>
                                        <p className="text-xs opacity-80 mt-1">{lowStock.length} items are below minimum stock level.</p>
                                    </div>
                                </div>
                            )}
                            {(dashData?.pendingLabCases ?? 0) > 0 && (
                                <div className="flex gap-3 items-start p-3 bg-amber-50 text-amber-900 rounded-lg border border-amber-100">
                                    <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">Pending Lab Cases</p>
                                        <p className="text-xs opacity-80 mt-1">{dashData.pendingLabCases} lab cases awaiting delivery.</p>
                                    </div>
                                </div>
                            )}
                            {(dashData?.overdueInvoices ?? 0) > 0 && (
                                <div className="flex gap-3 items-start p-3 bg-indigo-50 text-indigo-900 rounded-lg border border-indigo-100">
                                    <div className="mt-0.5 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">Action Required</p>
                                        <p className="text-xs opacity-80 mt-1">{dashData.overdueInvoices} invoices are overdue by more than 15 days.</p>
                                    </div>
                                </div>
                            )}
                            {!dashLoading && !lowStock?.length && !dashData?.pendingLabCases && !dashData?.overdueInvoices && (
                                <p className="text-sm text-slate-400 text-center py-6">✅ No pending alerts!</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageWrapper>
    );
}
