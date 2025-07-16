/*
  # Draft Events Platform Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - matches auth.users.id
      - `username` (text, unique) - display name
      - `discord_id` (text, unique) - Discord user ID
      - `avatar_url` (text, optional) - profile picture URL
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `draft_events`
      - `id` (uuid, primary key)
      - `title` (text) - event name
      - `description` (text, optional) - event description
      - `admin_id` (uuid) - event creator/admin
      - `team_count` (integer) - number of teams
      - `max_players` (integer) - maximum registrations
      - `status` (enum) - registration, captain_selection, drafting, completed
      - `discord_server_id` (text, optional) - restrict to server
      - `game_type` (text, optional) - FIFA, NBA 2K, etc.
      - `scheduled_at` (timestamp, optional) - event time
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `registrations`
      - `id` (uuid, primary key)
      - `event_id` (uuid) - references draft_events
      - `user_id` (uuid) - references auth.users
      - `username` (text) - display name
      - `preferred_position` (text) - player role/position
      - `platform` (text) - PC, PlayStation, Xbox, etc.
      - `notes` (text, optional) - additional info
      - `status` (enum) - pending, approved, drafted
      - `created_at` (timestamp)
    
    - `teams`
      - `id` (uuid, primary key)
      - `event_id` (uuid) - references draft_events
      - `name` (text) - team name
      - `captain_id` (uuid, optional) - references auth.users
      - `color` (text) - hex color for UI
      - `created_at` (timestamp)
    
    - `team_members`
      - `id` (uuid, primary key)
      - `team_id` (uuid) - references teams
      - `user_id` (uuid) - references auth.users
      - `username` (text) - display name
      - `position` (text) - assigned role
      - `pick_order` (integer) - draft order
      - `created_at` (timestamp)
    
    - `draft_picks`
      - `id` (uuid, primary key)
      - `event_id` (uuid) - references draft_events
      - `team_id` (uuid) - references teams
      - `user_id` (uuid) - references auth.users
      - `username` (text) - display name
      - `pick_number` (integer) - overall pick number
      - `round` (integer) - draft round
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Profiles: users can read all, update own
    - Draft events: public read, admin can manage own
    - Registrations: public read for event, users can manage own
    - Teams: public read for event, admin can manage
    - Team members: public read for event, admin can manage
    - Draft picks: public read for event, admin can manage

  3. Functions and Triggers
    - Auto-create profile on user signup
    - Update timestamps on profile changes
*/

-- Create custom types
DO $$ BEGIN
  CREATE TYPE draft_event_status AS ENUM ('registration', 'captain_selection', 'drafting', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE registration_status AS ENUM ('pending', 'approved', 'drafted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  discord_id text UNIQUE,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create draft_events table
CREATE TABLE IF NOT EXISTS draft_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_count integer NOT NULL CHECK (team_count >= 2 AND team_count <= 16),
  max_players integer NOT NULL CHECK (max_players >= team_count),
  status draft_event_status DEFAULT 'registration',
  discord_server_id text,
  game_type text,
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES draft_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  preferred_position text NOT NULL,
  platform text NOT NULL,
  notes text,
  status registration_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES draft_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  captain_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, name)
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  position text NOT NULL,
  pick_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Create draft_picks table
CREATE TABLE IF NOT EXISTS draft_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES draft_events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  pick_number integer NOT NULL,
  round integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, pick_number)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create RLS policies for draft_events
CREATE POLICY "Anyone can view draft events"
  ON draft_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create draft events"
  ON draft_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admins can update own events"
  ON draft_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = admin_id);

CREATE POLICY "Admins can delete own events"
  ON draft_events FOR DELETE
  TO authenticated
  USING (auth.uid() = admin_id);

-- Create RLS policies for registrations
CREATE POLICY "Anyone can view registrations"
  ON registrations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create registrations"
  ON registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own registrations"
  ON registrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT admin_id FROM draft_events WHERE id = event_id
  ));

CREATE POLICY "Users can delete own registrations"
  ON registrations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policies for teams
CREATE POLICY "Anyone can view teams"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event admins can manage teams"
  ON teams FOR ALL
  TO authenticated
  USING (auth.uid() IN (
    SELECT admin_id FROM draft_events WHERE id = event_id
  ));

-- Create RLS policies for team_members
CREATE POLICY "Anyone can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event admins can manage team members"
  ON team_members FOR ALL
  TO authenticated
  USING (auth.uid() IN (
    SELECT admin_id FROM draft_events de
    JOIN teams t ON t.event_id = de.id
    WHERE t.id = team_id
  ));

-- Create RLS policies for draft_picks
CREATE POLICY "Anyone can view draft picks"
  ON draft_picks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event admins can manage draft picks"
  ON draft_picks FOR ALL
  TO authenticated
  USING (auth.uid() IN (
    SELECT admin_id FROM draft_events WHERE id = event_id
  ));

-- Create function to handle user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, discord_id, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_draft_events_updated_at
  BEFORE UPDATE ON draft_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_draft_events_admin_id ON draft_events(admin_id);
CREATE INDEX IF NOT EXISTS idx_draft_events_status ON draft_events(status);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_event_id ON draft_picks(event_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_pick_number ON draft_picks(pick_number);