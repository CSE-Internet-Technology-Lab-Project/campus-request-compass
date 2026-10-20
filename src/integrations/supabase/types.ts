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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          program: Database["public"]["Enums"]["program_level"] | null
          roll_no: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          program?: Database["public"]["Enums"]["program_level"] | null
          roll_no?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          program?: Database["public"]["Enums"]["program_level"] | null
          roll_no?: string | null
        }
        Relationships: []
      }
      project_applications: {
        Row: {
          created_at: string
          id: string
          project_id: string
          statement: string
          status: Database["public"]["Enums"]["application_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          statement?: string
          status?: Database["public"]["Enums"]["application_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          statement?: string
          status?: Database["public"]["Enums"]["application_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string
          faculty_id: string
          id: string
          is_open: boolean
          max_students: number
          program: Database["public"]["Enums"]["program_level"]
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          faculty_id: string
          id?: string
          is_open?: boolean
          max_students?: number
          program: Database["public"]["Enums"]["program_level"]
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          faculty_id?: string
          id?: string
          is_open?: boolean
          max_students?: number
          program?: Database["public"]["Enums"]["program_level"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_history: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          remarks: string | null
          request_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          remarks?: string | null
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          remarks?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          created_at: string
          details: string
          faculty_id: string
          faculty_remarks: string | null
          hod_remarks: string | null
          id: string
          needed_by: string | null
          program: Database["public"]["Enums"]["program_level"]
          request_type: string
          status: Database["public"]["Enums"]["request_status"]
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string
          faculty_id: string
          faculty_remarks?: string | null
          hod_remarks?: string | null
          id?: string
          needed_by?: string | null
          program: Database["public"]["Enums"]["program_level"]
          request_type: string
          status?: Database["public"]["Enums"]["request_status"]
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string
          faculty_id?: string
          faculty_remarks?: string | null
          hod_remarks?: string | null
          id?: string
          needed_by?: string | null
          program?: Database["public"]["Enums"]["program_level"]
          request_type?: string
          status?: Database["public"]["Enums"]["request_status"]
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      act_on_application: {
        Args: { _approve: boolean; _id: string }
        Returns: undefined
      }
      act_on_request: {
        Args: { _approve: boolean; _id: string; _remarks: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      withdraw_request: { Args: { _id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "student" | "faculty" | "hod"
      application_status:
        | "applied"
        | "faculty_accepted"
        | "allocated"
        | "rejected"
      program_level: "UG" | "PG"
      request_status:
        | "pending_faculty"
        | "pending_hod"
        | "approved"
        | "rejected"
        | "withdrawn"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["student", "faculty", "hod"],
      application_status: [
        "applied",
        "faculty_accepted",
        "allocated",
        "rejected",
      ],
      program_level: ["UG", "PG"],
      request_status: [
        "pending_faculty",
        "pending_hod",
        "approved",
        "rejected",
        "withdrawn",
      ],
    },
  },
} as const
