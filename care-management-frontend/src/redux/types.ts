// ─── redux/types.ts ───────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'admin' | 'staff' | 'administration';

export interface Organization {
  id: number;
  name: string;
  timezone: string;
  created_at?: string;
}

export interface Hospital {
  id: number;
  name: string;
  daily_room_cost: number;
  organization_id: number | null;
  timezone: string;
  created_at?: string;
}

export interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  hospital_id: number | null;
  organization_id: number | null;
  is_approved: boolean;
  is_verified?: boolean;
  has_global_access: boolean;
  timezone: string;
  token?: string;
}

export interface Staff {
  id: number;
  name: string;
  access_level?: 'view' | 'edit';
}

export interface Note {
  id: number;
  patient_id: number;
  staff_id: number;
  nurse_name?: string;
  note_text: string;
  created_at: string;
}

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  age?: number;                  
  room_no?: string;
  medical_info?: string;
  status?: string;
  assigned_staff_id?: number | null;
  assigned_staff?: Staff[];
  staff_name?: string;
  discharge_note?: string | null;
  discharge_date?: string | null;
  mrn?: string;
  admitted_date?: string;

  created_at?: string;
  created_at_local?: string;
  task_status?: string;

  is_behavioral: boolean;
  is_restrained: boolean;
  is_geriatric_psych_available: boolean;
  is_behavioral_team: boolean;
  is_ltc: boolean;
  is_ltc_financial: boolean;
  is_ltc_medical: boolean;
  is_guardianship: boolean;
  is_guardianship_financial: boolean;
  is_guardianship_person: boolean;
  is_guardianship_emergency: boolean;
  guardianship_court_date?: string | null;
  ltc_court_date?: string | null;

  added_by_user_id: number;

  // FIX: removed selected_algorithms string[] — now fetched from patient_algorithms table
  active_algorithms?: string[];   // populated by API from patient_algorithms WHERE removed_at IS NULL

  updated_at?: string;
  archived_at?: string | null;
  archived_reason?: string | null;
  hospital_id?: number;
  hospital_name?: string;
  version: number;
}

export interface Task {
  patient_task_id: number;
  task_id: number;
  patient_id: number;
  task_name: string;
  is_overridable?: boolean;
  description: string;
  algorithm: string;
  due_date: string;
  ideal_due_date?: string;

  completed_at?: string;
  completed_by?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  started_at?: string;
  started_by?: string;
  missed_reason?: string;
  status: string;
  condition_required?: string;
  is_non_blocking?: boolean;
  is_repeating?: boolean;
  due_in_days_after_dependency?: number;
  patient_name?: string;
  task_note?: string;
  contact_info?: string;
  include_note_in_report?: boolean;
  is_court_date?: boolean;
  override_count: number;
  override_count_max: number;
  admin_override_approval?: boolean;
  version: number;

  status_history?: {
    id: number;
    old_status: string;
    new_status: string;
    changed_by_user_id: number;
    changed_at: string;
    note?: string;
  }[];
}

export interface PatientTask {
  id: number;
  patient_id: number;
  task_id: number;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Missed' | 'Overridden' | 'Waived';

  due_date: string;
  ideal_due_date: string | null;

  completed_at: string | null;
  started_at: string | null;
  created_at: string;

  status_history: {
    id: number;
    old_status: string;
    new_status: string;
    changed_by_user_id: number;
    changed_at: string;
    note?: string;
  }[];

  task_name: string;
  description: string;
  algorithm: 'Behavioral' | 'Guardianship' | 'LTC';
  is_repeating?: boolean;
  is_non_blocking?: boolean;
  due_in_days_after_dependency?: number | null;
  condition_required?: string | null;
  patient_name?: string;
  task_note?: string;
  contact_info?: string;
  include_note_in_report?: boolean;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  task_id?: number | string;
  timestamp?: string;
  created_at?: string;
  patientTaskId?: number;
  type?: string;
  read?: boolean;
  request_status?: string;
}

export interface AlgorithmPatientCount {
  algorithm: 'Behavioral' | 'Guardianship' | 'LTC';
  count: number;
}

export interface UnapprovedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;             
  is_approved: boolean;
  hospital_id?: number;
  is_verified?: boolean;
  organization_id?: number;
}


export interface PublicHospital {
  id: number;
  name: string;
  organization_id: number | null;
}

export interface PublicOrganization {
  id: number;
  name: string;
}