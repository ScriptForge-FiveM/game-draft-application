import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'your-supabase-url'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          discord_id: string
          avatar_url?: string
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          discord_id: string
          avatar_url?: string
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          discord_id?: string
          avatar_url?: string
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_draft_profiles: {
        Row: {
          id: string
          user_id: string
          preferred_position: string
          specific_position?: string
          platform: string
          game_name?: string
          real_team?: string
          wants_captain: boolean
          notes?: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          preferred_position: string
          specific_position?: string
          platform: string
          game_name?: string
          real_team?: string
          wants_captain?: boolean
          notes?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          preferred_position?: string
          specific_position?: string
          platform?: string
          game_name?: string
          real_team?: string
          wants_captain?: boolean
          notes?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      draft_events: {
        Row: {
          id: string
          title: string
          description?: string
          admin_id: string
          team_count: number
          max_players_per_team: number
          max_participants: number
          status: 'registration' | 'captain_selection' | 'drafting' | 'completed'
          tournament_format?: 'elimination' | 'groups' | null
          groups_count?: number
          discord_server_id?: string
          game_type?: string
          organizer_name?: string
          twitch_channel?: string
          scheduled_at?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          admin_id: string
          team_count: number
          max_players_per_team?: number
          max_participants: number
          status?: 'registration' | 'captain_selection' | 'drafting' | 'completed'
          tournament_format?: 'elimination' | 'groups' | null
          groups_count?: number
          discord_server_id?: string
          game_type?: string
          organizer_name?: string
          twitch_channel?: string
          scheduled_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          admin_id?: string
          team_count?: number
          max_players_per_team?: number
          max_participants?: number
          status?: 'registration' | 'captain_selection' | 'drafting' | 'completed'
          tournament_format?: 'elimination' | 'groups' | null
          groups_count?: number
          discord_server_id?: string
          game_type?: string
          organizer_name?: string
          twitch_channel?: string
          scheduled_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      games: {
        Row: {
          id: string
          name: string
          category: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          is_active?: boolean
          created_at?: string
        }
      }
      game_positions: {
        Row: {
          id: string
          game_name: string
          position_code: string
          position_name: string
          position_type: 'general' | 'specific'
          parent_position_code?: string
          display_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          game_name: string
          position_code: string
          position_name: string
          position_type: 'general' | 'specific'
          parent_position_code?: string
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          game_name?: string
          position_code?: string
          position_name?: string
          position_type?: 'general' | 'specific'
          parent_position_code?: string
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
      }
      player_stats: {
        Row: {
          id: string
          user_id: string
          username: string
          total_matches: number
          total_goals: number
          total_assists: number
          total_clean_sheets: number
          total_wins: number
          total_losses: number
          draft_participations: number
          preferred_position?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username: string
          total_matches?: number
          total_goals?: number
          total_assists?: number
          total_clean_sheets?: number
          total_wins?: number
          total_losses?: number
          draft_participations?: number
          preferred_position?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          total_matches?: number
          total_goals?: number
          total_assists?: number
          total_clean_sheets?: number
          total_wins?: number
          total_losses?: number
          draft_participations?: number
          preferred_position?: string
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          event_id: string
          team1_id: string
          team2_id: string
          team1_score: number
          team2_score: number
          winner_team_id?: string
          match_date: string
          status: 'pending' | 'completed' | 'cancelled'
          screenshot1_url?: string
          screenshot2_url?: string
          submitted_by?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          team1_id: string
          team2_id: string
          team1_score?: number
          team2_score?: number
          winner_team_id?: string
          match_date?: string
          status?: 'pending' | 'completed' | 'cancelled'
          screenshot1_url?: string
          screenshot2_url?: string
          submitted_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          team1_id?: string
          team2_id?: string
          team1_score?: number
          team2_score?: number
          winner_team_id?: string
          match_date?: string
          status?: 'pending' | 'completed' | 'cancelled'
          screenshot1_url?: string
          screenshot2_url?: string
          submitted_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      match_players: {
        Row: {
          id: string
          match_id: string
          user_id: string
          team_id: string
          username: string
          position: string
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          user_id: string
          team_id: string
          username: string
          position: string
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          user_id?: string
          team_id?: string
          username?: string
          position?: string
          created_at?: string
        }
      }
      player_match_stats: {
        Row: {
          id: string
          match_id: string
          user_id: string
          team_id: string
          username: string
          goals: number
          assists: number
          clean_sheet: boolean
          position: string
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          user_id: string
          team_id: string
          username: string
          goals?: number
          assists?: number
          clean_sheet?: boolean
          position: string
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          user_id?: string
          team_id?: string
          username?: string
          goals?: number
          assists?: number
          clean_sheet?: boolean
          position?: string
          created_at?: string
        }
      }
      custom_team_names: {
        Row: {
          id: string
          event_id: string
          team_id: string
          custom_name: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          team_id: string
          custom_name: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          team_id?: string
          custom_name?: string
          created_at?: string
        }
      }
      registrations: {
        Row: {
          id: string
          event_id: string
          user_id: string
          username: string
          preferred_position: string
          platform: string
          notes?: string
          status: 'pending' | 'approved' | 'drafted'
          created_at: string
          wants_captain: boolean
          game_name?: string
          real_team?: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          username: string
          preferred_position: string
          platform: string
          notes?: string
          status?: 'pending' | 'approved' | 'drafted'
          created_at?: string
          wants_captain?: boolean
          game_name?: string
          real_team?: string
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          username?: string
          preferred_position?: string
          platform?: string
          notes?: string
          status?: 'pending' | 'approved' | 'drafted'
          created_at?: string
          wants_captain?: boolean
          game_name?: string
          real_team?: string
        }
      }
      teams: {
        Row: {
          id: string
          event_id: string
          name: string
          captain_id?: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          captain_id?: string
          color: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          captain_id?: string
          color?: string
          created_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          username: string
          position: string
          pick_order: number
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          username: string
          position: string
          pick_order: number
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          username?: string
          position?: string
          pick_order?: number
          created_at?: string
        }
      }
      draft_picks: {
        Row: {
          id: string
          event_id: string
          team_id: string
          user_id: string
          username: string
          pick_number: number
          round: number
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          team_id: string
          user_id: string
          username: string
          pick_number: number
          round: number
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          team_id?: string
          user_id?: string
          username?: string
          pick_number?: number
          round?: number
          created_at?: string
        }
      }
    }
  }
}