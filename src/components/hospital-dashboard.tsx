"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  getSupabaseConfigurationError,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  type Database,
} from "@/lib/supabase";

type Role =
  | "Patient"
  | "Visitor"
  | "Caregiver"
  | "Doctor"
  | "Nurse"
  | "Administrator"
  | "Reception"
  | "Lab technician"
  | "Pharmacist"
  | "Auditor";
type Theme = "light" | "dark" | "contrast";
type Palette = "navy" | "teal" | "plum";
type FontChoice = "sans" | "serif" | "dyslexia";
type View =
  | "overview"
  | "appointments"
  | "communication"
  | "clinical-review"
  | "records"
  | "care-team"
  | "doctors"
  | "doctor-application"
  | "doctor-applications";

type DoctorProfile = Database["public"]["Tables"]["doctor_profiles"]["Row"];
type DoctorApplication = Database["public"]["Tables"]["doctor_applications"]["Row"];
type Preferences = {
  theme: Theme;
  palette: Palette;
  accent: string;
  font: FontChoice;
  fontScale: number;
  animations: boolean;
  compact: boolean;
};

type Appointment = {
  id: string;
  title: string;
  clinician: string;
  time: string;
  kind: string;
  status: "Confirmed" | "Requested" | "Cancelled" | "Completed";
};

type Review = {
  id: string;
  title: string;
  patient: string;
  detail: string;
  confidence: number;
  status: "Pending review" | "Reviewed in demo" | "Approved" | "Rejected";
};

const startingAppointments: Appointment[] = [
  {
    id: "demo-appointment-1",
    title: "Cardiology follow-up",
    clinician: "Dr. Maya Patel",
    time: "Today, 10:30 AM",
    kind: "Video visit",
    status: "Confirmed",
  },
  {
    id: "demo-appointment-2",
    title: "Routine check-in",
    clinician: "Nurse Jordan Lee",
    time: "Tomorrow, 2:00 PM",
    kind: "In person",
    status: "Confirmed",
  },
];

const startingReviews: Review[] = [
  {
    id: "demo-review-1",
    title: "Lab report summary",
    patient: "Alex Morgan",
    detail: "Two values are outside the sample reference range.",
    confidence: 92,
    status: "Pending review",
  },
  {
    id: "demo-review-2",
    title: "Visit note draft",
    patient: "Sam Rivera",
    detail: "A draft summary is ready to compare with the source note.",
    confidence: 86,
    status: "Pending review",
  },
];

const defaultPreferences: Preferences = {
  theme: "light",
  palette: "navy",
  accent: "#193b68",
  font: "sans",
  fontScale: 1,
  animations: true,
  compact: false,
};

const specialties = [
  ["primary-care", "Primary care"],
  ["cardiology", "Cardiology"],
  ["neurology", "Neurology"],
  ["pediatrics", "Pediatrics"],
  ["orthopedics", "Orthopedics"],
  ["ophthalmology", "Ophthalmology"],
  ["dermatology", "Dermatology"],
  ["psychiatry", "Psychiatry"],
  ["oncology", "Oncology"],
  ["gynecology", "Gynecology"],
  ["emergency-medicine", "Emergency medicine"],
  ["other", "Other specialty"],
] as const;

const demoDoctors = [
  {
    name: "Maya Patel, MD",
    specialty: "Cardiology",
    qualification: "MD · Cardiology",
    biography: "Sample profile for the interface preview. Not a practicing clinician.",
    photo: "photo-1559839734-2b71ea197ec2",
    email: "maya.patel@example.com",
  },
  {
    name: "Noah Williams, MD",
    specialty: "Primary care",
    qualification: "MD · Family medicine",
    biography: "Sample profile for the interface preview. Not a practicing clinician.",
    photo: "photo-1612349317150-e413f6a5b16d",
    email: "noah.williams@example.com",
  },
  {
    name: "Avery Brooks, MD",
    specialty: "Neurology",
    qualification: "MD · Neurology",
    biography: "Sample profile for the interface preview. Not a practicing clinician.",
    photo: "photo-1551601651-2a8555f1a136",
    email: "avery.brooks@example.com",
  },
] as const;

const navigation: {
  id: View;
  label: string;
  icon: string;
  allowed?: Role[];
}[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "appointments", label: "Appointments", icon: "▦" },
  { id: "doctors", label: "Doctor directory", icon: "♧" },
  { id: "communication", label: "Communication tools", icon: "◉" },
  {
    id: "clinical-review",
    label: "Clinical review",
    icon: "✳",
    allowed: ["Doctor", "Administrator"],
  },
  {
    id: "records",
    label: "Health records",
    icon: "▤",
    allowed: ["Patient", "Caregiver", "Doctor", "Nurse", "Administrator"],
  },
  {
    id: "care-team",
    label: "Care team",
    icon: "♧",
    allowed: ["Patient", "Caregiver", "Doctor", "Nurse", "Administrator"],
  },
  {
    id: "doctor-application",
    label: "Doctor verification",
    icon: "✓",
    allowed: ["Patient", "Visitor"],
  },
  {
    id: "doctor-applications",
    label: "Doctor applications",
    icon: "▣",
    allowed: ["Administrator"],
  },
];

function roleFromProfile(value: unknown): Role {
  switch (value) {
    case "visitor": return "Visitor";
    case "caregiver": return "Caregiver";
    case "doctor": return "Doctor";
    case "nurse": return "Nurse";
    case "administrator": return "Administrator";
    case "reception": return "Reception";
    case "lab_technician": return "Lab technician";
    case "pharmacist": return "Pharmacist";
    case "auditor": return "Auditor";
    default: return "Patient";
  }
}

function formatAppointmentTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const day = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day}, ${time}`;
}

function appointmentStatusLabel(
  value: Database["public"]["Tables"]["appointments"]["Row"]["status"],
): Appointment["status"] {
  switch (value) {
    case "requested":
      return "Requested";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    default:
      return "Confirmed";
  }
}

function reviewStatusLabel(
  value: Database["public"]["Tables"]["clinical_ai_reviews"]["Row"]["status"],
): Review["status"] {
  if (value === "approved") return "Approved";
  if (value === "rejected") return "Rejected";
  return "Pending review";
}

function readSuggestion(value: unknown): { title?: string; detail?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const suggestion = value as Record<string, unknown>;
  return {
    title: typeof suggestion.title === "string" ? suggestion.title : undefined,
    detail: typeof suggestion.detail === "string" ? suggestion.detail : undefined,
  };
}

export default function HospitalDashboard() {
  const [role, setRole] = useState<Role>("Patient");
  const [demoSignedIn, setDemoSignedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profileRole, setProfileRole] = useState<Role>("Patient");
  const [authMessage, setAuthMessage] = useState("");
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured());
  const [view, setView] = useState<View>("overview");
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [query, setQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [applications, setApplications] = useState<DoctorApplication[]>([]);
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [doctorBusy, setDoctorBusy] = useState(false);
  const [applicationBusy, setApplicationBusy] = useState(false);
  const supabaseReady = isSupabaseConfigured();
  const supabaseConfigError = getSupabaseConfigurationError();
  const supabaseClient = useMemo(
    () => supabaseConfigError ? null : getSupabaseBrowserClient(),
    [supabaseConfigError],
  );
  const [appointments, setAppointments] = useState<Appointment[]>(() =>
    supabaseReady ? [] : startingAppointments,
  );
  const [reviews, setReviews] = useState<Review[]>(() =>
    supabaseReady ? [] : startingReviews,
  );
  const [notice, setNotice] = useState("");
  const [phrase, setPhrase] = useState("I need help, please.");
  const searchInput = useRef<HTMLInputElement>(null);
  const effectiveRole = user ? profileRole : role;
  const userDisplayName =
    typeof user?.user_metadata.display_name === "string"
      ? user.user_metadata.display_name
      : user?.email?.split("@")[0] ?? "Patient";

  const loadAppointments = useCallback(
    async (): Promise<boolean> => {
      if (!supabaseClient) return false;
      try {
        const { data, error } = await supabaseClient
          .from("appointments")
          .select("id, clinician_id, starts_at, visit_type, status")
          .order("starts_at", { ascending: true });

        if (error) {
          setNotice(`Appointments could not be loaded: ${error.message}`);
          return false;
        }

        setAppointments(
          data.map((item) => ({
            id: item.id,
            title: item.visit_type === "video" ? "Video consultation" : "Clinic appointment",
            clinician: item.clinician_id ? "Assigned care team member" : "Care team assignment pending",
            time: formatAppointmentTime(item.starts_at),
            kind: item.visit_type === "video" ? "Video visit" : "In person",
            status: appointmentStatusLabel(item.status),
          })),
        );
        return true;
      } catch (error) {
        setNotice(
          `Appointments could not be loaded: ${error instanceof Error ? error.message : "network request failed"}`,
        );
        return false;
      }
    },
    [supabaseClient],
  );

  const loadReviews = useCallback(
    async (clinicianId: string): Promise<boolean> => {
      if (!supabaseClient) return false;
      try {
        const { data, error } = await supabaseClient
          .from("clinical_ai_reviews")
          .select("id, suggestion, confidence, status")
          .eq("clinician_id", clinicianId)
          .order("created_at", { ascending: false });

        if (error) {
          setNotice(`Clinical review queue could not be loaded: ${error.message}`);
          return false;
        }

        setReviews(
          data.map((item) => {
            const suggestion = readSuggestion(item.suggestion);
            return {
              id: item.id,
              title: suggestion.title ?? "Clinical suggestion",
              patient: "Assigned patient",
              detail: suggestion.detail ?? "Review this suggestion against the source record.",
              confidence: Number(item.confidence),
              status: reviewStatusLabel(item.status),
            };
          }),
        );
        return true;
      } catch (error) {
        setNotice(
          `Clinical review queue could not be loaded: ${error instanceof Error ? error.message : "network request failed"}`,
        );
        return false;
      }
    },
    [supabaseClient],
  );

  const loadProfileRole = useCallback(async (userId: string) => {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (error) {
        setNotice(`Your account role could not be loaded: ${error.message}`);
        return;
      }
      setProfileRole(roleFromProfile(data.role));
    } catch (error) {
      setNotice(`Your account role could not be loaded: ${error instanceof Error ? error.message : "network request failed"}`);
    }
  }, [supabaseClient]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.dataset.palette = preferences.palette;
    root.dataset.font = preferences.font;
    root.dataset.motion = preferences.animations ? "full" : "reduced";
    root.dataset.density = preferences.compact ? "compact" : "comfortable";
    root.dataset.customAccent =
      preferences.accent === defaultPreferences.accent ? "false" : "true";
    root.style.setProperty("--font-scale", String(preferences.fontScale));
    root.style.setProperty("--custom-accent", preferences.accent);
    if (!preferencesReady) return;
    try {
      localStorage.setItem("carewell-preferences", JSON.stringify(preferences));
    } catch {
      setNotice("Display preferences could not be saved in this browser.");
    }
  }, [preferences, preferencesReady]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("carewell-preferences");
      if (!stored) {
        setPreferencesReady(true);
        return;
      }
      const value: unknown = JSON.parse(stored);
      if (typeof value !== "object" || value === null) {
        setPreferencesReady(true);
        return;
      }
      const item = value as Partial<Preferences>;
      setPreferences({
        theme:
          item.theme === "dark" || item.theme === "contrast" ? item.theme : "light",
        palette:
          item.palette === "teal" || item.palette === "plum" ? item.palette : "navy",
        font:
          item.font === "serif" || item.font === "dyslexia" ? item.font : "sans",
        animations: typeof item.animations === "boolean" ? item.animations : true,
        compact: typeof item.compact === "boolean" ? item.compact : false,
        fontScale:
          typeof item.fontScale === "number"
            ? Math.min(1.3, Math.max(0.9, item.fontScale))
            : defaultPreferences.fontScale,
        accent:
          typeof item.accent === "string" && /^#[0-9a-f]{6}$/i.test(item.accent)
            ? item.accent
            : defaultPreferences.accent,
      });
      setPreferencesReady(true);
    } catch {
      setNotice("Saved display preferences could not be read; default settings are active.");
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!supabaseClient) return;

    let active = true;
    void supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthMessage(`Session could not be loaded: ${error.message}`);
      setUser(data.session?.user ?? null);
      if (data.session?.user) void loadProfileRole(data.session.user.id);
      setAuthReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthMessage(
        `Session could not be loaded: ${error instanceof Error ? error.message : "network request failed"}`,
      );
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void loadProfileRole(session.user.id);
      else setProfileRole("Patient");
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfileRole, supabaseClient]);

  const loadDoctors = useCallback(async (): Promise<boolean> => {
    if (!supabaseClient || !user) return false;
    setDoctorBusy(true);
    try {
      const { data, error } = await supabaseClient
        .from("doctor_profiles")
        .select("id, full_name, contact_email, contact_phone, specialty, qualification, institution, license_region, graduation_year, years_experience, biography, created_at")
        .order("full_name", { ascending: true });
      if (error) {
        setNotice(`Doctor directory could not be loaded: ${error.message}`);
        return false;
      }
      setDoctors(data);
      return true;
    } catch (error) {
      setNotice(`Doctor directory could not be loaded: ${error instanceof Error ? error.message : "network request failed"}`);
      return false;
    } finally {
      setDoctorBusy(false);
    }
  }, [supabaseClient, user]);

  const loadApplications = useCallback(async (): Promise<boolean> => {
    if (!supabaseClient || !user || effectiveRole !== "Administrator") return false;
    try {
      const { data, error } = await supabaseClient
        .from("doctor_applications")
        .select("id, user_id, full_name, contact_email, contact_phone, specialty, qualification, institution, medical_license_number, license_region, graduation_year, years_experience, biography, status, rejection_reason, reviewed_by, reviewed_at, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) {
        setNotice(`Doctor applications could not be loaded: ${error.message}`);
        return false;
      }
      setApplications(data);
      return true;
    } catch (error) {
      setNotice(`Doctor applications could not be loaded: ${error instanceof Error ? error.message : "network request failed"}`);
      return false;
    }
  }, [effectiveRole, supabaseClient, user]);

  useEffect(() => {
    if (!supabaseClient || !user) return;
    void loadAppointments();
    if (view === "doctors") void loadDoctors();
    if (view === "doctor-applications") void loadApplications();
    if (effectiveRole === "Doctor" || effectiveRole === "Administrator") {
      void loadReviews(user.id);
    }
  }, [
    effectiveRole,
    loadApplications,
    loadAppointments,
    loadDoctors,
    loadReviews,
    supabaseClient,
    user,
    view,
  ]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
        setView("appointments");
      }
    }
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const visibleNavigation = navigation.filter(
    (item) => !item.allowed || item.allowed.includes(effectiveRole),
  );

  const filteredAppointments = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return appointments;
    return appointments.filter((item) =>
      `${item.title} ${item.clinician} ${item.kind} ${item.status}`
        .toLowerCase()
        .includes(term),
    );
  }, [appointments, query]);

  function openView(nextView: View) {
    setView(nextView);
    setShowMobileNav(false);
    setShowSettings(false);
    setShowNotifications(false);
  }

  function speakPhrase() {
    if (!("speechSynthesis" in window)) {
      setNotice("Speech output is not supported by this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(phrase));
  }

  async function markReviewed(
    id: string,
    decision?: "approved" | "rejected",
  ) {
    if (effectiveRole !== "Doctor" && effectiveRole !== "Administrator") {
      setNotice("Only a clinician can review clinical suggestions.");
      return;
    }
    if (supabaseClient && user) {
      if (!decision) {
        setNotice("Choose approve or reject to save a clinical review.");
        return;
      }
      try {
        const { error } = await supabaseClient
          .from("clinical_ai_reviews")
          .update({ status: decision })
          .eq("id", id)
          .select("id")
          .single();
        if (error) {
          setNotice(`Clinical review could not be saved: ${error.message}`);
          return;
        }
      } catch (error) {
        setNotice(
          `Clinical review could not be saved: ${error instanceof Error ? error.message : "network request failed"}`,
        );
        return;
      }
      setReviews((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status: decision === "approved" ? "Approved" : "Rejected" }
            : item,
        ),
      );
      const refreshed = await loadReviews(user.id);
      if (!refreshed) return;
      setNotice(`Review ${decision}. The suggestion was not added to a medical record.`);
      return;
    }
    setReviews((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "Reviewed in demo" } : item,
      ),
    );
    setNotice("Marked reviewed in this demo. No medical record was changed.");
  }

  async function submitDoctorApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient || !user || (effectiveRole !== "Patient" && effectiveRole !== "Visitor")) {
      setNotice("Sign in with a patient or visitor account to submit a doctor application.");
      return;
    }
    const form = event.currentTarget;
    const values = new FormData(form);
    const graduationYear = Number(values.get("graduation_year"));
    const yearsExperience = Number(values.get("years_experience"));
    if (
      !Number.isInteger(graduationYear) ||
      graduationYear < 1950 ||
      graduationYear > new Date().getFullYear() ||
      !Number.isInteger(yearsExperience) ||
      yearsExperience < 0 ||
      yearsExperience > 70
    ) {
      setNotice("Enter a valid graduation year and years of experience.");
      return;
    }
    setApplicationBusy(true);
    try {
      const { error } = await supabaseClient.from("doctor_applications").insert({
        user_id: user.id,
        full_name: String(values.get("full_name")).trim(),
        contact_email: String(values.get("contact_email")).trim(),
        contact_phone: String(values.get("contact_phone")).trim(),
        specialty: String(values.get("specialty")),
        qualification: String(values.get("qualification")).trim(),
        institution: String(values.get("institution")).trim(),
        medical_license_number: String(values.get("medical_license_number")).trim(),
        license_region: String(values.get("license_region")).trim(),
        graduation_year: graduationYear,
        years_experience: yearsExperience,
        biography: String(values.get("biography")).trim(),
      });
      if (error) {
        setNotice(`Doctor application could not be submitted: ${error.message}`);
        return;
      }
      form.reset();
      setNotice("Application submitted. Your account remains a patient account until an administrator verifies your credentials.");
      setView("overview");
    } catch (error) {
      setNotice(`Doctor application could not be submitted: ${error instanceof Error ? error.message : "network request failed"}`);
    } finally {
      setApplicationBusy(false);
    }
  }

  async function reviewDoctorApplication(
    application: DoctorApplication,
    decision: "approved" | "rejected",
  ) {
    if (!supabaseClient || !user || effectiveRole !== "Administrator") {
      setNotice("Only a provisioned hospital administrator can review applications.");
      return;
    }
    const rejectionReason =
      decision === "rejected" ? window.prompt("Reason for declining this application?")?.trim() : null;
    if (decision === "rejected" && !rejectionReason) {
      setNotice("A reason is required to decline a doctor application.");
      return;
    }
    try {
      const { data, error } = await supabaseClient
        .from("doctor_applications")
        .update({
          status: decision,
          ...(decision === "rejected" ? { rejection_reason: rejectionReason } : {}),
        })
        .eq("id", application.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (error) {
        setNotice(`Application review could not be saved: ${error.message}`);
        return;
      }
      if (!data) {
        setNotice("This application is no longer pending. Refresh the queue and try again.");
        await loadApplications();
        return;
      }
      await loadApplications();
      if (decision === "approved") await loadDoctors();
      setNotice(
        decision === "approved"
          ? `${application.full_name} was verified and added to the doctor directory.`
          : `${application.full_name}'s application was declined.`,
      );
    } catch (error) {
      setNotice(`Application review could not be saved: ${error instanceof Error ? error.message : "network request failed"}`);
    }
  }

  function openAppointmentRequest() {
    if (supabaseClient && user && effectiveRole !== "Patient") {
      setNotice("Only patient accounts can request an appointment in this version.");
      return;
    }
    setShowBooking(true);
  }

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date"));
    const time = String(data.get("time"));
    const clinician = String(data.get("clinician"));
    const kind = String(data.get("kind"));
    const startsAt = new Date(`${date}T${time}`);
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setNotice("Choose a future date and time for your appointment request.");
      return;
    }

    if (supabaseClient && user) {
      try {
        const { error } = await supabaseClient.from("appointments").insert({
          patient_id: user.id,
          starts_at: startsAt.toISOString(),
          visit_type: kind === "Video visit" ? "video" : "in_person",
        });
        if (error) {
          setNotice(`Appointment request could not be saved: ${error.message}`);
          return;
        }
      } catch (error) {
        setNotice(
          `Appointment request could not be saved: ${error instanceof Error ? error.message : "network request failed"}`,
        );
        return;
      }
      setShowBooking(false);
      setView("appointments");
      const refreshed = await loadAppointments();
      if (!refreshed) return;
      setNotice("Appointment request saved to your account.");
      return;
    }

    setAppointments((current) => [
      {
        id: `demo-${Date.now()}`,
        title: kind === "Video visit" ? "Video consultation" : "Clinic appointment",
        clinician,
        time: `${date}, ${time}`,
        kind,
        status: "Requested",
      },
      ...current,
    ]);
    setShowBooking(false);
    setView("appointments");
    setNotice("Appointment request added to this demo session.");
  }

  async function signOut() {
    if (!supabaseClient) {
      setDemoSignedIn(false);
      setView("overview");
      setShowMobileNav(false);
      return;
    }
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) setNotice(`You could not be signed out: ${error.message}`);
    } catch (error) {
      setNotice(
        `You could not be signed out: ${error instanceof Error ? error.message : "network request failed"}`,
      );
    }
  }

  if (supabaseReady && !authReady) {
    return <AuthLoading />;
  }
  if (supabaseConfigError) {
    return <SupabaseConfigurationError message={supabaseConfigError} />;
  }
  if (supabaseReady && supabaseClient && !user) {
    return <SupabaseAuth client={supabaseClient} initialMessage={authMessage} />;
  }
  if (!supabaseReady && !demoSignedIn) {
    return (
      <DemoSignIn
        onSignIn={(selectedRole) => {
          setRole(selectedRole);
          setDemoSignedIn(true);
        }}
      />
    );
  }

  const pageTitle =
    navigation.find((item) => item.id === view)?.label ?? "Overview";

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="sidebar" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="Carewell home">
          <span className="brand-mark" aria-hidden="true">
            +
          </span>
          <span>
            <strong>Carewell</strong>
            <small>Accessible care</small>
          </span>
        </Link>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav">
          {visibleNavigation.map((item) => (
            <button
              className={`nav-item ${view === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => openView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.id === "clinical-review" && (
                <span
                  className="nav-count"
                  aria-label={`${reviews.filter((review) => review.status === "Pending review").length} pending reviews`}
                >
                  {reviews.filter((review) => review.status === "Pending review").length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="access-card">
          <div className="access-icon" aria-hidden="true">
            Aa
          </div>
          <strong>Make it yours</strong>
          <p>Adjust contrast and display settings to suit you.</p>
          <button className="text-button" onClick={() => setShowSettings(true)}>
            Accessibility settings <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="sidebar-profile">
          <div className="avatar avatar-green" aria-hidden="true">
            {effectiveRole === "Patient" ? "AM" : effectiveRole === "Doctor" ? "MP" : "JL"}
          </div>
          <div className="profile-copy">
            <strong>
              {supabaseReady
                ? userDisplayName
                : effectiveRole === "Patient"
                  ? "Alex Morgan"
                  : `${effectiveRole} account`}
            </strong>
            <span>{effectiveRole}{supabaseReady ? "" : " · Demo"}</span>
          </div>
          <span className="profile-dots" aria-hidden="true">
            ···
          </span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark" aria-hidden="true">
              +
            </span>
            <strong>Carewell</strong>
            <button
              className="mobile-menu-toggle"
              aria-label={showMobileNav ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={showMobileNav}
              onClick={() => setShowMobileNav((current) => !current)}
            >
              {showMobileNav ? "×" : "☰"}
            </button>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search appointments</span>
            <input
              ref={searchInput}
              type="search"
              placeholder="Search appointments"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setView("appointments");
              }}
            />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="top-actions">
            <label className="role-select">
              <span className="sr-only">
                {supabaseReady ? "Account role" : "Choose demo role"}
              </span>
              <select
                value={effectiveRole}
                disabled={supabaseReady}
                onChange={(event) => {
                  const nextRole = event.target.value as Role;
                  setRole(nextRole);
                  if (
                    !navigation.find((item) => item.id === view)?.allowed?.includes(nextRole)
                  ) {
                    setView("overview");
                  }
                }}
              >
                <option>Patient</option>
                <option>Visitor</option>
                <option>Caregiver</option>
                <option>Doctor</option>
                <option>Nurse</option>
                <option>Administrator</option>
                <option>Reception</option>
                <option>Lab technician</option>
                <option>Pharmacist</option>
                <option>Auditor</option>
              </select>
            </label>
            <button className="text-button sign-out-button" onClick={() => void signOut()}>
              Sign out
            </button>
            <button
              className="icon-button notification-trigger"
              aria-label="Notifications"
              aria-expanded={showNotifications}
              onClick={() => {
                setShowNotifications((current) => !current);
                setShowSettings(false);
              }}
            >
              <span aria-hidden="true">♧</span>
              <i aria-hidden="true" />
            </button>
            <button
              className="avatar avatar-green top-avatar"
              aria-label={supabaseReady ? "Sign out" : "Open accessibility settings"}
              onClick={() => {
                if (supabaseReady) {
                  void signOut();
                } else {
                  setShowSettings((current) => !current);
                }
              }}
            >
              {supabaseReady ? userDisplayName.slice(0, 2).toUpperCase() : "AM"}
            </button>
          </div>
        </header>

        {showMobileNav && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {visibleNavigation.map((item) => (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => openView(item.id)}
                aria-current={view === item.id ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>{item.label}
              </button>
            ))}
            <button className="mobile-nav-sign-out" onClick={() => void signOut()}>
              Sign out
            </button>
          </nav>
        )}

        {showNotifications && (
          <div className="floating-panel notifications-panel">
            <div className="panel-heading">
              <strong>Notifications</strong>
              <button
                className="text-button"
                onClick={() => setShowNotifications(false)}
              >
                Close
              </button>
            </div>
            <p className="notification-item">
              <span className="notification-dot" />
              Your cardiology follow-up is scheduled for today at 10:30 AM.
            </p>
            <p className="notification-item muted">
              Demo notifications are not sent to a device.
            </p>
          </div>
        )}

        {showSettings && (
          <div className="floating-panel settings-panel">
            <div className="panel-heading">
              <strong>Display & accessibility</strong>
              <button className="text-button" onClick={() => setShowSettings(false)}>
                Close
              </button>
            </div>
            <p className="settings-description">
              Preferences are saved in this browser on this device.
            </p>
            <div className="theme-options" role="group" aria-label="Display theme">
              {(
                [
                  ["light", "Light"],
                  ["dark", "Dark"],
                  ["contrast", "High contrast"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={`theme-option ${preferences.theme === value ? "selected" : ""}`}
                  aria-pressed={preferences.theme === value}
                  onClick={() => setPreferences((current) => ({ ...current, theme: value }))}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="preferences-grid">
              <label>
                Color palette
                <select
                  value={preferences.palette}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      palette: event.target.value as Palette,
                    }))
                  }
                >
                  <option value="navy">Navy blue</option>
                  <option value="teal">Teal</option>
                  <option value="plum">Plum</option>
                </select>
              </label>
              <label>
                Font style
                <select
                  value={preferences.font}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      font: event.target.value as FontChoice,
                    }))
                  }
                >
                  <option value="sans">Sans serif</option>
                  <option value="serif">Serif</option>
                  <option value="dyslexia">Readable spacing</option>
                </select>
              </label>
              <label className="scale-control">
                Text size: {Math.round(preferences.fontScale * 100)}%
                <input
                  type="range"
                  min="0.9"
                  max="1.3"
                  step="0.05"
                  value={preferences.fontScale}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      fontScale: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="accent-control">
                Custom accent
                <input
                  type="color"
                  value={preferences.accent}
                  onChange={(event) =>
                    setPreferences((current) => ({ ...current, accent: event.target.value }))
                  }
                />
              </label>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={preferences.animations}
                  onChange={(event) =>
                    setPreferences((current) => ({ ...current, animations: event.target.checked }))
                  }
                />
                Animations
              </label>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={preferences.compact}
                  onChange={(event) =>
                    setPreferences((current) => ({ ...current, compact: event.target.checked }))
                  }
                />
                Compact layout
              </label>
            </div>
          </div>
        )}

        <div className="demo-banner" role="status">
          <span className="demo-banner-dot" />
          <strong>
            {supabaseReady ? "Supabase account" : "Signed-in demo preview"}
          </strong>
          <span>
            {supabaseReady
              ? "Appointments are saved to your account; other health information is sample data."
              : "Demo role preview only; no access control. Sample information only—do not enter real patient or emergency data."}
          </span>
          <span className="backend-status">
            {supabaseReady ? "Connected" : "Local demo mode"}
          </span>
        </div>

        <div className="main-content" id="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR CARE OVERVIEW</div>
              <h1>
                {view === "overview"
                  ? `Good morning, ${supabaseReady ? userDisplayName.split(" ")[0] : effectiveRole === "Patient" ? "Alex" : effectiveRole}`
                  : pageTitle}
              </h1>
              <p className="page-subtitle">
                {view === "overview"
                  ? "Your care, clearly connected."
                  : view === "clinical-review"
                    ? "Clinical suggestions stay pending until a clinician reviews them."
                    : `Manage your ${pageTitle.toLowerCase()} in one place.`}
              </p>
            </div>
            <div className="heading-actions">
              <button className="button button-secondary" onClick={() => setShowSettings(true)}>
                <span aria-hidden="true">◐</span> Display
              </button>
              <button className="button button-primary" onClick={openAppointmentRequest}>
                <span aria-hidden="true">+</span> Book appointment
              </button>
            </div>
          </div>

          {view === "overview" && (
            <Overview
              role={effectiveRole}
              appointments={appointments.slice(0, 2)}
              reviews={reviews}
              onNavigate={openView}
              onBook={openAppointmentRequest}
            />
          )}
          {view === "appointments" && (
            <Appointments
              items={filteredAppointments}
              query={query}
              onBook={openAppointmentRequest}
              connected={Boolean(supabaseClient && user)}
            />
          )}
          {view === "communication" && (
            <Communication
              phrase={phrase}
              setPhrase={setPhrase}
              onSpeak={speakPhrase}
            />
          )}
          {view === "clinical-review" && (
            <ClinicalReview
              role={effectiveRole}
              items={reviews}
              onReview={markReviewed}
              connected={Boolean(supabaseClient && user)}
            />
          )}
          {view === "records" && <Records />}
          {view === "care-team" && <CareTeam />}
          {view === "doctors" && (
            <DoctorDirectory
              doctors={supabaseReady ? doctors : demoDoctors}
              filter={doctorFilter}
              setFilter={setDoctorFilter}
              loading={doctorBusy}
              connected={Boolean(supabaseClient && user)}
              onBook={openAppointmentRequest}
            />
          )}
          {view === "doctor-application" && (
            <DoctorApplicationForm
              connected={Boolean(supabaseClient && user)}
              busy={applicationBusy}
              onSubmit={submitDoctorApplication}
            />
          )}
          {view === "doctor-applications" && (
            <DoctorApplicationReview
              applications={applications}
              connected={Boolean(supabaseClient && user && effectiveRole === "Administrator")}
              onDecision={reviewDoctorApplication}
            />
          )}

          <footer className="page-footer">
            <span>Carewell · Accessible care for every patient</span>
            <span>
              {supabaseReady
                ? "Appointments use Supabase; clinical examples remain synthetic."
                : "Local demo data · No clinical records are stored."}
            </span>
          </footer>
        </div>
      </section>

      {showBooking && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowBooking(false);
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">APPOINTMENTS</div>
                <h2 id="booking-title">Request an appointment</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close appointment form"
                onClick={() => setShowBooking(false)}
              >
                ×
              </button>
            </div>
            <p className="modal-note">
              {supabaseClient && user
                ? "This request is saved to your account with your patient profile."
                : "This creates a temporary request in the current demo session only."}
            </p>
            <form className="booking-form" onSubmit={createAppointment}>
              <label>
                Visit type
                <select name="kind" defaultValue="Video visit">
                  <option>Video visit</option>
                  <option>In person</option>
                </select>
              </label>
              {!supabaseReady && (
                <label>
                  Care team member
                  <select name="clinician" defaultValue="Dr. Maya Patel">
                    <option>Dr. Maya Patel</option>
                    <option>Dr. Noah Williams</option>
                    <option>Nurse Jordan Lee</option>
                  </select>
                </label>
              )}
              <div className="form-row">
                <label>
                  Date
                  <input name="date" type="date" required />
                </label>
                <label>
                  Time
                  <input name="time" type="time" required />
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowBooking(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  {supabaseClient && user ? "Send appointment request" : "Add demo request"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </main>
  );
}

function DemoSignIn({ onSignIn }: { onSignIn: (role: Role) => void }) {
  const [selectedRole, setSelectedRole] = useState<Role>("Patient");
  const roleChoices: Role[] = [
    "Patient",
    "Visitor",
    "Caregiver",
    "Doctor",
    "Nurse",
    "Administrator",
    "Reception",
    "Lab technician",
    "Pharmacist",
    "Auditor",
  ];
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/" aria-label="Carewell home">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span><strong>Carewell</strong><small>Accessible care</small></span>
        </Link>
        <div className="eyebrow">DEMO ACCESS</div>
        <h1>Choose a preview role</h1>
        <p className="auth-description">
          Sign in to explore the interface. This local preview does not authenticate users,
          enforce role permissions, or store account data.
        </p>
        <label>
          Sign in as
          <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Role)}>
            {roleChoices.map((choice) => <option key={choice}>{choice}</option>)}
          </select>
        </label>
        <button className="button button-primary demo-sign-in" onClick={() => onSignIn(selectedRole)}>
          Sign in to demo
        </button>
        <p className="auth-footnote">
          For protected accounts and doctor credential verification, configure Supabase using
          the setup instructions. Do not enter real patient information in this preview.
        </p>
      </section>
    </main>
  );
}

function DoctorDirectory({
  doctors,
  filter,
  setFilter,
  loading,
  connected,
  onBook,
}: {
  doctors: DoctorProfile[] | typeof demoDoctors;
  filter: string;
  setFilter: (value: string) => void;
  loading: boolean;
  connected: boolean;
  onBook: () => void;
}) {
  const filtered = doctors.filter((doctor) => {
    if (filter === "all") return true;
    if (!("name" in doctor)) return doctor.specialty === filter;
    const label = specialties.find(([value]) => value === filter)?.[1];
    return doctor.specialty.toLowerCase() === label?.toLowerCase();
  });
  return (
    <section className="doctor-directory" aria-labelledby="directory-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">VERIFIED CARE TEAM</div>
          <h2 id="directory-title">Find a doctor</h2>
          <p className="section-description">
            {connected
              ? "Profiles are published only after an administrator reviews the submitted credentials."
              : "Illustrative sample profiles only. No real clinicians or contact details are represented."}
          </p>
        </div>
        <label className="specialty-filter">
          Specialty
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All specialties</option>
            {specialties.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {loading && <p role="status">Loading verified doctors…</p>}
      {!loading && filtered.length === 0 && (
        <EmptyState title="No doctors found" detail="Try another specialty or check back later." />
      )}
      <div className="doctor-grid">
        {filtered.map((doctor) => {
          const preview = "name" in doctor;
          const name = preview ? doctor.name : doctor.full_name;
          const specialty = preview
            ? doctor.specialty
            : (specialties.find(([value]) => value === doctor.specialty)?.[1] ?? doctor.specialty);
          const qualification = doctor.qualification;
          const email = "contact_email" in doctor ? doctor.contact_email : doctor.email;
          const phone = "contact_phone" in doctor ? doctor.contact_phone : "(555) 010-0101";
          const biography = doctor.biography;
          return (
            <article className="doctor-card" key={preview ? doctor.email : doctor.id}>
              {preview ? (
                <img
                  className="doctor-photo"
                  src={`https://images.unsplash.com/${doctor.photo}?auto=format&fit=crop&w=720&q=80`}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div className="doctor-photo doctor-photo-placeholder" aria-hidden="true">
                  {name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                </div>
              )}
              <div className="doctor-card-copy">
                <span className="doctor-specialty">{specialty}</span>
                <h3>{name}</h3>
                <p className="doctor-qualification">{qualification}</p>
                <p>{biography || "Verified clinician profile."}</p>
                {!preview && (
                  <p className="doctor-credential">
                    {doctor.institution} · {doctor.years_experience} years’ experience
                  </p>
                )}
                <div className="doctor-contact">
                  <a href={`mailto:${email}`}>Email doctor</a>
                  <a href={`tel:${phone}`}>Call</a>
                </div>
                <button className="button button-primary" onClick={onBook}>Request appointment</button>
              </div>
              {preview && <span className="preview-tag">Sample profile</span>}
            </article>
          );
        })}
      </div>
      {connected && (
        <p className="directory-note">
          Email and phone links open your device’s mail or call application. They do not send
          automated notifications from Carewell.
        </p>
      )}
      {!connected && (
        <p className="open-source-credit">
          Illustrative stock photography from <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash</a>.
          Sample names and contact details are fictional.
        </p>
      )}
    </section>
  );
}

function DoctorApplicationForm({
  connected,
  busy,
  onSubmit,
}: {
  connected: boolean;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!connected) {
    return (
      <section className="form-card">
        <div className="eyebrow">DOCTOR VERIFICATION</div>
        <h2>Submit professional credentials</h2>
        <p>
          Credential submissions require an authenticated Supabase account and the doctor
          onboarding migration. The local demo cannot verify professional qualifications.
        </p>
      </section>
    );
  }
  return (
    <section className="form-card">
      <div className="eyebrow">DOCTOR VERIFICATION</div>
      <h2>Apply to join the doctor directory</h2>
      <p>Credentials are reviewed by a hospital administrator. Approval is required before your profile or doctor role is published.</p>
      <form className="doctor-application-form" onSubmit={onSubmit}>
        <label>Full legal name<input name="full_name" required minLength={2} maxLength={120} autoComplete="name" /></label>
        <div className="form-row">
          <label>Professional email<input name="contact_email" type="email" required maxLength={254} autoComplete="email" /></label>
          <label>Phone number<input name="contact_phone" type="tel" required minLength={7} maxLength={32} autoComplete="tel" /></label>
        </div>
        <div className="form-row">
          <label>Medical specialty
            <select name="specialty" required defaultValue="">
              <option value="" disabled>Select a specialty</option>
              {specialties.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Degree / qualification<input name="qualification" required minLength={2} maxLength={160} placeholder="e.g. MD, MBBS, DO" /></label>
        </div>
        <label>Medical school or institution<input name="institution" required minLength={2} maxLength={180} /></label>
        <div className="form-row">
          <label>Medical license number<input name="medical_license_number" required minLength={3} maxLength={100} /></label>
          <label>License region / issuing authority<input name="license_region" required minLength={2} maxLength={120} /></label>
        </div>
        <div className="form-row">
          <label>Graduation year<input name="graduation_year" type="number" min="1950" max={new Date().getFullYear()} required /></label>
          <label>Years of experience<input name="years_experience" type="number" min="0" max="70" required /></label>
        </div>
        <label>Professional biography<textarea name="biography" maxLength={1200} rows={4} /></label>
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? "Submitting…" : "Submit for verification"}
        </button>
      </form>
    </section>
  );
}

function DoctorApplicationReview({
  applications,
  connected,
  onDecision,
}: {
  applications: DoctorApplication[];
  connected: boolean;
  onDecision: (application: DoctorApplication, decision: "approved" | "rejected") => void;
}) {
  if (!connected) {
    return (
      <section className="form-card">
        <h2>Administrator access required</h2>
        <p>Only a provisioned hospital administrator can review applications.</p>
      </section>
    );
  }
  return (
    <section className="application-list">
      <div className="section-heading">
        <div><div className="eyebrow">CREDENTIAL REVIEW</div><h2>Pending doctor applications</h2></div>
      </div>
      {applications.length === 0 ? (
        <EmptyState title="No pending applications" detail="New submissions will appear here for administrator review." />
      ) : applications.map((application) => (
        <article className="application-card" key={application.id}>
          <div>
            <span className="doctor-specialty">
              {specialties.find(([value]) => value === application.specialty)?.[1] ?? application.specialty}
            </span>
            <h3>{application.full_name}</h3>
            <p>{application.qualification} · {application.institution}</p>
            <p>License {application.medical_license_number} · {application.license_region}</p>
            <p>{application.contact_email} · {application.contact_phone}</p>
            <p>{application.years_experience} years’ experience · Graduated {application.graduation_year}</p>
            {application.biography && <p>{application.biography}</p>}
            <small>Submitted {new Date(application.created_at).toLocaleDateString()}</small>
          </div>
          <div className="application-actions">
            <button className="button button-primary" onClick={() => onDecision(application, "approved")}>Verify & approve</button>
            <button className="button button-secondary" onClick={() => onDecision(application, "rejected")}>Decline</button>
          </div>
        </article>
      ))}
      <p className="directory-note">Review each license with the issuing authority before approval. The application details are sensitive and available only to the applicant and provisioned administrators.</p>
    </section>
  );
}

function Overview({
  role,
  appointments,
  reviews,
  onNavigate,
  onBook,
}: {
  role: Role;
  appointments: Appointment[];
  reviews: Review[];
  onNavigate: (view: View) => void;
  onBook: () => void;
}) {
  const isPatient = role === "Patient";
  const isReviewer = role === "Doctor" || role === "Administrator";
  return (
    <>
      <section className="welcome-card">
        <div className="welcome-copy">
          <div className="welcome-label">
            <span className="welcome-dot" /> YOUR CARE AT A GLANCE
          </div>
          <h2>{isPatient ? "Care that works for you." : "Your team, in sync."}</h2>
          <p>
            {isPatient
              ? "Your next visit, care team, and tools are all in one accessible place."
              : "Review today's care activity and keep every clinical decision in the right hands."}
          </p>
          <button className="button button-light" onClick={onBook}>
            Plan a visit <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-cross">+</div>
          <span className="art-dot dot-one" />
          <span className="art-dot dot-two" />
        </div>
        <div className="welcome-side-note">
          <span className="status-pulse" />
          <span>
            <strong>Support is here</strong>
            <small>Your care team is available</small>
          </span>
        </div>
      </section>
      <p className="open-source-credit">
        Hero image: illustrative stock photography from <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash</a>.
      </p>

      <section className="stat-grid" aria-label="Care overview">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon lavender" aria-hidden="true">▦</span>
            <span className="stat-trend">UPCOMING</span>
          </div>
          <strong className="stat-value">{appointments.length}</strong>
          <span className="stat-label">Scheduled visits</span>
          <button className="stat-link" onClick={() => onNavigate("appointments")}>
            See appointments <span aria-hidden="true">→</span>
          </button>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon mint" aria-hidden="true">♡</span>
            <span className="stat-trend">SAMPLE</span>
          </div>
          <strong className="stat-value">72 <small>bpm</small></strong>
          <span className="stat-label">Resting heart rate</span>
          <span className="stat-footnote">Sample reading · not a live device</span>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon peach" aria-hidden="true">✳</span>
            <span className="stat-trend">CARE TEAM</span>
          </div>
          <strong className="stat-value">3</strong>
          <span className="stat-label">People in your care circle</span>
          <button className="stat-link" onClick={() => onNavigate("care-team")}>
            View care team <span aria-hidden="true">→</span>
          </button>
        </article>
      </section>

      <div className="content-grid">
        <section className="panel appointments-panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">STAY ON TRACK</div>
              <h2>Upcoming appointments</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("appointments")}>
              View all <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="appointment-list">
            {appointments.map((appointment) => (
              <AppointmentRow appointment={appointment} key={appointment.id} />
            ))}
          </div>
          <button className="add-appointment" onClick={onBook}>
            <span aria-hidden="true">+</span> Add an appointment
          </button>
        </section>

        <section className="panel tools-panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">BUILT AROUND YOU</div>
              <h2>Quick access</h2>
            </div>
          </div>
          <button className="tool-row" onClick={() => onNavigate("communication")}>
            <span className="tool-icon lavender" aria-hidden="true">◉</span>
            <span>
              <strong>Communication board</strong>
              <small>Speak a phrase aloud</small>
            </span>
            <span className="row-arrow" aria-hidden="true">→</span>
          </button>
          <button className="tool-row" onClick={() => onNavigate("records")}>
            <span className="tool-icon mint" aria-hidden="true">▤</span>
            <span>
              <strong>Health records</strong>
              <small>Review sample information</small>
            </span>
            <span className="row-arrow" aria-hidden="true">→</span>
          </button>
          {isReviewer && (
            <button className="tool-row" onClick={() => onNavigate("clinical-review")}>
              <span className="tool-icon peach" aria-hidden="true">✳</span>
              <span>
                <strong>Clinical review queue</strong>
                <small>
                  {reviews.filter((item) => item.status === "Pending review").length} awaiting review
                </small>
              </span>
              <span className="row-arrow" aria-hidden="true">→</span>
            </button>
          )}
        </section>
      </div>

      <section className="reassurance-strip">
        <span className="reassurance-icon" aria-hidden="true">✓</span>
        <span>
          <strong>Your choices matter.</strong>
          <span> Demo information is not part of a medical record or clinical service.</span>
        </span>
      </section>
    </>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const [dateLabel, timeLabel = ""] = appointment.time.split(",");
  return (
    <article className="appointment-row">
      <div className="date-tile">
        <span>{dateLabel}</span>
        <strong>{timeLabel.trim() || "New"}</strong>
      </div>
      <div className="appointment-copy">
        <strong>{appointment.title}</strong>
        <span>{appointment.clinician} · {appointment.kind}</span>
      </div>
      <span className={`appointment-status ${appointment.status.toLowerCase()}`}>
        {appointment.status}
      </span>
    </article>
  );
}

function Appointments({
  items,
  query,
  onBook,
  connected,
}: {
  items: Appointment[];
  query: string;
  onBook: () => void;
  connected: boolean;
}) {
  return (
    <section className="panel page-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">YOUR SCHEDULE</div>
          <h2>Appointments</h2>
        </div>
        <button className="button button-primary" onClick={onBook}>
          <span aria-hidden="true">+</span> Request a visit
        </button>
      </div>
      {items.length ? (
        <div className="appointment-list">
          {items.map((appointment) => (
            <AppointmentRow appointment={appointment} key={appointment.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={query ? "No matching appointments" : "No appointments yet"}
          detail={
            query
              ? "Try a different search term."
              : connected
                ? "Request a visit to add it to your account."
                : "Request a visit to add one to this demo."
          }
        />
      )}
    </section>
  );
}

function Communication({
  phrase,
  setPhrase,
  onSpeak,
}: {
  phrase: string;
  setPhrase: (value: string) => void;
  onSpeak: () => void;
}) {
  const phrases = [
    "I need help, please.",
    "I am in pain.",
    "Please speak slowly.",
    "I understand.",
    "I need a moment.",
    "Please contact my caregiver.",
  ];
  return (
    <div className="communication-layout">
      <section className="panel page-panel">
        <div className="eyebrow">ASSISTIVE COMMUNICATION</div>
        <h2 className="page-panel-title">Choose what you want to say</h2>
        <p className="panel-intro">
          Select a phrase or write your own. Speech is generated on this device when supported.
        </p>
        <div className="phrase-grid">
          {phrases.map((item) => (
            <button
              key={item}
              className={`phrase-button ${phrase === item ? "selected" : ""}`}
              aria-pressed={phrase === item}
              onClick={() => setPhrase(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="custom-phrase">
          Your message
          <textarea
            value={phrase}
            maxLength={240}
            rows={3}
            onChange={(event) => setPhrase(event.target.value)}
          />
        </label>
        <button className="button button-primary speak-button" onClick={onSpeak}>
          <span aria-hidden="true">▶</span> Speak message
        </button>
      </section>
      <aside className="panel communication-note">
        <span className="stat-icon mint" aria-hidden="true">◌</span>
        <h2>Designed for choice</h2>
        <p>
          This phrase board uses your browser&apos;s speech feature. It does not record audio or
          recognize signs, facial expressions, or gestures.
        </p>
        <div className="note-divider" />
        <strong>Need a different way to communicate?</strong>
        <p>Show your selected message to someone nearby or use your preferred assistive device.</p>
      </aside>
    </div>
  );
}

function ClinicalReview({
  role,
  items,
  onReview,
  connected,
}: {
  role: Role;
  items: Review[];
  onReview: (id: string, decision?: "approved" | "rejected") => void;
  connected: boolean;
}) {
  if (role !== "Doctor" && role !== "Administrator") {
    return (
      <div className="panel page-panel">
        <EmptyState
          title="Doctor access required"
          detail="Only authorized doctors can review or approve clinical suggestions."
        />
      </div>
    );
  }

  return (
    <section className="panel page-panel">
      <div className="safety-callout">
        <span className="safety-mark" aria-hidden="true">!</span>
        <div>
          <strong>Decision support only</strong>
          <p>
            {connected
              ? "Suggestions remain pending until a doctor explicitly approves or rejects them. This action does not write the suggestion into a medical record."
              : "These synthetic examples are not clinical advice. No suggestion is finalized or added to a patient record by this demo."}
          </p>
        </div>
      </div>
      <div className="section-heading review-heading">
        <div>
          <div className="eyebrow">HUMAN REVIEW REQUIRED</div>
          <h2>Clinical review queue</h2>
        </div>
        <span className="queue-count">
          {items.filter((item) => item.status === "Pending review").length} pending
        </span>
      </div>
      <div className="review-list">
        {items.length === 0 ? (
          <EmptyState
            title="No suggestions awaiting review"
            detail={connected
              ? "No clinical suggestions are assigned to this account."
              : "This demo has no additional sample suggestions."}
          />
        ) : items.map((item) => (
          <article className="review-card" key={item.id}>
            <div className="review-card-top">
              <div>
                <span className="review-tag">{connected ? "CLINICAL REVIEW" : "SYNTHETIC SAMPLE"}</span>
                <h3>{item.title}</h3>
                <p className="review-patient">{item.patient}</p>
              </div>
              <span className={`review-status ${item.status !== "Pending review" ? "reviewed" : ""}`}>
                {item.status}
              </span>
            </div>
            <p className="review-detail">{item.detail}</p>
            <div className="confidence-row">
              <span>{connected ? "Model confidence (decision support)" : "Sample confidence score"}</span>
              <strong>{item.confidence}%</strong>
            </div>
            <div
              className="confidence-track"
              role="progressbar"
              aria-label="Sample confidence score"
              aria-valuenow={item.confidence}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${item.confidence}%` }} />
            </div>
            <div className="review-footer">
              <span>Compare against source before any clinical decision.</span>
              {connected ? (
                <div className="review-actions">
                  <button
                    className="button button-secondary"
                    disabled={item.status !== "Pending review"}
                    onClick={() => onReview(item.id, "rejected")}
                  >
                    Reject
                  </button>
                  <button
                    className="button button-primary"
                    disabled={item.status !== "Pending review"}
                    onClick={() => onReview(item.id, "approved")}
                  >
                    Approve
                  </button>
                </div>
              ) : (
                <button
                  className="button button-secondary"
                  disabled={item.status !== "Pending review"}
                  onClick={() => onReview(item.id)}
                >
                  {item.status === "Reviewed in demo" ? "Reviewed in demo" : "Mark reviewed"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Records() {
  return (
    <section className="panel page-panel">
      <div className="eyebrow">HEALTH INFORMATION</div>
      <h2 className="page-panel-title">Health records</h2>
      <p className="panel-intro">
        The entries below are sample data for this local demo. No records have been connected.
      </p>
      <div className="record-list">
        <article className="record-row">
          <span className="record-icon lavender" aria-hidden="true">▤</span>
          <span><strong>Visit summary</strong><small>Sample · October 8, 2026</small></span>
          <span className="record-label">DEMO</span>
        </article>
        <article className="record-row">
          <span className="record-icon mint" aria-hidden="true">⌁</span>
          <span><strong>Vitals snapshot</strong><small>Sample · October 2, 2026</small></span>
          <span className="record-label">DEMO</span>
        </article>
      </div>
      <div className="records-disclaimer">
        Connecting real records requires an authenticated account, configured database,
        access policies, and a verified deployment.
      </div>
    </section>
  );
}

function CareTeam() {
  return (
    <section className="panel page-panel">
      <div className="eyebrow">YOUR SUPPORT NETWORK</div>
      <h2 className="page-panel-title">Care team</h2>
      <p className="panel-intro">Sample profiles only. No real clinicians are connected.</p>
      <div className="care-team-grid">
        {[
          ["MP", "Dr. Maya Patel", "Cardiology"],
          ["NW", "Dr. Noah Williams", "Primary care"],
          ["JL", "Jordan Lee, RN", "Care coordinator"],
        ].map(([initials, name, specialty]) => (
          <article className="care-person" key={name}>
            <div className="avatar avatar-lilac" aria-hidden="true">{initials}</div>
            <strong>{name}</strong>
            <span>{specialty}</span>
            <span className="sample-label">DEMO PROFILE</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">○</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function AuthLoading() {
  return (
    <main className="auth-shell">
      <div className="auth-card" role="status">
        <div className="brand-mark" aria-hidden="true">+</div>
        <h1>Checking your session</h1>
        <p>Connecting securely to your configured Supabase project.</p>
      </div>
    </main>
  );
}

function SupabaseConfigurationError({ message }: { message: string }) {
  return (
    <main className="auth-shell">
      <section className="auth-card" role="alert">
        <div className="brand-mark" aria-hidden="true">!</div>
        <h1>Supabase configuration is incomplete</h1>
        <p className="auth-message">{message}</p>
        <p className="auth-footnote">
          Update the local environment file and restart the application. No fallback to demo
          mode is made when only part of the Supabase configuration is present.
        </p>
      </section>
    </main>
  );
}

function SupabaseAuth({
  client,
  initialMessage,
}: {
  client: SupabaseClient<Database>;
  initialMessage: string;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [accountType, setAccountType] = useState<"patient" | "visitor">("patient");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      if (mode === "sign-in") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) setMessage(error.message);
      } else {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              requested_access: accountType,
            },
          },
        });
        if (error) {
          setMessage(error.message);
        } else if (!data.session) {
          setMessage("Check your email to confirm your account, then sign in.");
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Authentication could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/" aria-label="Carewell home">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span>
            <strong>Carewell</strong>
            <small>Accessible care</small>
          </span>
        </Link>
        <div className="eyebrow">SECURE ACCOUNT</div>
        <h1>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-description">
          Sign in to access your configured hospital workspace. Staff accounts are provisioned
          by a trusted administrator.
        </p>
        <form className="auth-form" onSubmit={submit}>
          {mode === "sign-up" && (
            <>
            <label>
              Name
              <input
                autoComplete="name"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label>
              Account type
              <select
                value={accountType}
                onChange={(event) => setAccountType(event.target.value as "patient" | "visitor")}
              >
                <option value="patient">Patient</option>
                <option value="visitor">Visitor</option>
              </select>
            </label>
            </>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {message && (
            <p className="auth-message" role="alert">
              {message}
            </p>
          )}
          <button className="button button-primary auth-submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "sign-in" ? "New to this workspace?" : "Already have an account?"}{" "}
          <button
            className="text-button"
            onClick={() => {
              setMessage("");
              setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
            }}
          >
            {mode === "sign-in" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <p className="auth-footnote">
          Patient and visitor registrations cannot assign staff privileges. Doctors must
          submit qualifications and be verified before receiving doctor access. Administrator
          accounts must be provisioned by the project owner.
        </p>
      </section>
    </main>
  );
}
