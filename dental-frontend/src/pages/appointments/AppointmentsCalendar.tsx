import { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/button';
import {
    Plus, X, Loader2, Mail, Phone, Clock, Calendar as CalendarIcon,
    User, Stethoscope, FileText, CheckCircle2, AlertCircle,
    Sparkles, Camera, Image as ImageIcon, CameraOff
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select';
import { useCalendarAppointments, useCreateAppointment, useAvailableSlots } from '../../hooks/useAppointments';
import { useAuthStore } from '../../hooks/useAuthStore';
import api from '../../lib/api';
import { useUploadFile } from '../../hooks/useStorage';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface CalendarEvent {
    id?: string;
    title: string;
    start: Date;
    end: Date;
    resource: string;
    status?: string;
    patientName?: string;
    doctorName?: string;
    type?: string;
    chiefComplaint?: string;
    notes?: string;
    phone?: string;
    email?: string;
    chairId?: string;
}


interface Doctor {
    _id: string;
    name: string;
    email: string;
    role: string;
    doctorProfile?: {
        specialization?: string;
        color?: string;
    };
}

interface AppointmentDetail {
    _id: string;
    patientId: { _id: string; name: string; phone: string; email?: string };
    doctorId: { _id: string; name: string };
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    type: string;
    chiefComplaint?: string;
    notes?: string;
    duration: number;
    tokenNumber?: number;
}

interface BookingSuccess {
    patientName: string;
    doctorName: string;
    date: string;
    time: string;
    type: string;
    tokenNumber?: number;
    emailSent: boolean;
    patientEmail?: string;
}

const APPOINTMENT_TYPES: Record<string, string> = {
    CONSULTATION: 'Consultation',
    NEW_PATIENT: 'New Patient',
    FOLLOW_UP: 'Follow Up',
    PROCEDURE: 'Procedure',
    EMERGENCY: 'Emergency',
};

// Clinic chairs — each with a distinct color for the calendar
const CLINIC_CHAIRS: { id: string; name: string; color: string; light: string }[] = [
    { id: 'CHAIR-1', name: 'Chair 1 — Main Surgery', color: '#1e40af', light: '#dbeafe' },
    { id: 'CHAIR-2', name: 'Chair 2 — Hygiene',      color: '#7c3aed', light: '#ede9fe' },
    { id: 'CHAIR-3', name: 'Chair 3 — Orthodontics', color: '#db2777', light: '#fce7f3' },
    { id: 'CHAIR-4', name: 'Chair 4 — Paediatric',   color: '#d97706', light: '#fef3c7' },
    { id: 'CHAIR-5', name: 'Chair 5 — Implants',     color: '#2563eb', light: '#dbeafe' },
];

export function AppointmentsCalendar() {
    const [view, setView] = useState<View>('month');
    const [date, setDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetail | null>(null);
    const [bookingSuccess, setBookingSuccess] = useState<BookingSuccess | null>(null);
    const [bookingError, setBookingError] = useState<string | null>(null);

    // Form state — patient details are always entered directly (no DB search)
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientPhone, setNewPatientPhone] = useState('');
    const [selectedDoctor, setSelectedDoctor] = useState<string>('');
    const [selectedDoctorObj, setSelectedDoctorObj] = useState<Doctor | null>(null);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [selectedChair, setSelectedChair] = useState<string>('');
    const [appointmentType, setAppointmentType] = useState<string>('CONSULTATION');
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [notes, setNotes] = useState('');
    const [patientEmail, setPatientEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [isCameraInitializing, setIsCameraInitializing] = useState(false);
    const [troubleshootMode, setTroubleshootMode] = useState(false);
    const [shutterFlash, setShutterFlash] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const uploadFile = useUploadFile();

    // Robust video element binding
    useEffect(() => {
        const video = videoRef.current;
        if (showCamera && stream && video) {
            // Only assign if it's different to avoid flickering/restarts
            if (video.srcObject !== stream) {
                video.srcObject = stream;
            }
            
            // Explicitly try to play
            const tryPlay = async () => {
                try {
                    await video.play();
                } catch (err) {
                    console.error("Auto-play failed:", err);
                    // This often happens due to browser policy; troubleshootMode handles this via guidance
                }
            };
            tryPlay();
        }
    }, [showCamera, stream, videoRef.current]); // videoRef.current included to catch mounting

    // Request camera when showCamera is toggled ON
    useEffect(() => {
        let isMounted = true;
        if (showCamera && !stream) {
            setIsCameraInitializing(true);
            setBookingError(null);
            setTroubleshootMode(false);

            const initCamera = async () => {
                try {
                    // Maximum compatibility constraints
                    const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'user' } 
                    });
                    
                    if (!isMounted) {
                        mediaStream.getTracks().forEach(t => t.stop());
                        return;
                    }

                    const videoTrack = mediaStream.getVideoTracks()[0];
                    if (videoTrack) {
                        // Diagnostic: Check if track is muted (hardware block)
                        if (videoTrack.muted) {
                            setBookingError("Your laptop's camera is physically blocked or disabled in privacy settings.");
                            setTroubleshootMode(true);
                        }
                        
                        videoTrack.onmute = () => {
                            if (isMounted) {
                                setBookingError("Camera hardware was muted.");
                                setTroubleshootMode(true);
                            }
                        };
                        videoTrack.onunmute = () => {
                            if (isMounted) {
                                setBookingError(null);
                                setTroubleshootMode(false);
                            }
                        };
                    }

                    setStream(mediaStream);
                    streamRef.current = mediaStream;
                    setIsCameraInitializing(false);
                } catch (err: any) {
                    setIsCameraInitializing(false);
                    console.error("Camera access error:", err);
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        setBookingError("Camera Access Blocked: Please look at your browser's address bar to ALLOW camera access.");
                    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                        setBookingError("No camera found. Please plug in a webcam.");
                    } else {
                        setBookingError(`Webcam Error: ${err.message}`);
                    }
                    setTroubleshootMode(true);
                }
            };
            initCamera();
        }
        return () => { isMounted = false; };
    }, [showCamera, stream]);

    const { token } = useAuthStore();

    const { startDate, endDate } = useMemo(() => {
        const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 2, 0);
        return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
        };
    }, [date]);

    const { data: appointments = [] } = useCalendarAppointments(startDate, endDate);
    const createAppointment = useCreateAppointment();

    // Fetch doctors from real DB — /users/doctors returns array directly (no wrapper)
    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const res = await api.get('/users/doctors');
                // The endpoint returns the array directly, not wrapped in { data: [] }
                const doctorList = Array.isArray(res.data) ? res.data : (res.data.data || []);
                setDoctors(doctorList);
            } catch (error) {
                console.error('Failed to fetch doctors:', error);
            }
        };
        if (token) fetchDoctors();
    }, [token]);

    const { data: slotData } = useAvailableSlots(selectedDoctor, selectedDate || '', 30);
    const availableSlots: string[] = slotData?.available || [];
    const bookedSlots: string[] = slotData?.booked || [];

    const events: CalendarEvent[] = useMemo(() => {
        return appointments.map((appt: Record<string, unknown>) => {
            const apptDate = new Date(appt.date as string);
            const [startHour, startMin] = (appt.startTime as string).split(':');
            const [endHour, endMin] = (appt.endTime as string).split(':');
            const start = new Date(apptDate);
            start.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
            const end = new Date(apptDate);
            end.setHours(parseInt(endHour), parseInt(endMin), 0, 0);
            const patient = appt.patientId as Record<string, string> | undefined;
            const doctor = appt.doctorId as Record<string, string> | undefined;
            const patientName = patient?.name || 'Unknown Patient';
            const doctorName = doctor?.name || 'Unknown Doctor';
            const type = (appt.type as string) || 'Appointment';
            return {
                id: appt._id as string,
                title: `${type} - ${patientName}`,
                start, end,
                resource: doctorName,
                status: appt.status as string,
                patientName, doctorName, type,
                chiefComplaint: appt.chiefComplaint as string,
                notes: appt.notes as string,
                phone: patient?.phone,
                email: patient?.email,
                chairId: appt.chairId as string | undefined,
            };
        });
    }, [appointments]);

    const handleSelectSlot = ({ start }: { start: Date }) => {
        setSelectedDate(format(start, 'yyyy-MM-dd'));
        setIsBookingDialogOpen(true);
        resetForm();
    };

    const handleSelectEvent = async (event: CalendarEvent) => {
        if (!event.id) return;
        try {
            const res = await api.get(`/appointments/${event.id}`);
            // Backend may return the appointment directly or wrapped in { data: {} }
            const apptData = res.data?.data || res.data;
            setSelectedAppointment(apptData);
            setIsDetailDialogOpen(true);
        } catch {
            setSelectedAppointment({
                _id: event.id || '',
                patientId: { _id: '', name: event.patientName || '', phone: event.phone || '', email: event.email },
                doctorId: { _id: '', name: event.doctorName || '' },
                date: format(event.start, 'yyyy-MM-dd'),
                startTime: format(event.start, 'HH:mm'),
                endTime: format(event.end, 'HH:mm'),
                status: event.status || 'SCHEDULED',
                type: event.type || 'CONSULTATION',
                chiefComplaint: event.chiefComplaint,
                notes: event.notes,
                duration: 30,
            });
            setIsDetailDialogOpen(true);
        }
    };

    const resetForm = () => {
        setNewPatientName('');
        setNewPatientPhone('');
        setSelectedDoctor('');
        setSelectedDoctorObj(null);
        setSelectedTime('');
        setSelectedChair('');
        setAppointmentType('CONSULTATION');
        setChiefComplaint('');
        setNotes('');
        setPatientEmail('');
        setBookingSuccess(null);
        setBookingError(null);
        setPhotoFile(null);
        setPhotoPreview(null);
        setShowCamera(false);
        stopCamera();
    };

    const startCamera = () => {
        setBookingError(null);
        setTroubleshootMode(false);
        setShowCamera(true);
    };

    const takePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            const context = canvas.getContext('2d');
            if (context) {
                // Flash effect
                setShutterFlash(true);
                setTimeout(() => setShutterFlash(false), 150);

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], "patient_photo.jpg", { type: "image/jpeg" });
                        setPhotoFile(file);
                        setPhotoPreview(URL.createObjectURL(file));
                        stopCamera();
                        setShowCamera(false);
                    }
                }, 'image/jpeg');
            }
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setStream(null);
        setIsCameraInitializing(false);
    };

    const handleDoctorChange = (doctorId: string) => {
        setSelectedDoctor(doctorId);
        const doc = doctors.find(d => d._id === doctorId) || null;
        setSelectedDoctorObj(doc);
        setSelectedTime('');
    };

    // Whether the patient section is filled enough to book
    const patientReady = newPatientName.trim().length >= 2 && newPatientPhone.trim().length >= 6;

    const handleSubmit = async () => {
        if (!patientReady || !selectedDoctor || !selectedDate || !selectedTime) {
            setBookingError('Please fill in all required fields.');
            return;
        }
        setBookingError(null);
        setIsSubmitting(true);
        try {
            let photoUrl = '';
            if (photoFile) {
                const uploadRes = await uploadFile.mutateAsync({ file: photoFile, folder: 'patients' });
                photoUrl = uploadRes.fileUrl;
            }

            // Always create patient directly — no existing patient search
            const newPatRes = await api.post('/patients', {
                name: newPatientName.trim(),
                phone: newPatientPhone.trim(),
                email: patientEmail.trim() || undefined,
                photoUrl: photoUrl || undefined,
            });
            const created = newPatRes.data?.data || newPatRes.data;
            const patientId = created._id;
            const patientName = created.name;
            const patientEmailFinal = patientEmail.trim();

            const [hours, minutes] = selectedTime.split(':');
            const startDateTime = new Date();
            startDateTime.setHours(parseInt(hours), parseInt(minutes));
            const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);
            const endTime = format(endDateTime, 'HH:mm');

            await createAppointment.mutateAsync({
                patientId,
                doctorId: selectedDoctor,
                date: selectedDate,
                startTime: selectedTime,
                endTime,
                type: appointmentType,
                chiefComplaint,
                notes,
                duration: 30,
                ...(selectedChair ? { chairId: selectedChair } : {}),
            });

            setBookingSuccess({
                patientName,
                doctorName: selectedDoctorObj?.name || '',
                date: selectedDate,
                time: selectedTime,
                type: appointmentType,
                emailSent: !!patientEmailFinal,
                patientEmail: patientEmailFinal,
            });
        } catch (error: unknown) {
            const msg = error && typeof error === 'object' && 'response' in error
                ? (error.response as { data?: { message?: string } })?.data?.message
                : undefined;
            setBookingError(msg || 'Failed to create appointment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200';
            case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
            case 'NO_SHOW': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'CONFIRMED': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'RESCHEDULED': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    return (
        <PageWrapper
            title="Appointments"
            description="Manage your clinic's schedule and bookings."
            action={
                <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                        resetForm();
                        // Pre-fill today's date so the form is immediately usable
                        setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                        setIsBookingDialogOpen(true);
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" /> New Appointment
                </Button>
            }
        >
            {/* ── BOOKING DIALOG ───────────────────────────────────────────── */}
            <Dialog open={isBookingDialogOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsBookingDialogOpen(open);
            }}>
                <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-hidden p-0 gap-0 flex flex-col">

                    {/* SUCCESS STATE */}
                    {bookingSuccess ? (
                        <div className="flex flex-col items-center text-center p-8 gap-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-9 w-9 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Appointment Confirmed!</h2>
                                <p className="text-sm text-gray-500 mt-1">Your booking has been successfully created.</p>
                            </div>

                            {/* Summary Card */}
                            <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 text-left space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                        <User className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Patient</p>
                                        <p className="font-semibold text-gray-900">{bookingSuccess.patientName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                        <Stethoscope className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Doctor</p>
                                        <p className="font-semibold text-gray-900">{bookingSuccess.doctorName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                        <CalendarIcon className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Date & Time</p>
                                        <p className="font-semibold text-gray-900">
                                            {format(new Date(bookingSuccess.date), 'EEEE, MMMM d, yyyy')} at {bookingSuccess.time}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                        <FileText className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Type</p>
                                        <p className="font-semibold text-gray-900">{APPOINTMENT_TYPES[bookingSuccess.type] || bookingSuccess.type}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Email notice */}
                            {bookingSuccess.emailSent && (
                                <div className="w-full flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                                    <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-blue-800">Confirmation email sent</p>
                                        <p className="text-xs text-blue-600 mt-0.5">
                                            A detailed confirmation has been sent to <span className="font-semibold">{bookingSuccess.patientEmail}</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 w-full pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => { resetForm(); }}
                                >
                                    Book Another
                                </Button>
                                <Button
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    onClick={() => { setIsBookingDialogOpen(false); resetForm(); }}
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* DIALOG HEADER */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 rounded-t-lg">
                                <DialogHeader>
                                    <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5" />
                                        Book New Appointment
                                    </DialogTitle>
                                    <p className="text-blue-100 text-sm mt-1">
                                        {selectedDate
                                            ? `📅 ${format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}`
                                            : 'Schedule a new patient visit'}
                                    </p>
                                </DialogHeader>
                            </div>

                            {/* FORM BODY — scrollable fields */}
                            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

                                {/* Error Banner */}
                                {bookingError && (
                                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-700 font-medium">{bookingError}</p>
                                        <button onClick={() => setBookingError(null)} className="ml-auto text-red-400 hover:text-red-600">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}


                                {/* ── PATIENT DETAILS ── */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                                        <Label className="text-sm font-semibold text-gray-700">Patient Details <span className="text-red-500">*</span></Label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-700">Full Name <span className="text-red-500">*</span></Label>
                                            <Input
                                                placeholder="Patient full name"
                                                value={newPatientName}
                                                onChange={(e) => setNewPatientName(e.target.value)}
                                                className="bg-gray-50 border-gray-200 focus:border-blue-400 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-700">Phone <span className="text-red-500">*</span></Label>
                                            <Input
                                                placeholder="10-digit mobile number"
                                                value={newPatientPhone}
                                                onChange={(e) => setNewPatientPhone(e.target.value)}
                                                className="bg-gray-50 border-gray-200 focus:border-blue-400 text-sm"
                                            />
                                        </div>
                                    </div>
                                    {/* Email */}
                                    <div className="space-y-1">
                                        <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                                            <Mail className="h-3 w-3 text-blue-600" />
                                            Email <span className="font-normal text-gray-400">(optional — for confirmation)</span>
                                        </Label>
                                        <Input
                                            type="email"
                                            placeholder="patient@example.com"
                                            value={patientEmail}
                                            onChange={(e) => setPatientEmail(e.target.value)}
                                            className="bg-gray-50 border-gray-200 focus:border-blue-400 focus:ring-blue-400 text-sm"
                                        />
                                    </div>

                                    {/* PHOTO SECTION */}
                                    <div className="space-y-2 pt-2">
                                        <Label className="text-xs font-medium text-gray-700">Patient Photo</Label>
                                        <div className="flex flex-col gap-3">
                                            {photoPreview ? (
                                                <div className="flex items-center gap-4">
                                                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-blue-100 shadow-md">
                                                        <img src={photoPreview} alt="Patient Preview" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                            <CheckCircle2 className="text-white h-8 w-8" />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Button size="sm" variant="outline" type="button" className="text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={startCamera}>
                                                            <Camera className="h-3 w-3 mr-1" /> Retake
                                                        </Button>
                                                        <Button size="sm" variant="ghost" type="button" className="text-xs h-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>
                                                            <X className="h-3 w-3 mr-1" /> Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : showCamera ? (
                                                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-blue-100 flex items-center justify-center">
                                                    {/* Shutter Flash Effect */}
                                                    {shutterFlash && <div className="absolute inset-0 bg-white z-50 animate-in fade-in duration-75" />}
                                                    
                                                    {isCameraInitializing && !troubleshootMode && (
                                                        <div className="text-white flex flex-col items-center gap-2">
                                                            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                                                            <p className="text-sm font-medium">Connecting to camera...</p>
                                                        </div>
                                                    )}

                                                    {troubleshootMode ? (
                                                        <div className="text-center p-6 bg-gray-900/90 w-full h-full flex flex-col items-center justify-center gap-4">
                                                            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                                                                <CameraOff className="h-6 w-6 text-red-400" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-white font-semibold">Camera Blocked</p>
                                                                <p className="text-xs text-gray-400 px-6">1. Check address bar icon to <b>Allow</b>.<br/>2. Open Settings &gt; Privacy &gt; Camera.</p>
                                                            </div>
                                                            <Button size="sm" variant="outline" className="text-xs bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => { stopCamera(); setShowCamera(false); }}>
                                                                Back to Upload
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <video 
                                                                ref={videoRef} 
                                                                autoPlay 
                                                                muted 
                                                                playsInline 
                                                                onLoadedMetadata={() => {
                                                                    videoRef.current?.play().catch(console.error);
                                                                }}
                                                                className={`w-full h-full object-cover ${isCameraInitializing ? 'hidden' : 'block'}`} 
                                                            />
                                                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                                                                {!isCameraInitializing && stream && (
                                                                    <>
                                                                        <Button size="sm" type="button" onClick={takePhoto} className="bg-blue-600 hover:bg-blue-700 shadow-xl border-2 border-white/50 px-6 py-5 rounded-full scale-110">
                                                                            <Camera className="h-5 w-5 mr-2" /> Take Photo
                                                                        </Button>
                                                                        {/* Fallback button if screen is black */}
                                                                        <Button size="sm" variant="outline" type="button" onClick={() => videoRef.current?.play()} className="bg-black/40 text-white border-white/20 hover:bg-black/60 backdrop-blur-sm px-2 h-10 w-10 rounded-full" title="Fix black screen">
                                                                            <Sparkles className="h-4 w-4" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                                <Button size="sm" type="button" variant="outline" onClick={() => { stopCamera(); setShowCamera(false); }} className="bg-white/90 hover:bg-white shadow-lg">
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={startCamera} className="flex-1 border-dashed border-2 hover:border-blue-400 hover:bg-blue-50">
                                                        <Camera className="h-4 w-4 mr-2 text-blue-600" /> Webcam
                                                    </Button>
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            id="photo-upload"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    setPhotoFile(file);
                                                                    setPhotoPreview(URL.createObjectURL(file));
                                                                }
                                                            }}
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full border-dashed border-2 hover:border-blue-400 hover:bg-blue-50"
                                                            onClick={() => document.getElementById('photo-upload')?.click()}
                                                        >
                                                            <ImageIcon className="h-4 w-4 mr-2 text-blue-600" /> Upload
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                            <canvas ref={canvasRef} className="hidden" />
                                        </div>
                                    </div>
                                </div>


                                {/* ── DOCTOR ── */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
                                        <Label className="text-sm font-semibold text-gray-700">Select Doctor <span className="text-red-500">*</span></Label>
                                    </div>
                                    <Select value={selectedDoctor} onValueChange={handleDoctorChange}>
                                        <SelectTrigger className="bg-gray-50 border-gray-200 focus:border-blue-400">
                                            <SelectValue placeholder="Choose a doctor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {doctors.map((doctor) => (
                                                <SelectItem key={doctor._id} value={doctor._id}>
                                                    <div className="flex items-center gap-2">
                                                        <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
                                                        <span>{doctor.name}</span>
                                                        {doctor.doctorProfile?.specialization && (
                                                            <span className="text-xs text-gray-400">— {doctor.doctorProfile.specialization}</span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {/* Doctor card on selection */}
                                    {selectedDoctorObj && (
                                        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                                            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                {selectedDoctorObj.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-sm">{selectedDoctorObj.name}</p>
                                                <p className="text-xs text-indigo-600">
                                                    {selectedDoctorObj.doctorProfile?.specialization || 'General Dentist'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ── CHAIR ── */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
                                        <Label className="text-sm font-semibold text-gray-700">Dental Chair <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {CLINIC_CHAIRS.map((chair) => (
                                            <button
                                                key={chair.id}
                                                type="button"
                                                onClick={() => setSelectedChair(c => c === chair.id ? '' : chair.id)}
                                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                                                    selectedChair === chair.id
                                                        ? 'border-transparent shadow-md scale-[1.02]'
                                                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                                }`}
                                                style={selectedChair === chair.id ? { backgroundColor: chair.light, borderColor: chair.color, color: chair.color } : {}}
                                            >
                                                <span
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: chair.color }}
                                                />
                                                <span className="truncate text-xs">{chair.name}</span>
                                                {selectedChair === chair.id && (
                                                    <span className="ml-auto text-xs font-bold">✓</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedChair && (
                                        <p className="text-xs text-gray-400">
                                            Selected: <span className="font-medium text-gray-600">{CLINIC_CHAIRS.find(c => c.id === selectedChair)?.name}</span>
                                            {' — '}<button type="button" onClick={() => setSelectedChair('')} className="text-red-400 hover:text-red-600">Clear</button>
                                        </p>
                                    )}
                                </div>

                                {/* ── DATE ── */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">4</span>
                                        <Label className="text-sm font-semibold text-gray-700">Date <span className="text-red-500">*</span></Label>
                                    </div>
                                    <Input
                                        type="date"
                                        value={selectedDate || ''}
                                        onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }}
                                        min={format(new Date(), 'yyyy-MM-dd')}
                                        className="bg-gray-50 border-gray-200 focus:border-blue-400"
                                    />
                                </div>

                                {/* ── TIME SLOTS ── */}
                                {selectedDoctor && selectedDate && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">5</span>
                                            <Label className="text-sm font-semibold text-gray-700">Time Slot <span className="text-red-500">*</span></Label>
                                        </div>
                                        {availableSlots.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {availableSlots.map((slot) => (
                                                    <button
                                                        key={slot}
                                                        type="button"
                                                        onClick={() => setSelectedTime(slot)}
                                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedTime === slot
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-105'
                                                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                                                            }`}
                                                    >
                                                        <Clock className={`h-3 w-3 inline mr-1 ${selectedTime === slot ? 'text-white' : 'text-gray-400'}`} />
                                                        {slot}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                                                <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                                <p className="text-sm text-orange-700">No available slots for this date. Please choose another day.</p>
                                            </div>
                                        )}
                                        {bookedSlots.length > 0 && (
                                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                                <span className="inline-block w-2 h-2 rounded-full bg-gray-300"></span>
                                                Already booked: {bookedSlots.join(', ')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* ── APPOINTMENT TYPE ── */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">5</span>
                                        <Label className="text-sm font-semibold text-gray-700">Appointment Type</Label>
                                    </div>
                                    <Select value={appointmentType} onValueChange={setAppointmentType}>
                                        <SelectTrigger className="bg-gray-50 border-gray-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(APPOINTMENT_TYPES).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* ── CHIEF COMPLAINT & NOTES ── */}
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-medium text-gray-700">Chief Complaint</Label>
                                        <Textarea
                                            placeholder="Reason for visit (e.g. toothache, routine cleaning…)"
                                            value={chiefComplaint}
                                            onChange={(e) => setChiefComplaint(e.target.value)}
                                            rows={2}
                                            className="bg-gray-50 border-gray-200 resize-none text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-medium text-gray-700">Additional Notes</Label>
                                        <Textarea
                                            placeholder="Internal notes for staff…"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            rows={2}
                                            className="bg-gray-50 border-gray-200 resize-none text-sm"
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* ── STICKY FOOTER — always visible ── */}
                            <div className="px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
                                <Button
                                    type="button"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-base py-5 font-semibold shadow-sm"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !patientReady || !selectedDoctor || !selectedDate || !selectedTime}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Booking Appointment…
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="mr-2 h-5 w-5" />
                                            Confirm Appointment
                                        </>
                                    )}
                                </Button>
                                {(!patientReady || !selectedDoctor || !selectedDate || !selectedTime) && (
                                    <p className="text-xs text-center text-gray-400 mt-2">
                                        {!patientReady
                                            ? '⬆ Enter patient name and phone to continue'
                                            : !selectedDoctor ? '⬆ Choose a doctor'
                                                : !selectedDate ? '⬆ Pick a date'
                                                    : '⬆ Select a time slot'}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── CALENDAR ─────────────────────────────────────────────────── */}
            <Card>
                <CardContent className="p-6">
                    <div className="h-[700px]">
                        <Calendar
                            localizer={localizer}
                            events={events}
                            startAccessor="start"
                            endAccessor="end"
                            view={view}
                            onView={(newView) => setView(newView)}
                            date={date}
                            onNavigate={(newDate) => setDate(newDate)}
                            onSelectSlot={handleSelectSlot}
                            onSelectEvent={handleSelectEvent}
                            selectable
                            style={{ height: '100%', fontFamily: 'inherit' }}
                            views={['month', 'week', 'day', 'agenda']}
                            min={new Date(0, 0, 0, 8, 0, 0)}
                            max={new Date(0, 0, 0, 20, 0, 0)}
                            className="bg-white rounded-md"
                            eventPropGetter={(event: CalendarEvent) => {
                                // Color by chair first; fall back to status color
                                const chair = CLINIC_CHAIRS.find(c => c.id === event.chairId);
                                let backgroundColor = chair ? chair.color : '#0f766e';
                                if (!chair) {
                                    if (event.status === 'COMPLETED') backgroundColor = '#22c55e';
                                    else if (event.status === 'CANCELLED') backgroundColor = '#ef4444';
                                    else if (event.status === 'NO_SHOW') backgroundColor = '#f59e0b';
                                    else if (event.status === 'IN_PROGRESS') backgroundColor = '#3b82f6';
                                    else if (event.status === 'CONFIRMED') backgroundColor = '#9333ea';
                                    else if (event.status === 'RESCHEDULED') backgroundColor = '#f97316';
                                }
                                return { style: { backgroundColor, border: 'none', borderRadius: '6px' } };
                            }}
                        />
                    </div>

                    {/* Chair legend */}
                    <div className="mt-4 flex flex-wrap gap-3 pt-3 border-t border-gray-100">
                        <span className="text-xs font-medium text-gray-500 self-center">Chair colors:</span>
                        {CLINIC_CHAIRS.map(chair => (
                            <div key={chair.id} className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: chair.color }} />
                                <span className="text-xs text-gray-600">{chair.name.replace('Chair ', 'Ch.')}</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-200">
                            <span className="w-3 h-3 rounded-full bg-blue-600" />
                            <span className="text-xs text-gray-600">No chair</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── APPOINTMENT DETAIL DIALOG ────────────────────────────────── */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="sm:max-w-[450px] p-0 gap-0">
                    {selectedAppointment && (
                        <>
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 rounded-t-lg">
                                <DialogHeader>
                                    <DialogTitle className="text-white font-bold flex items-center gap-2">
                                        <CalendarIcon className="h-5 w-5" />
                                        Appointment Details
                                    </DialogTitle>
                                    <p className="text-blue-100 text-sm mt-1">
                                        {format(new Date(selectedAppointment.date), 'EEEE, MMMM d, yyyy')}
                                    </p>
                                </DialogHeader>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                {/* Status */}
                                <div className="flex justify-center">
                                    <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${getStatusBadgeColor(selectedAppointment.status)}`}>
                                        {selectedAppointment.status.replace(/_/g, ' ')}
                                    </span>
                                </div>

                                {/* Patient card */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                            {selectedAppointment.patientId.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{selectedAppointment.patientId.name}</p>
                                            <p className="text-xs text-gray-500">Patient</p>
                                        </div>
                                    </div>
                                    {selectedAppointment.patientId.phone && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 pl-1">
                                            <Phone className="h-3.5 w-3.5 text-blue-600" />
                                            {selectedAppointment.patientId.phone}
                                        </div>
                                    )}
                                    {selectedAppointment.patientId.email && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 pl-1">
                                            <Mail className="h-3.5 w-3.5 text-blue-600" />
                                            {selectedAppointment.patientId.email}
                                        </div>
                                    )}
                                </div>

                                {/* Appointment info */}
                                <div className="space-y-3">
                                    {[
                                        { icon: <Stethoscope className="h-4 w-4 text-blue-600" />, label: 'Doctor', value: `Dr. ${selectedAppointment.doctorId.name}` },
                                        { icon: <Clock className="h-4 w-4 text-blue-600" />, label: 'Time', value: `${selectedAppointment.startTime} – ${selectedAppointment.endTime}` },
                                        { icon: <FileText className="h-4 w-4 text-blue-600" />, label: 'Type', value: selectedAppointment.type.replace(/_/g, ' ') },
                                    ].map(({ icon, label, value }) => (
                                        <div key={label} className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">{icon}</div>
                                            <div>
                                                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                                                <p className="text-sm font-semibold text-gray-900">{value}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {selectedAppointment.tokenNumber && (
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-bold text-blue-600">#</span>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Token</p>
                                                <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-sm font-bold">
                                                    {selectedAppointment.tokenNumber}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Chief complaint / notes */}
                                {selectedAppointment.chiefComplaint && (
                                    <div className="space-y-1">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chief Complaint</Label>
                                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedAppointment.chiefComplaint}</p>
                                    </div>
                                )}
                                {selectedAppointment.notes && (
                                    <div className="space-y-1">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</Label>
                                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedAppointment.notes}</p>
                                    </div>
                                )}

                                <Button variant="outline" className="w-full" onClick={() => setIsDetailDialogOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </PageWrapper>
    );
}
