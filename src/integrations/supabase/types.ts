export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_login_logs: {
        Row: {
          admin_phone: string
          id: string
          ip_address: string | null
          logged_in_at: string | null
          login_success: boolean | null
          otp_code: string | null
          recipient_name: string | null
          telegram_chat_id: number
          user_agent: string | null
        }
        Insert: {
          admin_phone: string
          id?: string
          ip_address?: string | null
          logged_in_at?: string | null
          login_success?: boolean | null
          otp_code?: string | null
          recipient_name?: string | null
          telegram_chat_id: number
          user_agent?: string | null
        }
        Update: {
          admin_phone?: string
          id?: string
          ip_address?: string | null
          logged_in_at?: string | null
          login_success?: boolean | null
          otp_code?: string | null
          recipient_name?: string | null
          telegram_chat_id?: number
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_otp_recipients: {
        Row: {
          added_by: string | null
          admin_phone: string
          created_at: string | null
          id: string
          is_active: boolean | null
          recipient_name: string
          telegram_chat_id: number
          updated_at: string | null
        }
        Insert: {
          added_by?: string | null
          admin_phone: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          recipient_name: string
          telegram_chat_id: number
          updated_at?: string | null
        }
        Update: {
          added_by?: string | null
          admin_phone?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          recipient_name?: string
          telegram_chat_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_otp_recipients_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
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
      departments: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      doc_receive: {
        Row: {
          annotated_attachment_paths: string | null
          annotated_pdf_path: string | null
          attached_files: string | null
          attachment_title: string | null
          author_name: string
          author_position: string
          clerk_id: string | null
          created_at: string
          created_by: string | null
          current_signer_order: number | null
          date: string
          device_info: Json | null
          doc_del: Json | null
          doc_number: string
          doc_number_status: Json | null
          document_summary: string | null
          fact: string | null
          form_data: Json
          id: string
          introduction: string | null
          is_assigned: boolean | null
          pdf_draft_path: string | null
          pdf_final_path: string | null
          proposal: string | null
          rejected_name_comment: Json | null
          signature_positions: Json | null
          signatures: Json | null
          signer_list_progress: Json | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annotated_attachment_paths?: string | null
          annotated_pdf_path?: string | null
          attached_files?: string | null
          attachment_title?: string | null
          author_name: string
          author_position: string
          clerk_id?: string | null
          created_at?: string
          created_by?: string | null
          current_signer_order?: number | null
          date: string
          device_info?: Json | null
          doc_del?: Json | null
          doc_number: string
          doc_number_status?: Json | null
          document_summary?: string | null
          fact?: string | null
          form_data: Json
          id?: string
          introduction?: string | null
          is_assigned?: boolean | null
          pdf_draft_path?: string | null
          pdf_final_path?: string | null
          proposal?: string | null
          rejected_name_comment?: Json | null
          signature_positions?: Json | null
          signatures?: Json | null
          signer_list_progress?: Json | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annotated_attachment_paths?: string | null
          annotated_pdf_path?: string | null
          attached_files?: string | null
          attachment_title?: string | null
          author_name?: string
          author_position?: string
          clerk_id?: string | null
          created_at?: string
          created_by?: string | null
          current_signer_order?: number | null
          date?: string
          device_info?: Json | null
          doc_del?: Json | null
          doc_number?: string
          doc_number_status?: Json | null
          document_summary?: string | null
          fact?: string | null
          form_data?: Json
          id?: string
          introduction?: string | null
          is_assigned?: boolean | null
          pdf_draft_path?: string | null
          pdf_final_path?: string | null
          proposal?: string | null
          rejected_name_comment?: Json | null
          signature_positions?: Json | null
          signatures?: Json | null
          signer_list_progress?: Json | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      doc_receive_notifications: {
        Row: {
          created_at: string
          doc_receive_id: string
          id: string
          is_read: boolean | null
          message: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_receive_id: string
          id?: string
          is_read?: boolean | null
          message: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_receive_id?: string
          id?: string
          is_read?: boolean | null
          message?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      document_register_extra: {
        Row: {
          action_taken: string | null
          created_at: string | null
          doc_reference: string | null
          id: string
          remarks: string | null
          source_id: string
          source_type: string
          to_person: string | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          doc_reference?: string | null
          id?: string
          remarks?: string | null
          source_id: string
          source_type: string
          to_person?: string | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          doc_reference?: string | null
          id?: string
          remarks?: string | null
          source_id?: string
          source_type?: string
          to_person?: string | null
        }
        Relationships: []
      }
      document_register_manual: {
        Row: {
          action_taken: string | null
          created_at: string | null
          created_by: string | null
          doc_date: string | null
          doc_number: string | null
          doc_reference: string | null
          from_org: string | null
          id: string
          register_number: number
          register_type: string
          remarks: string | null
          subject: string
          to_person: string | null
          year: number | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          created_by?: string | null
          doc_date?: string | null
          doc_number?: string | null
          doc_reference?: string | null
          from_org?: string | null
          id?: string
          register_number: number
          register_type: string
          remarks?: string | null
          subject: string
          to_person?: string | null
          year?: number | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          created_by?: string | null
          doc_date?: string | null
          doc_number?: string | null
          doc_reference?: string | null
          from_org?: string | null
          id?: string
          register_number?: number
          register_type?: string
          remarks?: string | null
          subject?: string
          to_person?: string | null
          year?: number | null
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
          annotated_attachment_paths: string | null
          annotated_pdf_path: string | null
          attached_files: string | null
          attachment_title: string | null
          author_name: string
          author_position: string
          clerk_id: string | null
          created_at: string
          current_signer_order: number | null
          date: string
          device_info: Json | null
          doc_del: Json | null
          doc_number: string
          doc_number_status: Json | null
          document_summary: string | null
          fact: string | null
          form_data: Json
          id: string
          introduction: string | null
          is_assigned: boolean | null
          is_report_memo: boolean | null
          pdf_draft_path: string | null
          pdf_final_path: string | null
          proposal: string | null
          rejected_name_comment: Json | null
          rejection_reason: string | null
          revision_count: number
          signature_positions: Json | null
          signatures: Json | null
          signer_list_progress: Json | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annotated_attachment_paths?: string | null
          annotated_pdf_path?: string | null
          attached_files?: string | null
          attachment_title?: string | null
          author_name: string
          author_position: string
          clerk_id?: string | null
          created_at?: string
          current_signer_order?: number | null
          date: string
          device_info?: Json | null
          doc_del?: Json | null
          doc_number: string
          doc_number_status?: Json | null
          document_summary?: string | null
          fact?: string | null
          form_data: Json
          id?: string
          introduction?: string | null
          is_assigned?: boolean | null
          is_report_memo?: boolean | null
          pdf_draft_path?: string | null
          pdf_final_path?: string | null
          proposal?: string | null
          rejected_name_comment?: Json | null
          rejection_reason?: string | null
          revision_count?: number
          signature_positions?: Json | null
          signatures?: Json | null
          signer_list_progress?: Json | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annotated_attachment_paths?: string | null
          annotated_pdf_path?: string | null
          attached_files?: string | null
          attachment_title?: string | null
          author_name?: string
          author_position?: string
          clerk_id?: string | null
          created_at?: string
          current_signer_order?: number | null
          date?: string
          device_info?: Json | null
          doc_del?: Json | null
          doc_number?: string
          doc_number_status?: Json | null
          document_summary?: string | null
          fact?: string | null
          form_data?: Json
          id?: string
          introduction?: string | null
          is_assigned?: boolean | null
          is_report_memo?: boolean | null
          pdf_draft_path?: string | null
          pdf_final_path?: string | null
          proposal?: string | null
          rejected_name_comment?: Json | null
          rejection_reason?: string | null
          revision_count?: number
          signature_positions?: Json | null
          signatures?: Json | null
          signer_list_progress?: Json | null
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
          telegram_chat_id: string | null
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
          telegram_chat_id?: string | null
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
          telegram_chat_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_experience_years?: number | null
          work_history?: Json | null
          workplace?: string | null
        }
        Relationships: []
      }
      railway_logs: {
        Row: {
          action: string
          created_at: string | null
          error_message: string | null
          id: string
          schedule_id: string | null
          service_id: string
          service_name: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          schedule_id?: string | null
          service_id: string
          service_name?: string | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          schedule_id?: string | null
          service_id?: string
          service_name?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "railway_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "railway_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      railway_schedules: {
        Row: {
          created_at: string | null
          days_of_week: number[]
          enabled: boolean | null
          environment_id: string
          id: string
          last_run_at: string | null
          manual_override_until: string | null
          next_run_at: string | null
          service_id: string
          service_name: string
          start_time: string
          stop_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days_of_week?: number[]
          enabled?: boolean | null
          environment_id: string
          id?: string
          last_run_at?: string | null
          manual_override_until?: string | null
          next_run_at?: string | null
          service_id: string
          service_name: string
          start_time: string
          stop_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days_of_week?: number[]
          enabled?: boolean | null
          environment_id?: string
          id?: string
          last_run_at?: string | null
          manual_override_until?: string | null
          next_run_at?: string | null
          service_id?: string
          service_name?: string
          start_time?: string
          stop_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      saved_locations: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string
          assigned_to: string
          assignment_source: string | null
          completed_at: string | null
          completion_note: string | null
          deleted_at: string | null
          doc_receive_id: string | null
          document_type: string
          event_date: string | null
          event_time: string | null
          group_id: string | null
          id: string
          is_reporter: boolean | null
          is_team_leader: boolean | null
          location: string | null
          memo_id: string | null
          note: string | null
          parent_assignment_id: string | null
          position_id: string | null
          report_file_url: string | null
          report_memo_id: string | null
          status: string | null
          task_description: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by: string
          assigned_to: string
          assignment_source?: string | null
          completed_at?: string | null
          completion_note?: string | null
          deleted_at?: string | null
          doc_receive_id?: string | null
          document_type: string
          event_date?: string | null
          event_time?: string | null
          group_id?: string | null
          id?: string
          is_reporter?: boolean | null
          is_team_leader?: boolean | null
          location?: string | null
          memo_id?: string | null
          note?: string | null
          parent_assignment_id?: string | null
          position_id?: string | null
          report_file_url?: string | null
          report_memo_id?: string | null
          status?: string | null
          task_description?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string
          assigned_to?: string
          assignment_source?: string | null
          completed_at?: string | null
          completion_note?: string | null
          deleted_at?: string | null
          doc_receive_id?: string | null
          document_type?: string
          event_date?: string | null
          event_time?: string | null
          group_id?: string | null
          id?: string
          is_reporter?: boolean | null
          is_team_leader?: boolean | null
          location?: string | null
          memo_id?: string | null
          note?: string | null
          parent_assignment_id?: string | null
          position_id?: string | null
          report_file_url?: string | null
          report_memo_id?: string | null
          status?: string | null
          task_description?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_doc_receive_id_fkey"
            columns: ["doc_receive_id"]
            isOneToOne: false
            referencedRelation: "doc_receive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_memo_id_fkey"
            columns: ["memo_id"]
            isOneToOne: false
            referencedRelation: "memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_parent_assignment_id_fkey"
            columns: ["parent_assignment_id"]
            isOneToOne: false
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_report_memo_id_fkey"
            columns: ["report_memo_id"]
            isOneToOne: false
            referencedRelation: "memos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          created_at: string
          created_by: string
          group_type: string | null
          id: string
          leader_user_id: string | null
          members: Json
          name: string
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          group_type?: string | null
          id?: string
          leader_user_id?: string | null
          members?: Json
          name: string
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          group_type?: string | null
          id?: string
          leader_user_id?: string | null
          members?: Json
          name?: string
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          expires_at: string
          id: string
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
          is_active?: boolean
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      view_events: {
        Row: {
          created_at: string
          id: string
          ip_hash: string
          media_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash: string
          media_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string
          media_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      register_external_view: {
        Row: {
          action_taken: string | null
          doc_date: string | null
          doc_number: string | null
          doc_reference: string | null
          extra_id: string | null
          from_org: string | null
          register_number: number | null
          remarks: string | null
          source_id: string | null
          source_type: string | null
          subject: string | null
          to_person: string | null
        }
        Relationships: []
      }
      register_internal_view: {
        Row: {
          action_taken: string | null
          doc_date: string | null
          doc_number: string | null
          doc_reference: string | null
          extra_id: string | null
          from_org: string | null
          register_number: number | null
          remarks: string | null
          source_id: string | null
          source_type: string | null
          subject: string | null
          to_person: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      clear_phone_from_auth_users: {
        Args: { phone_to_clear: string }
        Returns: Json
      }
      create_task_assignment: {
        Args: {
          p_assigned_to: string
          p_document_id: string
          p_document_type: string
          p_note?: string
        }
        Returns: string
      }
      get_documents_ready_for_assignment: {
        Args: never
        Returns: {
          author_name: string
          completed_at: string
          document_id: string
          document_number: string
          document_subject: string
          document_type: string
          has_in_progress_task: boolean
          is_assigned: boolean
          last_comment: string
        }[]
      }
      get_task_assignment_by_report_memo: {
        Args: { p_report_memo_id: string }
        Returns: {
          assigned_at: string
          assigned_by: string
          assigned_to: string
          assignment_source: string
          completed_at: string
          completion_note: string
          deleted_at: string
          doc_receive_id: string
          document_type: string
          event_date: string
          event_time: string
          group_id: string
          id: string
          is_reporter: boolean
          is_team_leader: boolean
          location: string
          memo_id: string
          note: string
          parent_assignment_id: string
          position_id: string
          report_file_url: string
          report_memo_id: string
          status: string
          task_description: string
          updated_at: string
        }[]
      }
      get_user_assigned_tasks: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_status?: string
          p_user_id?: string
        }
        Returns: {
          assigned_at: string
          assigned_by_id: string
          assigned_by_name: string
          assigned_to_id: string
          assigned_to_name: string
          assignment_id: string
          assignment_source: string
          completed_at: string
          completion_note: string
          document_id: string
          document_number: string
          document_pdf_url: string
          document_subject: string
          document_type: string
          event_date: string
          event_time: string
          group_id: string
          group_name: string
          has_reporter_assigned: boolean
          is_reporter: boolean
          is_team_leader: boolean
          location: string
          note: string
          parent_assignment_id: string
          position_id: string
          position_name: string
          reporter_has_reported: boolean
          status: string
          task_description: string
          updated_at: string
        }[]
      }
      invalidate_old_sessions: {
        Args: {
          _current_session_token: string
          _device_fingerprint?: string
          _user_id: string
        }
        Returns: undefined
      }
      is_team_leader_for_document:
        | {
            Args: { p_doc_receive_id: string; p_memo_id: string }
            Returns: boolean
          }
        | {
            Args: {
              p_doc_receive_id: string
              p_document_type: string
              p_memo_id: string
            }
            Returns: boolean
          }
      log_otp_verification: {
        Args: {
          p_action: string
          p_details?: Json
          p_otp: string
          p_phone: string
        }
        Returns: undefined
      }
      send_telegram_notification: {
        Args: { payload: Json }
        Returns: undefined
      }
      soft_delete_task_assignment: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
      update_task_status:
        | {
            Args: {
              p_assignment_id: string
              p_completion_note?: string
              p_new_status: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_assignment_id: string
              p_completion_note?: string
              p_new_status: string
              p_report_file_url?: string
            }
            Returns: boolean
          }
      user_shares_document_with_assignment: {
        Args: { p_doc_receive_id: string; p_memo_id: string }
        Returns: boolean
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected" | "in_progress"
      category_enum:
        | "GAME"
        | "SCIENCE"
        | "MATH"
        | "THAI"
        | "ENGLISH"
        | "SOCIAL"
        | "OTHER"
      leave_type:
        | "sick_leave"
        | "personal_leave"
        | "annual_leave"
        | "maternity_leave"
        | "ordination_leave"
      media_status_enum: "PENDING" | "APPROVED" | "REJECTED"
      position_type:
        | "director"
        | "deputy_director"
        | "assistant_director"
        | "government_teacher"
        | "government_employee"
        | "contract_teacher"
        | "clerk_teacher"
        | "disability_aide"
        | "vacant"
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
      category_enum: [
        "GAME",
        "SCIENCE",
        "MATH",
        "THAI",
        "ENGLISH",
        "SOCIAL",
        "OTHER",
      ],
      leave_type: [
        "sick_leave",
        "personal_leave",
        "annual_leave",
        "maternity_leave",
        "ordination_leave",
      ],
      media_status_enum: ["PENDING", "APPROVED", "REJECTED"],
      position_type: [
        "director",
        "deputy_director",
        "assistant_director",
        "government_teacher",
        "government_employee",
        "contract_teacher",
        "clerk_teacher",
        "disability_aide",
        "vacant",
      ],
    },
  },
} as const
