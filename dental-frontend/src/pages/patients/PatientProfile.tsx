import { useParams, useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/button';
import { Calendar as CalendarIcon, Phone, Mail, Edit } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

// Mock Data
const patient = {
    id: '1',
    name: 'John Doe',
    dob: '1985-05-15',
    gender: 'Male',
    phone: '+91 98765 43210',
    email: 'john.doe@example.com',
    address: '123 Main St, Mumbai',
    status: 'Active',
    lastVisit: '2026-02-15',
    medicalNotes: 'Allergic to Penicillin. Mild hypertension.',
};

export function PatientProfile() {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <PageWrapper
            title={patient.name}
            description={`Patient ID: #PT-${id} • Added Oct 2025`}
            action={
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate(`/appointments?patient=${id}`)}>
                        <CalendarIcon className="mr-2 h-4 w-4" /> Book Appointment
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Edit className="mr-2 h-4 w-4" /> Edit Profile
                    </Button>
                </div>
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card className="md:col-span-1 border-t-4 border-t-blue-600 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-semibold text-lg">Contact Info</h3>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">{patient.status}</Badge>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-3 text-slate-600">
                                <Phone className="h-4 w-4 text-slate-400" />
                                <span>{patient.phone}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <Mail className="h-4 w-4 text-slate-400" />
                                <span>{patient.email}</span>
                            </div>
                            <div className="pt-4 mt-4 border-t space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <span className="text-slate-500">Age / Gender:</span>
                                    <span className="font-medium text-slate-900">38y, {patient.gender}</span>

                                    <span className="text-slate-500">Last Visit:</span>
                                    <span className="font-medium text-slate-900">{patient.lastVisit}</span>
                                </div>
                            </div>
                            <div className="pt-4 mt-4 border-t bg-yellow-50 -mx-6 px-6 pb-6 rounded-b-lg">
                                <span className="font-medium text-yellow-800 text-xs uppercase tracking-wider block mb-1">Medical Alerts</span>
                                <p className="text-sm font-medium text-slate-800">{patient.medicalNotes}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2">
                    <Tabs defaultValue="history" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="history">Visits</TabsTrigger>
                            <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
                            <TabsTrigger value="documents">Files</TabsTrigger>
                            <TabsTrigger value="billing">Billing</TabsTrigger>
                        </TabsList>

                        <TabsContent value="history" className="mt-4">
                            <Card>
                                <CardContent className="p-6">
                                    <h4 className="font-medium mb-4">Treatment Timeline</h4>
                                    <div className="space-y-6">
                                        <div className="relative pl-6 border-l-2 border-blue-100 pb-2">
                                            <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-4 border-white bg-blue-500"></span>
                                            <span className="text-sm text-slate-500 font-medium">{patient.lastVisit} • Dr. Smith</span>
                                            <h5 className="font-semibold text-slate-900 mt-1">Routine Scaling & Polishing</h5>
                                            <p className="text-sm text-slate-600 mt-1">Patient reported mild sensitivity in lower left quadrant. Applied desensitizing agent. Everything else appears normal.</p>
                                            <div className="mt-3">
                                                <Badge variant="secondary" className="mr-2">Scaling</Badge>
                                                <Badge variant="secondary">Checkup</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notes" className="mt-4">
                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="font-medium text-slate-800">Active Treatment Plan & Notes</h4>
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">+ Add Clinical Note</Button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="p-4 border rounded-md bg-slate-50 hover:bg-white transition-colors cursor-pointer">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h5 className="font-semibold text-indigo-900">Root Canal Treatment - Tooth 16</h5>
                                                    <p className="text-sm text-slate-500 mt-1">Diagnosed with irreversible pulpitis. Scheduled for 2-visit RCT.</p>
                                                </div>
                                                <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-none">Ongoing</Badge>
                                            </div>
                                            <div className="flex gap-2 mt-4 text-xs font-medium text-slate-500">
                                                <span className="bg-slate-200 px-2 py-1 rounded">Prescription Added</span>
                                                <span className="bg-slate-200 px-2 py-1 rounded">Tooth Chart Updated</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="documents" className="mt-4">
                            <Card>
                                <CardContent className="p-12 text-center text-muted-foreground border-dashed border-2 m-4">
                                    Document management UI
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="billing" className="mt-4">
                            <Card>
                                <CardContent className="p-12 text-center text-muted-foreground border-dashed border-2 m-4">
                                    Patient invoices & payments
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </PageWrapper>
    );
}
