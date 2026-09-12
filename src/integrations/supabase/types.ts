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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blurt_segments: {
        Row: {
          at_seconds: number
          concept: string | null
          created_at: string
          duration_seconds: number
          example_count: number
          id: string
          session_id: string
          transcript: string
          verdict: string
        }
        Insert: {
          at_seconds?: number
          concept?: string | null
          created_at?: string
          duration_seconds?: number
          example_count?: number
          id?: string
          session_id: string
          transcript: string
          verdict?: string
        }
        Update: {
          at_seconds?: number
          concept?: string | null
          created_at?: string
          duration_seconds?: number
          example_count?: number
          id?: string
          session_id?: string
          transcript?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "blurt_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_topics: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          origin: string
          session_id: string
          topic: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          origin?: string
          session_id: string
          topic: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          origin?: string
          session_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_topics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          color: string
          created_at: string
          id: string
          subject: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          subject?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      qa_turns: {
        Row: {
          content: string
          created_at: string
          id: string
          question_id: string | null
          role: string
          session_id: string
          verdict: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          question_id?: string | null
          role: string
          session_id: string
          verdict?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          question_id?: string | null
          role?: string
          session_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_turns_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          concept: string | null
          created_at: string
          id: string
          question: string
          session_id: string
          source: string
          status: string
        }
        Insert: {
          concept?: string | null
          created_at?: string
          id?: string
          question: string
          session_id: string
          source?: string
          status?: string
        }
        Update: {
          concept?: string | null
          created_at?: string
          id?: string
          question?: string
          session_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          blurt_limit_seconds: number
          created_at: string
          id: string
          key_concepts: Json
          notebook_id: string
          notes_text: string | null
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          blurt_limit_seconds?: number
          created_at?: string
          id?: string
          key_concepts?: Json
          notebook_id: string
          notes_text?: string | null
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          blurt_limit_seconds?: number
          created_at?: string
          id?: string
          key_concepts?: Json
          notebook_id?: string
          notes_text?: string | null
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          answered_well: Json
          covered: Json
          created_at: string
          example_count: number
          gaps: Json
          id: string
          narrative: string | null
          open_questions: Json
          session_id: string
          speaking_seconds: number
          subtopic_time: Json
        }
        Insert: {
          answered_well?: Json
          covered?: Json
          created_at?: string
          example_count?: number
          gaps?: Json
          id?: string
          narrative?: string | null
          open_questions?: Json
          session_id: string
          speaking_seconds?: number
          subtopic_time?: Json
        }
        Update: {
          answered_well?: Json
          covered?: Json
          created_at?: string
          example_count?: number
          gaps?: Json
          id?: string
          narrative?: string | null
          open_questions?: Json
          session_id?: string
          speaking_seconds?: number
          subtopic_time?: Json
        }
        Relationships: [
          {
            foreignKeyName: "summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
