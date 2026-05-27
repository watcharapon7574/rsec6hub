Initialising login role...
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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
            referencedRelation: "caper_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_otp_recipients_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "data_std_editors_v"
            referencedColumns: ["id"]
          },
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
      chat_messages: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          image_urls: string[] | null
          is_admin: boolean | null
          message: string | null
          read_by_admin: boolean | null
          read_by_user: boolean | null
          room_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          image_urls?: string[] | null
          is_admin?: boolean | null
          message?: string | null
          read_by_admin?: boolean | null
          read_by_user?: boolean | null
          room_id: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          image_urls?: string[] | null
          is_admin?: boolean | null
          message?: string | null
          read_by_admin?: boolean | null
          read_by_user?: boolean | null
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          user_id?: string
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
      data_std: {
        Row: {
          age: string | null
          caretaker_teacher: string | null
          created_at: string
          disability_type: string | null
          dob: string | null
          field_editors: Json
          full_name: string | null
          gender: string | null
          has_card: string | null
          id: string
          national_id: string | null
          order_no: number | null
          pending_changes: Json
          room: string | null
          service_point: string
          service_type: string | null
          set_payload: Json | null
          status: string
          student_code: string | null
          updated_at: string
        }
        Insert: {
          age?: string | null
          caretaker_teacher?: string | null
          created_at?: string
          disability_type?: string | null
          dob?: string | null
          field_editors?: Json
          full_name?: string | null
          gender?: string | null
          has_card?: string | null
          id?: string
          national_id?: string | null
          order_no?: number | null
          pending_changes?: Json
          room?: string | null
          service_point: string
          service_type?: string | null
          set_payload?: Json | null
          status?: string
          student_code?: string | null
          updated_at?: string
        }
        Update: {
          age?: string | null
          caretaker_teacher?: string | null
          created_at?: string
          disability_type?: string | null
          dob?: string | null
          field_editors?: Json
          full_name?: string | null
          gender?: string | null
          has_card?: string | null
          id?: string
          national_id?: string | null
          order_no?: number | null
          pending_changes?: Json
          room?: string | null
          service_point?: string
          service_type?: string | null
          set_payload?: Json | null
          status?: string
          student_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      data_std_admins: {
        Row: {
          added_at: string
          note: string | null
          profile_id: string
          role: string
        }
        Insert: {
          added_at?: string
          note?: string | null
          profile_id: string
          role?: string
        }
        Update: {
          added_at?: string
          note?: string | null
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_std_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "caper_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_std_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "data_std_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_std_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_std_edits: {
        Row: {
          edited_at: string
          editor_id: string | null
          editor_name: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          student_id: string
        }
        Insert: {
          edited_at?: string
          editor_id?: string | null
          editor_name?: string | null
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          student_id: string
        }
        Update: {
          edited_at?: string
          editor_id?: string | null
          editor_name?: string | null
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_std_edits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "data_std"
            referencedColumns: ["id"]
          },
        ]
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
          stamp_department: string | null
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
          stamp_department?: string | null
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
          stamp_department?: string | null
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
      external_auth_tokens: {
        Row: {
          created_at: string | null
          device_name: string | null
          employee_id: string
          id: string
          is_revoked: boolean | null
          last_used_at: string | null
          phone: string
          profile_id: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          employee_id: string
          id?: string
          is_revoked?: boolean | null
          last_used_at?: string | null
          phone: string
          profile_id?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          employee_id?: string
          id?: string
          is_revoked?: boolean | null
          last_used_at?: string | null
          phone?: string
          profile_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_auth_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "caper_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_auth_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "data_std_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_auth_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          reply_to_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          reply_to_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          reply_to_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "feed_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          author_avatar_url: string | null
          author_name: string | null
          author_position: string | null
          category: string | null
          created_at: string | null
          description: string | null
          form_data: Json | null
          id: string
          images: Json | null
          location: Json | null
          report_type: string | null
          tags: Json | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          youtube_url: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          author_avatar_url?: string | null
          author_name?: string | null
          author_position?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          form_data?: Json | null
          id?: string
          images?: Json | null
          location?: Json | null
          report_type?: string | null
          tags?: Json | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          author_avatar_url?: string | null
          author_name?: string | null
          author_position?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          form_data?: Json | null
          id?: string
          images?: Json | null
          location?: Json | null
          report_type?: string | null
          tags?: Json | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      feed_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      health_check_log: {
        Row: {
          checked_at: string
          details: Json | null
          healthy: boolean
          id: number
          latency_ms: number
          status_code: number
        }
        Insert: {
          checked_at?: string
          details?: Json | null
          healthy: boolean
          id?: number
          latency_ms: number
          status_code: number
        }
        Update: {
          checked_at?: string
          details?: Json | null
          healthy?: boolean
          id?: number
          latency_ms?: number
          status_code?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          current_signer_order: number
          days_count: number
          doc_number: string | null
          doc_number_at: string | null
          end_date: string
          entry_source: Database["public"]["Enums"]["leave_entry_source"]
          fiscal_half: number
          fiscal_year: number
          form_data: Json | null
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
          user_name: string | null
          user_position: string | null
        }
        Insert: {
          created_at?: string
          current_signer_order?: number
          days_count: number
          doc_number?: string | null
          doc_number_at?: string | null
          end_date: string
          entry_source?: Database["public"]["Enums"]["leave_entry_source"]
          fiscal_half: number
          fiscal_year: number
          form_data?: Json | null
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id: string
          user_name?: string | null
          user_position?: string | null
        }
        Update: {
          created_at?: string
          current_signer_order?: number
          days_count?: number
          doc_number?: string | null
          doc_number_at?: string | null
          end_date?: string
          entry_source?: Database["public"]["Enums"]["leave_entry_source"]
          fiscal_half?: number
          fiscal_year?: number
          form_data?: Json | null
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string
          rejection_reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
          user_name?: string | null
          user_position?: string | null
        }
        Relationships: []
      }
      leave_signatures: {
        Row: {
          comment: string | null
          hr_decision: Database["public"]["Enums"]["leave_hr_decision"] | null
          id: string
          leave_request_id: string
          signature_url: string | null
          signed_at: string
          signer_name: string
          signer_order: number
          signer_role: Database["public"]["Enums"]["leave_signer_role"]
          signer_user_id: string
          status: string
        }
        Insert: {
          comment?: string | null
          hr_decision?: Database["public"]["Enums"]["leave_hr_decision"] | null
          id?: string
          leave_request_id: string
          signature_url?: string | null
          signed_at?: string
          signer_name: string
          signer_order: number
          signer_role: Database["public"]["Enums"]["leave_signer_role"]
          signer_user_id: string
          status: string
        }
        Update: {
          comment?: string | null
          hr_decision?: Database["public"]["Enums"]["leave_hr_decision"] | null
          id?: string
          leave_request_id?: string
          signature_url?: string | null
          signed_at?: string
          signer_name?: string
          signer_order?: number
          signer_role?: Database["public"]["Enums"]["leave_signer_role"]
          signer_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_signatures_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      memo_annotation_layers: {
        Row: {
          created_at: string | null
          id: string
          layer_url: string
          memo_id: string
          page_number: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          layer_url: string
          memo_id: string
          page_number: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          layer_url?: string
          memo_id?: string
          page_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memo_annotation_layers_memo_id_fkey"
            columns: ["memo_id"]
            isOneToOne: false
            referencedRelation: "memos"
            referencedColumns: ["id"]
          },
        ]
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
          annotation_required_for: string[] | null
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
          parallel_signers: Json | null
          pdf_draft_path: string | null
          pdf_final_path: string | null
          proposal: string | null
          rejected_name_comment: Json | null
          rejection_reason: string | null
          revision_count: number
          signature_positions: Json | null
          signatures: Json | null
          signer_list_progress: Json | null
          signing_lock: Json | null
          stamp_department: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annotated_attachment_paths?: string | null
          annotated_pdf_path?: string | null
          annotation_required_for?: string[] | null
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
          parallel_signers?: Json | null
          pdf_draft_path?: string | null
          pdf_final_path?: string | null
          proposal?: string | null
          rejected_name_comment?: Json | null
          rejection_reason?: string | null
          revision_count?: number
          signature_positions?: Json | null
          signatures?: Json | null
          signer_list_progress?: Json | null
          signing_lock?: Json | null
          stamp_department?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annotated_attachment_paths?: string | null
          annotated_pdf_path?: string | null
          annotation_required_for?: string[] | null
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
          parallel_signers?: Json | null
          pdf_draft_path?: string | null
          pdf_final_path?: string | null
          proposal?: string | null
          rejected_name_comment?: Json | null
          rejection_reason?: string | null
          revision_count?: number
          signature_positions?: Json | null
          signatures?: Json | null
          signer_list_progress?: Json | null
          signing_lock?: Json | null
          stamp_department?: string | null
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
      ocr_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_segmented: string | null
          content_segmented_tsv: unknown
          context_summary: string | null
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          page_number: number
        }
        Insert: {
          chunk_index?: number
          content: string
          content_segmented?: string | null
          content_segmented_tsv?: unknown
          context_summary?: string | null
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          page_number: number
        }
        Update: {
          chunk_index?: number
          content?: string
          content_segmented?: string | null
          content_segmented_tsv?: unknown
          context_summary?: string | null
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ocr_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ocr_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_delete_logs: {
        Row: {
          deleted_at: string
          deleted_by: string
          deleted_by_name: string | null
          document_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          page_count: number | null
        }
        Insert: {
          deleted_at?: string
          deleted_by: string
          deleted_by_name?: string | null
          document_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          page_count?: number | null
        }
        Update: {
          deleted_at?: string
          deleted_by?: string
          deleted_by_name?: string | null
          document_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          page_count?: number | null
        }
        Relationships: []
      }
      ocr_documents: {
        Row: {
          created_at: string
          embedding: string | null
          error_message: string | null
          extracted_text: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string | null
          fts: unknown
          id: string
          is_public: boolean
          notes: string | null
          page_count: number | null
          status: string
          storage_path: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          error_message?: string | null
          extracted_text?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url?: string | null
          fts?: unknown
          id?: string
          is_public?: boolean
          notes?: string | null
          page_count?: number | null
          status?: string
          storage_path?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          error_message?: string | null
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string | null
          fts?: unknown
          id?: string
          is_public?: boolean
          notes?: string | null
          page_count?: number | null
          status?: string
          storage_path?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocr_download_tokens: {
        Row: {
          available_at: string
          created_at: string
          document_id: string
          expires_at: string
          ip: string | null
          token: string
          used: boolean
          user_agent: string | null
        }
        Insert: {
          available_at: string
          created_at?: string
          document_id: string
          expires_at: string
          ip?: string | null
          token: string
          used?: boolean
          user_agent?: string | null
        }
        Update: {
          available_at?: string
          created_at?: string
          document_id?: string
          expires_at?: string
          ip?: string | null
          token?: string
          used?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_download_tokens_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ocr_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_pages: {
        Row: {
          created_at: string
          document_id: string
          embedding: string | null
          extracted_text: string | null
          fts: unknown
          id: string
          page_number: number
        }
        Insert: {
          created_at?: string
          document_id: string
          embedding?: string | null
          extracted_text?: string | null
          fts?: unknown
          id?: string
          page_number: number
        }
        Update: {
          created_at?: string
          document_id?: string
          embedding?: string | null
          extracted_text?: string | null
          fts?: unknown
          id?: string
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ocr_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ocr_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_rate_limit: {
        Row: {
          action: string
          count: number
          ip: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          ip: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          ip?: string
          window_start?: string
        }
        Relationships: []
      }
      ocr_search_history: {
        Row: {
          created_at: string
          id: string
          mode: string
          query: string
          result_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          query: string
          result_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          query?: string
          result_count?: number
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
      payslip_batches: {
        Row: {
          created_at: string | null
          file_url: string
          id: string
          matched_records: number
          month: number
          page_count: number
          status: string
          storage_path: string
          total_records: number
          updated_at: string | null
          uploaded_by: string
          year: number
        }
        Insert: {
          created_at?: string | null
          file_url: string
          id?: string
          matched_records?: number
          month: number
          page_count: number
          status?: string
          storage_path: string
          total_records?: number
          updated_at?: string | null
          uploaded_by: string
          year: number
        }
        Update: {
          created_at?: string | null
          file_url?: string
          id?: string
          matched_records?: number
          month?: number
          page_count?: number
          status?: string
          storage_path?: string
          total_records?: number
          updated_at?: string | null
          uploaded_by?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslip_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "caper_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "data_std_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          batch_id: string
          created_at: string | null
          deduction_items: Json
          employee_name: string
          employee_position: string | null
          half: string
          id: string
          income_items: Json
          net_pay: number | null
          page_number: number
          profile_id: string | null
          raw_ocr_text: string | null
          total_deductions: number | null
          total_income: number | null
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          deduction_items?: Json
          employee_name: string
          employee_position?: string | null
          half: string
          id?: string
          income_items?: Json
          net_pay?: number | null
          page_number: number
          profile_id?: string | null
          raw_ocr_text?: string | null
          total_deductions?: number | null
          total_income?: number | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          deduction_items?: Json
          employee_name?: string
          employee_position?: string | null
          half?: string
          id?: string
          income_items?: Json
          net_pay?: number | null
          page_number?: number
          profile_id?: string | null
          raw_ocr_text?: string | null
          total_deductions?: number | null
          total_income?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payslip_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "caper_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "data_std_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          name: string | null
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
          name?: string | null
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
          name?: string | null
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
      shared_categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          name: string
        }
        Update: {
          created_at?: string | null
          id?: never
          name?: string
        }
        Relationships: []
      }
      shared_tags: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          name: string
        }
        Update: {
          created_at?: string | null
          id?: never
          name?: string
        }
        Relationships: []
      }
      std_attendance: {
        Row: {
          check_in: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_out: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          confidence_in: number | null
          confidence_out: number | null
          created_at: string | null
          date: string
          guardian_in: string | null
          guardian_out: string | null
          id: string
          method_in: string | null
          method_out: string | null
          notes: string | null
          service_point_id: string | null
          student_id: string | null
          teacher_name: string | null
          updated_at: string | null
        }
        Insert: {
          check_in?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          confidence_in?: number | null
          confidence_out?: number | null
          created_at?: string | null
          date?: string
          guardian_in?: string | null
          guardian_out?: string | null
          id?: string
          method_in?: string | null
          method_out?: string | null
          notes?: string | null
          service_point_id?: string | null
          student_id?: string | null
          teacher_name?: string | null
          updated_at?: string | null
        }
        Update: {
          check_in?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          confidence_in?: number | null
          confidence_out?: number | null
          created_at?: string | null
          date?: string
          guardian_in?: string | null
          guardian_out?: string | null
          id?: string
          method_in?: string | null
          method_out?: string | null
          notes?: string | null
          service_point_id?: string | null
          student_id?: string | null
          teacher_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "std_attendance_service_point_id_fkey"
            columns: ["service_point_id"]
            isOneToOne: false
            referencedRelation: "std_service_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "std_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "std_students"
            referencedColumns: ["id"]
          },
        ]
      }
      std_classrooms: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          service_point_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          service_point_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          service_point_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "std_classrooms_service_point_id_fkey"
            columns: ["service_point_id"]
            isOneToOne: false
            referencedRelation: "std_service_points"
            referencedColumns: ["id"]
          },
        ]
      }
      std_service_points: {
        Row: {
          created_at: string | null
          district: string | null
          id: string
          is_active: boolean
          is_headquarters: boolean
          lat: number
          lng: number
          name: string
          radius_meters: number
          short_name: string
        }
        Insert: {
          created_at?: string | null
          district?: string | null
          id?: string
          is_active?: boolean
          is_headquarters?: boolean
          lat: number
          lng: number
          name: string
          radius_meters?: number
          short_name: string
        }
        Update: {
          created_at?: string | null
          district?: string | null
          id?: string
          is_active?: boolean
          is_headquarters?: boolean
          lat?: number
          lng?: number
          name?: string
          radius_meters?: number
          short_name?: string
        }
        Relationships: []
      }
      std_students: {
        Row: {
          classroom_id: string | null
          created_at: string | null
          face_embeddings: Json | null
          id: string
          is_active: boolean | null
          name: string
          nickname: string | null
          service_point: string | null
          updated_at: string | null
        }
        Insert: {
          classroom_id?: string | null
          created_at?: string | null
          face_embeddings?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          nickname?: string | null
          service_point?: string | null
          updated_at?: string | null
        }
        Update: {
          classroom_id?: string | null
          created_at?: string | null
          face_embeddings?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          nickname?: string | null
          service_point?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "std_students_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "std_classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      std_teacher_attendance: {
        Row: {
          anti_spoof_score_in: number | null
          anti_spoof_score_out: number | null
          auto_checkout: boolean | null
          check_in: string | null
          check_out: string | null
          confidence_in: number | null
          confidence_out: number | null
          created_at: string | null
          date: string
          device_fingerprint: string | null
          id: string
          is_late: boolean
          late_reason: string | null
          service_point_id: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          anti_spoof_score_in?: number | null
          anti_spoof_score_out?: number | null
          auto_checkout?: boolean | null
          check_in?: string | null
          check_out?: string | null
          confidence_in?: number | null
          confidence_out?: number | null
          created_at?: string | null
          date: string
          device_fingerprint?: string | null
          id?: string
          is_late?: boolean
          late_reason?: string | null
          service_point_id?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          anti_spoof_score_in?: number | null
          anti_spoof_score_out?: number | null
          auto_checkout?: boolean | null
          check_in?: string | null
          check_out?: string | null
          confidence_in?: number | null
          confidence_out?: number | null
          created_at?: string | null
          date?: string
          device_fingerprint?: string | null
          id?: string
          is_late?: boolean
          late_reason?: string | null
          service_point_id?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "std_teacher_attendance_service_point_id_fkey"
            columns: ["service_point_id"]
            isOneToOne: false
            referencedRelation: "std_service_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "std_teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "caper_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "std_teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "data_std_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "std_teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      std_teacher_faces: {
        Row: {
          device_fingerprint: string | null
          enrolled_at: string | null
          face_embeddings: Json | null
          id: string
          is_admin: boolean | null
          service_point_id: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          device_fingerprint?: string | null
          enrolled_at?: string | null
          face_embeddings?: Json | null
          id?: string
          is_admin?: boolean | null
          service_point_id?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          device_fingerprint?: string | null
          enrolled_at?: string | null
          face_embeddings?: Json | null
          id?: string
          is_admin?: boolean | null
          service_point_id?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "std_teacher_faces_service_point_id_fkey"
            columns: ["service_point_id"]
            isOneToOne: false
            referencedRelation: "std_service_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "std_teacher_faces_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "caper_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "std_teacher_faces_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "data_std_editors_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "std_teacher_faces_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      std_teacher_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
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
          event_end_date: string | null
          event_end_time: string | null
          event_time: string | null
          group_id: string | null
          id: string
          is_reporter: boolean | null
          is_team_leader: boolean | null
          leader_note: string | null
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
          event_end_date?: string | null
          event_end_time?: string | null
          event_time?: string | null
          group_id?: string | null
          id?: string
          is_reporter?: boolean | null
          is_team_leader?: boolean | null
          leader_note?: string | null
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
          event_end_date?: string | null
          event_end_time?: string | null
          event_time?: string | null
          group_id?: string | null
          id?: string
          is_reporter?: boolean | null
          is_team_leader?: boolean | null
          leader_note?: string | null
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
      upload_sessions: {
        Row: {
          committed: boolean | null
          created_at: string | null
          files: string[] | null
          id: string
        }
        Insert: {
          committed?: boolean | null
          created_at?: string | null
          files?: string[] | null
          id?: string
        }
        Update: {
          committed?: boolean | null
          created_at?: string | null
          files?: string[] | null
          id?: string
        }
        Relationships: []
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
      caper_editors_v: {
        Row: {
          first_name: string | null
          id: string | null
          last_name: string | null
          prefix: string | null
          telegram_chat_id: string | null
        }
        Insert: {
          first_name?: never
          id?: string | null
          last_name?: never
          prefix?: never
          telegram_chat_id?: string | null
        }
        Update: {
          first_name?: never
          id?: string | null
          last_name?: never
          prefix?: never
          telegram_chat_id?: string | null
        }
        Relationships: []
      }
      data_std_editors_v: {
        Row: {
          first_name: string | null
          id: string | null
          is_admin: boolean | null
          last_name: string | null
          prefix: string | null
        }
        Insert: {
          first_name?: never
          id?: string | null
          is_admin?: never
          last_name?: never
          prefix?: never
        }
        Update: {
          first_name?: never
          id?: string | null
          is_admin?: never
          last_name?: never
          prefix?: never
        }
        Relationships: []
      }
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
      acquire_signing_lock: {
        Args: { p_memo_id: string; p_user_id: string }
        Returns: boolean
      }
      approve_leave_request: {
        Args: {
          p_comment?: string
          p_hr_decision?: Database["public"]["Enums"]["leave_hr_decision"]
          p_leave_id: string
          p_signature_url?: string
          p_signer_name: string
          p_signer_role: Database["public"]["Enums"]["leave_signer_role"]
        }
        Returns: {
          created_at: string
          current_signer_order: number
          days_count: number
          doc_number: string | null
          doc_number_at: string | null
          end_date: string
          entry_source: Database["public"]["Enums"]["leave_entry_source"]
          fiscal_half: number
          fiscal_year: number
          form_data: Json | null
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
          user_name: string | null
          user_position: string | null
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      data_std_admin_add: {
        Args: { p_editor_id: string; p_payload: Json; p_phone_last4: string }
        Returns: {
          age: string | null
          caretaker_teacher: string | null
          created_at: string
          disability_type: string | null
          dob: string | null
          field_editors: Json
          full_name: string | null
          gender: string | null
          has_card: string | null
          id: string
          national_id: string | null
          order_no: number | null
          pending_changes: Json
          room: string | null
          service_point: string
          service_type: string | null
          set_payload: Json | null
          status: string
          student_code: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "data_std"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      data_std_admin_add_v2: {
        Args: { p_payload: Json; p_token: string }
        Returns: {
          age: string | null
          caretaker_teacher: string | null
          created_at: string
          disability_type: string | null
          dob: string | null
          field_editors: Json
          full_name: string | null
          gender: string | null
          has_card: string | null
          id: string
          national_id: string | null
          order_no: number | null
          pending_changes: Json
          room: string | null
          service_point: string
          service_type: string | null
          set_payload: Json | null
          status: string
          student_code: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "data_std"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      data_std_admin_delete: {
        Args: {
          p_editor_id: string
          p_phone_last4: string
          p_student_id: string
        }
        Returns: string
      }
      data_std_admin_delete_v2: {
        Args: { p_student_id: string; p_token: string }
        Returns: string
      }
      data_std_admin_move: {
        Args: {
          p_editor_id: string
          p_phone_last4: string
          p_room: string
          p_service_point: string
          p_student_id: string
        }
        Returns: {
          age: string | null
          caretaker_teacher: string | null
          created_at: string
          disability_type: string | null
          dob: string | null
          field_editors: Json
          full_name: string | null
          gender: string | null
          has_card: string | null
          id: string
          national_id: string | null
          order_no: number | null
          pending_changes: Json
          room: string | null
          service_point: string
          service_type: string | null
          set_payload: Json | null
          status: string
          student_code: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "data_std"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      data_std_admin_move_v2: {
        Args: {
          p_room: string
          p_service_point: string
          p_student_id: string
          p_token: string
        }
        Returns: {
          age: string | null
          caretaker_teacher: string | null
          created_at: string
          disability_type: string | null
          dob: string | null
          field_editors: Json
          full_name: string | null
          gender: string | null
          has_card: string | null
          id: string
          national_id: string | null
          order_no: number | null
          pending_changes: Json
          room: string | null
          service_point: string
          service_type: string | null
          set_payload: Json | null
          status: string
          student_code: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "data_std"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      data_std_ext_session: {
        Args: { p_token: string }
        Returns: {
          avatar_url: string
          editor_id: string
          editor_name: string
          employee_id: string
          is_admin: boolean
        }[]
      }
      data_std_history: {
        Args: { p_field: string; p_student_id: string }
        Returns: {
          edited_at: string
          editor_id: string | null
          editor_name: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          student_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "data_std_edits"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      data_std_history_all: {
        Args: { p_student_id: string }
        Returns: {
          edited_at: string
          editor_id: string | null
          editor_name: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          student_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "data_std_edits"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      data_std_is_admin: { Args: { p_profile_id: string }; Returns: boolean }
      data_std_list: {
        Args: never
        Returns: {
          age: string | null
          caretaker_teacher: string | null
          created_at: string
          disability_type: string | null
          dob: string | null
          field_editors: Json
          full_name: string | null
          gender: string | null
          has_card: string | null
          id: string
          national_id: string | null
          order_no: number | null
          pending_changes: Json
          room: string | null
          service_point: string
          service_type: string | null
          set_payload: Json | null
          status: string
          student_code: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "data_std"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      data_std_resolve_phone: {
        Args: { p_phone_last4: string }
        Returns: {
          first_name: string
          id: string
          is_admin: boolean
          last_name: string
          prefix: string
        }[]
      }
      data_std_summary: { Args: never; Returns: Json }
      data_std_token_to_admin: {
        Args: { p_token: string }
        Returns: {
          editor_id: string
          editor_name: string
        }[]
      }
      data_std_update_field: {
        Args: {
          p_editor_id: string
          p_field: string
          p_new_value: string
          p_phone_last4: string
          p_student_id: string
        }
        Returns: {
          age: string | null
          caretaker_teacher: string | null
          created_at: string
          disability_type: string | null
          dob: string | null
          field_editors: Json
          full_name: string | null
          gender: string | null
          has_card: string | null
          id: string
          national_id: string | null
          order_no: number | null
          pending_changes: Json
          room: string | null
          service_point: string
          service_type: string | null
          set_payload: Json | null
          status: string
          student_code: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "data_std"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      data_std_update_field_v2: {
        Args: {
          p_field: string
          p_new_value: string
          p_student_id: string
          p_token: string
        }
        Returns: {
          age: string | null
          caretaker_teacher: string | null
          created_at: string
          disability_type: string | null
          dob: string | null
          field_editors: Json
          full_name: string | null
          gender: string | null
          has_card: string | null
          id: string
          national_id: string | null
          order_no: number | null
          pending_changes: Json
          room: string | null
          service_point: string
          service_type: string | null
          set_payload: Json | null
          status: string
          student_code: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "data_std"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      data_std_verify_editor: {
        Args: { p_editor_id: string; p_phone_last4: string }
        Returns: {
          editor_id: string
          editor_name: string
          is_admin: boolean
        }[]
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
      get_payslips_by_profile: { Args: { p_profile_id: string }; Returns: Json }
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
      is_chat_admin: { Args: never; Returns: boolean }
      is_clerk_or_admin: { Args: never; Returns: boolean }
      is_leave_director: { Args: { p_user_id: string }; Returns: boolean }
      is_leave_hr_head: { Args: { p_user_id: string }; Returns: boolean }
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
      ocr_chunk_hybrid_search: {
        Args: {
          full_text_weight?: number
          match_count?: number
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          content: string
          context_summary: string
          created_at: string
          document_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          fts_rank: number
          page_number: number
          rrf_score: number
          semantic_rank: number
          tags: string[]
        }[]
      }
      ocr_chunk_hybrid_search_public: {
        Args: {
          full_text_weight?: number
          match_count?: number
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          content: string
          context_summary: string
          created_at: string
          document_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          fts_rank: number
          page_number: number
          rrf_score: number
          semantic_rank: number
          storage_path: string
          tags: string[]
        }[]
      }
      ocr_cleanup_expired_tokens: { Args: never; Returns: undefined }
      ocr_docs_name_tag_match: {
        Args: { match_count?: number; tokens: string[] }
        Returns: {
          chunk_id: string
          chunk_index: number
          content: string
          context_summary: string
          created_at: string
          document_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          fts_rank: number
          page_number: number
          rrf_score: number
          semantic_rank: number
          tags: string[]
        }[]
      }
      ocr_hybrid_search: {
        Args: {
          full_text_weight?: number
          match_count?: number
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          created_at: string
          extracted_text: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          fts_rank: number
          id: string
          notes: string
          page_count: number
          rrf_score: number
          semantic_rank: number
          status: string
          tags: string[]
          user_id: string
        }[]
      }
      ocr_insert_chunk: {
        Args: {
          p_chunk_index: number
          p_content: string
          p_content_segmented: string
          p_context_summary: string
          p_document_id: string
          p_embedding: string
          p_page_number: number
        }
        Returns: string
      }
      ocr_update_document_vectors: {
        Args: { doc_embedding: string; doc_id: string; doc_text: string }
        Returns: undefined
      }
      ocr_update_page_vectors: {
        Args: { page_embedding: string; page_id: string; page_text: string }
        Returns: undefined
      }
      peek_leave_doc_number: { Args: never; Returns: string }
      prune_health_check_log: { Args: never; Returns: undefined }
      register_manual_leave_entry: {
        Args: {
          p_days_count: number
          p_director_signer_name?: string
          p_end_date: string
          p_fiscal_half: number
          p_fiscal_year: number
          p_hr_signer_name?: string
          p_leave_type: Database["public"]["Enums"]["leave_type"]
          p_reason: string
          p_remarks?: string
          p_start_date: string
          p_user_name: string
          p_user_position: string
        }
        Returns: {
          created_at: string
          current_signer_order: number
          days_count: number
          doc_number: string | null
          doc_number_at: string | null
          end_date: string
          entry_source: Database["public"]["Enums"]["leave_entry_source"]
          fiscal_half: number
          fiscal_year: number
          form_data: Json | null
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
          user_name: string | null
          user_position: string | null
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_leave_request: {
        Args: {
          p_leave_id: string
          p_reason: string
          p_signature_url?: string
          p_signer_name: string
          p_signer_role: Database["public"]["Enums"]["leave_signer_role"]
        }
        Returns: {
          created_at: string
          current_signer_order: number
          days_count: number
          doc_number: string | null
          doc_number_at: string | null
          end_date: string
          entry_source: Database["public"]["Enums"]["leave_entry_source"]
          fiscal_half: number
          fiscal_year: number
          form_data: Json | null
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
          user_name: string | null
          user_position: string | null
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_telegram_notification: {
        Args: { payload: Json }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_task_assignment: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
      std_add_embedding: {
        Args: { p_embedding: Json; p_student_id: string }
        Returns: undefined
      }
      std_blend_teacher_embedding: {
        Args: {
          blend_index?: number
          new_embedding: Json
          teacher_uuid: string
        }
        Returns: undefined
      }
      update_document_reporters: {
        Args: { p_assignment_id: string; p_reporter_user_ids: string[] }
        Returns: undefined
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
      leave_entry_source: "system" | "manual"
      leave_hr_decision: "acknowledge" | "consider" | "recommend_approve"
      leave_signer_role: "hr_head" | "director"
      leave_status:
        | "draft"
        | "pending"
        | "in_progress"
        | "approved"
        | "rejected"
      leave_type:
        | "sick_leave"
        | "personal_leave"
        | "annual_leave"
        | "maternity_leave"
        | "paternity_leave"
        | "ordination_leave"
        | "military_leave"
        | "study_leave"
        | "spouse_follow_leave"
        | "rehabilitation_leave"
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
  graphql_public: {
    Enums: {},
  },
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
      leave_entry_source: ["system", "manual"],
      leave_hr_decision: ["acknowledge", "consider", "recommend_approve"],
      leave_signer_role: ["hr_head", "director"],
      leave_status: ["draft", "pending", "in_progress", "approved", "rejected"],
      leave_type: [
        "sick_leave",
        "personal_leave",
        "annual_leave",
        "maternity_leave",
        "paternity_leave",
        "ordination_leave",
        "military_leave",
        "study_leave",
        "spouse_follow_leave",
        "rehabilitation_leave",
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
A new version of Supabase CLI is available: v2.101.0 (currently installed v2.67.1)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
