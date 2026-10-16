import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          clinician_id: string | null;
          starts_at: string;
          visit_type: "video" | "in_person";
          status: "requested" | "confirmed" | "cancelled" | "completed";
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          clinician_id?: string | null;
          starts_at: string;
          visit_type: "video" | "in_person";
          status?: "requested" | "confirmed" | "cancelled" | "completed";
          created_at?: string;
        };
        Update: {
          starts_at?: string;
          visit_type?: "video" | "in_person";
          status?: "requested" | "confirmed" | "cancelled" | "completed";
        };
        Relationships: [];
      };
      clinical_ai_reviews: {
        Row: {
          id: string;
          patient_id: string;
          clinician_id: string;
          suggestion: Json;
          confidence: number;
          status: "pending" | "approved" | "rejected";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          clinician_id: string;
          suggestion: Json;
          confidence: number;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: "pending" | "approved" | "rejected";
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role:
            | "patient"
            | "visitor"
            | "caregiver"
            | "doctor"
            | "nurse"
            | "administrator"
            | "reception"
            | "lab_technician"
            | "pharmacist"
            | "auditor";
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          role?:
            | "patient"
            | "visitor"
            | "caregiver"
            | "doctor"
            | "nurse"
            | "administrator"
            | "reception"
            | "lab_technician"
            | "pharmacist"
            | "auditor";
          created_at?: string;
        };
        Update: {
          display_name?: string;
        };
        Relationships: [];
      };
      doctor_applications: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          contact_email: string;
          contact_phone: string;
          specialty: string;
          qualification: string;
          institution: string;
          medical_license_number: string;
          license_region: string;
          graduation_year: number;
          years_experience: number;
          biography: string;
          status: "pending" | "approved" | "rejected";
          rejection_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          contact_email: string;
          contact_phone: string;
          specialty: string;
          qualification: string;
          institution: string;
          medical_license_number: string;
          license_region: string;
          graduation_year: number;
          years_experience: number;
          biography: string;
          status?: "pending" | "approved" | "rejected";
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: "approved" | "rejected";
          rejection_reason?: string | null;
        };
        Relationships: [];
      };
      doctor_profiles: {
        Row: {
          id: string;
          full_name: string;
          contact_email: string;
          contact_phone: string;
          specialty: string;
          qualification: string;
          institution: string;
          license_region: string;
          graduation_year: number;
          years_experience: number;
          biography: string;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          contact_email: string;
          contact_phone: string;
          specialty: string;
          qualification: string;
          institution: string;
          license_region: string;
          graduation_year: number;
          years_experience: number;
          biography: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_app_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigurationError() === null &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseConfigurationError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !anonKey) return null;
  if (!url || !anonKey) {
    return "Set both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or remove both to use local demo mode.";
  }
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return "NEXT_PUBLIC_SUPABASE_URL must use HTTP or HTTPS.";
    }
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.";
  }
  return null;
}

export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  const configurationError = getSupabaseConfigurationError();
  if (configurationError) throw new Error(configurationError);
  if (!browserClient) browserClient = createClient<Database>(url, anonKey);
  return browserClient;
}
