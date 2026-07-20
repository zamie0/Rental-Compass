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
      checklist_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          label: string
          position: number
          property_id: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          label: string
          position?: number
          property_id: string
          user_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          label?: string
          position?: number
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      commute_targets: {
        Row: {
          address: string | null
          created_at: string
          id: string
          label: string
          latitude: number | null
          longitude: number | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          label: string
          latitude?: number | null
          longitude?: number | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          label?: string
          latitude?: number | null
          longitude?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          notification_prefs: Json
          phone: string | null
          privacy_prefs: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          notification_prefs?: Json
          phone?: string | null
          privacy_prefs?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          notification_prefs?: Json
          phone?: string | null
          privacy_prefs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          agent_name: string | null
          agent_phone: string | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          decision: Database["public"]["Enums"]["property_decision"]
          description: string | null
          facilities: string[]
          furnished: string | null
          id: string
          image_url: string | null
          internet: boolean | null
          latitude: number | null
          listing_url: string | null
          longitude: number | null
          monthly_rent: number
          notes: string | null
          parking: boolean | null
          agent_fee: number
          pet_friendly: boolean | null
          position: number
          property_type: string | null
          security_deposit: number
          stage: Database["public"]["Enums"]["property_stage"]
          title: string
          updated_at: string
          user_id: string
          utilities_estimate: number
          viewing_at: string | null
        }
        Insert: {
          address?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["property_decision"]
          description?: string | null
          facilities?: string[]
          furnished?: string | null
          id?: string
          image_url?: string | null
          internet?: boolean | null
          latitude?: number | null
          listing_url?: string | null
          longitude?: number | null
          monthly_rent?: number
          notes?: string | null
          parking?: boolean | null
          agent_fee?: number
          pet_friendly?: boolean | null
          position?: number
          property_type?: string | null
          security_deposit?: number
          stage?: Database["public"]["Enums"]["property_stage"]
          title: string
          updated_at?: string
          user_id: string
          utilities_estimate?: number
          viewing_at?: string | null
        }
        Update: {
          address?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["property_decision"]
          description?: string | null
          facilities?: string[]
          furnished?: string | null
          id?: string
          image_url?: string | null
          internet?: boolean | null
          latitude?: number | null
          listing_url?: string | null
          longitude?: number | null
          monthly_rent?: number
          notes?: string | null
          parking?: boolean | null
          agent_fee?: number
          pet_friendly?: boolean | null
          position?: number
          property_type?: string | null
          security_deposit?: number
          stage?: Database["public"]["Enums"]["property_stage"]
          title?: string
          updated_at?: string
          user_id?: string
          utilities_estimate?: number
          viewing_at?: string | null
        }
        Relationships: []
      }
      property_photos: {
        Row: {
          caption: string | null
          created_at: string
          height: number | null
          id: string
          is_cover: boolean
          position: number
          property_id: string
          storage_path: string
          user_id: string
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_cover?: boolean
          position?: number
          property_id: string
          storage_path: string
          user_id: string
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_cover?: boolean
          position?: number
          property_id?: string
          storage_path?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      property_decision: "none" | "accepted" | "rejected"
      property_stage:
        | "interested"
        | "contacted"
        | "viewing_scheduled"
        | "deciding"
        | "archived"
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
      property_decision: ["none", "accepted", "rejected"],
      property_stage: [
        "interested",
        "contacted",
        "viewing_scheduled",
        "deciding",
        "archived",
      ],
    },
  },
} as const
