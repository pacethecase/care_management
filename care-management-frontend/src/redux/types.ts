// redux/types.ts

export interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    birth_date: string;
    age?: number;
    bed_id?: string;
    medical_info?: string;
    status?: string;
    assigned_staff_id?: number | null;
    staff_name?: string;
    discharge_note?: string | null;
    discharge_date?: string | null;
    mrn?: string;
    admitted_date?: string;
    guardianship_court_datetime?: string;
    ltc_court_datetime?: string;
    created_at?: string; 

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
  }
  
  export interface UserInfo {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    is_staff: boolean;
    token?: string;
  }
  
 
export interface Note {
    id: number;
    patient_id: number;
    staff_id: number;
    staff_name?: string;
    note_text: string;
    created_at: string;
  }
  
  export interface Task {
    task_id: number;
    task_name: string;
    description: string;
    algorithm: string;
    due_date: string;
    ideal_due_date?: string;
    completed_at?: string;
    missed_reason?: string;
    status: string;
    condition_required?: string;
    is_non_blocking?: boolean;
    is_repeating?: boolean;
    due_in_days_after_dependency?: number;
    patient_name?:string;
    task_note?:string
    contact_info?: string;
    include_note_in_report?: boolean;
  }
  export interface Notification {
    id: string | number;
    title: string;
    message: string;
    timestamp?: string;
    created_at?: string;
    read?: boolean;
  }
  
  // redux/types.ts

export interface AlgorithmPatientCount {
    algorithm: "Behavioral" | "Guardianship" | "LTC";
    count: number;
  }
  
export interface PatientTask {
    id: number;
    patient_id: number;
    task_id: number;
    assigned_staff_id: number | null;
    status: 'Pending' | 'In Progress' | 'Completed' | 'Missed' | 'FollowUp';
    due_date: string; // ISO string
    completed_at: string | null;
    ideal_due_date: string | null;
    started_at: string | null;
    created_at: string;
    status_history: {
      status: string;
      timestamp: string;
      updated_by?: string;
      
    }[];
    
    // Extra fields for UI convenience
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

  export interface PatientSummary {
    barrier_to_discharge: string;
    daily_prioritization: string;
    incomplete_tasks: string;
    projected_completion: string;
  }
  