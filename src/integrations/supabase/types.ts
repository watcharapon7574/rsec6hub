export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          priority: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          created_at: string | null
          description: string
          id: string
          images: Json | null
          location: Json | null
          report_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          images?: Json | null
          location?: Json | null
          report_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          images?: Json | null
          location?: Json | null
          report_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          days_count: number
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["approval_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_count: number
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_count?: number
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string
          rejection_reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memo_approval_steps: {
        Row: {
          approved_at: string | null
          approver_id: string
          approver_name: string
          approver_position: string
          comment: string | null
          created_at: string | null
          id: string
          signature_position: Json
          status: string | null
          step_order: number
          workflow_id: string
        }
        Insert: {
          approved_at?: string | null
          approver_id: string
          approver_name: string
          approver_position: string
          comment?: string | null
          created_at?: string | null
          id?: string
          signature_position: Json
          status?: string | null
          step_order: number
          workflow_id: string
        }
        Update: {
          approved_at?: string | null
          approver_id?: string
          approver_name?: string
          approver_position?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          signature_position?: Json
          status?: string | null
          step_order?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memo_approval_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "memo_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      memo_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          memo_id: string
          message: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          memo_id: string
          message: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          memo_id?: string
          message?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memo_notifications_memo_id_fkey"
            columns: ["memo_id"]
            isOneToOne: false
            referencedRelation: "memos"
            referencedColumns: ["id"]
          },
        ]
      }
      memo_workflows: {
        Row: {
          content: Json
          created_at: string | null
          created_by: string
          current_step: number | null
          document_date: string
          document_number: string
          id: string
          signature_positions: Json
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          created_by: string
          current_step?: number | null
          document_date: string
          document_number: string
          id?: string
          signature_positions: Json
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          created_by?: string
          current_step?: number | null
          document_date?: string
          document_number?: string
          id?: string
          signature_positions?: Json
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      memos: {
        Row: {
          attached_files: string | null
          attachment_title: string | null
          author_name: string
          author_position: string
          created_at: string
          current_signer_order: number | null
          date: string
          doc_number: string
          document_summary: string | null
          fact: string | null
          form_data: Json
          id: string
          introduction: string | null
          pdf_draft_path: string | null
          pdf_final_path: string | null
          proposal: string | null
          signature_positions: Json | null
          signatures: Json | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attached_files?: string | null
          attachment_title?: string | null
          author_name: string
          author_position: string
          created_at?: string
          current_signer_order?: number | null
          date: string
          doc_number: string
          document_summary?: string | null
          fact?: string | null
          form_data: Json
          id?: string
          introduction?: string | null
          pdf_draft_path?: string | null
          pdf_final_path?: string | null
          proposal?: string | null
          signature_positions?: Json | null
          signatures?: Json | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attached_files?: string | null
          attachment_title?: string | null
          author_name?: string
          author_position?: string
          created_at?: string
          current_signer_order?: number | null
          date?: string
          doc_number?: string
          document_summary?: string | null
          fact?: string | null
          form_data?: Json
          id?: string
          introduction?: string | null
          pdf_draft_path?: string | null
          pdf_final_path?: string | null
          proposal?: string | null
          signature_positions?: Json | null
          signatures?: Json | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      official_documents: {
        Row: {
          assistant_approved_at: string | null
          assistant_approved_by: string | null
          clerk_approved_at: string | null
          clerk_approved_by: string | null
          content: string
          created_at: string | null
          current_approver_level: number | null
          deputy_approved_at: string | null
          deputy_approved_by: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          document_date: string
          document_number: string | null
          id: string
          recipient: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["approval_status"] | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assistant_approved_at?: string | null
          assistant_approved_by?: string | null
          clerk_approved_at?: string | null
          clerk_approved_by?: string | null
          content: string
          created_at?: string | null
          current_approver_level?: number | null
          deputy_approved_at?: string | null
          deputy_approved_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          document_date: string
          document_number?: string | null
          id?: string
          recipient: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assistant_approved_at?: string | null
          assistant_approved_by?: string | null
          clerk_approved_at?: string | null
          clerk_approved_by?: string | null
          content?: string
          created_at?: string | null
          current_approver_level?: number | null
          deputy_approved_at?: string | null
          deputy_approved_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          document_date?: string
          document_number?: string | null
          id?: string
          recipient?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number | null
          created_at: string | null
          expires_at: string
          id: string
          is_used: boolean | null
          otp_code: string
          phone: string
          telegram_chat_id: number | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          is_used?: boolean | null
          otp_code: string
          phone: string
          telegram_chat_id?: number | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          is_used?: boolean | null
          otp_code?: string
          phone?: string
          telegram_chat_id?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          academic_rank: string | null
          address: string | null
          age: number | null
          birth_date: string | null
          created_at: string | null
          current_position: string | null
          documents: Json | null
          education: string | null
          education_history: Json | null
          email: string | null
          emergency_contact: string | null
          employee_id: string
          ethnicity: string | null
          father_name: string | null
          father_occupation: string | null
          first_name: string
          id: string
          is_admin: boolean | null
          job_position: string | null
          last_name: string
          marital_status: string | null
          mother_name: string | null
          mother_occupation: string | null
          nationality: string | null
          nickname: string | null
          number_of_children: number | null
          org_structure_role: string | null
          phone: string | null
          position: Database["public"]["Enums"]["position_type"]
          postal_code: string | null
          prefix: string
          profile_picture_url: string | null
          religion: string | null
          signature_url: string | null
          spouse: string | null
          start_work_date: string | null
          telegram_chat_id: number | null
          updated_at: string | null
          user_id: string | null
          work_experience_years: number | null
          work_history: Json | null
          workplace: string | null
        }
        Insert: {
          academic_rank?: string | null
          address?: string | null
          age?: number | null
          birth_date?: string | null
          created_at?: string | null
          current_position?: string | null
          documents?: Json | null
          education?: string | null
          education_history?: Json | null
          email?: string | null
          emergency_contact?: string | null
          employee_id: string
          ethnicity?: string | null
          father_name?: string | null
          father_occupation?: string | null
          first_name: string
          id?: string
          is_admin?: boolean | null
          job_position?: string | null
          last_name: string
          marital_status?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          nationality?: string | null
          nickname?: string | null
          number_of_children?: number | null
          org_structure_role?: string | null
          phone?: string | null
          position: Database["public"]["Enums"]["position_type"]
          postal_code?: string | null
          prefix?: string
          profile_picture_url?: string | null
          religion?: string | null
          signature_url?: string | null
          spouse?: string | null
          start_work_date?: string | null
          telegram_chat_id?: number | null
          updated_at?: string | null
          user_id?: string | null
          work_experience_years?: number | null
          work_history?: Json | null
          workplace?: string | null
        }
        Update: {
          academic_rank?: string | null
          address?: string | null
          age?: number | null
          birth_date?: string | null
          created_at?: string | null
          current_position?: string | null
          documents?: Json | null
          education?: string | null
          education_history?: Json | null
          email?: string | null
          emergency_contact?: string | null
          employee_id?: string
          ethnicity?: string | null
          father_name?: string | null
          father_occupation?: string | null
          first_name?: string
          id?: string
          is_admin?: boolean | null
          job_position?: string | null
          last_name?: string
          marital_status?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          nationality?: string | null
          nickname?: string | null
          number_of_children?: number | null
          org_structure_role?: string | null
          phone?: string | null
          position?: Database["public"]["Enums"]["position_type"]
          postal_code?: string | null
          prefix?: string
          profile_picture_url?: string | null
          religion?: string | null
          signature_url?: string | null
          spouse?: string | null
          start_work_date?: string | null
          telegram_chat_id?: number | null
          updated_at?: string | null
          user_id?: string | null
          work_experience_years?: number | null
          work_history?: Json | null
          workplace?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          expires_at: string
          id: string
          ip_address: unknown | null
          is_active: boolean
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      invalidate_old_sessions: {
        Args: { _user_id: string; _current_session_token: string }
        Returns: undefined
      }
      log_otp_verification: {
        Args: {
          p_phone: string
          p_otp: string
          p_action: string
          p_details?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected" | "in_progress"
      leave_type:
        | "sick_leave"
        | "personal_leave"
        | "annual_leave"
        | "maternity_leave"
        | "ordination_leave"
      position_type:
        | "director"
        | "deputy_director"
        | "assistant_director"
        | "government_teacher"
        | "government_employee"
        | "contract_teacher"
        | "clerk_teacher"
        | "disability_aide"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["pending", "approved", "rejected", "in_progress"],
      leave_type: [
        "sick_leave",
        "personal_leave",
        "annual_leave",
        "maternity_leave",
        "ordination_leave",
      ],
      position_type: [
        "director",
        "deputy_director",
        "assistant_director",
        "government_teacher",
        "government_employee",
        "contract_teacher",
        "clerk_teacher",
        "disability_aide",
      ],
    },
  },
} as const
