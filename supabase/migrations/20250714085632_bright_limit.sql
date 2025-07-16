/*
  # Advanced Tournament Features

  1. New Tables
    - `player_stats` - Store individual player statistics
    - `matches` - Store match information and results
    - `match_players` - Track player participation in matches
    - `player_match_stats` - Store goals, assists, clean sheets per match
    - `custom_team_names` - Allow custom team names per event

  2. Modifications
    - Update draft_events to have max_players_per_team and max_participants
    - Add custom team naming system

  3. Security
    - Enable RLS on all new tables
    - Appropriate policies for reading/writing match data
*/

-- Add new columns to draft_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'draft_events' AND column_name = 'max_players_per_team'
  ) THEN
    ALTER TABLE draft_events ADD COLUMN max_players_per_team integer DEFAULT 5;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'draft_events' AND column_name = 'max_participants'
  ) THEN
    ALTER TABLE draft_events ADD COLUMN max_participants integer;
  END IF;
END $$;

-- Update existing max_players to max_participants
UPDATE draft_events SET max_participants = max_players WHERE max_participants IS NULL;

-- Create player_stats table for overall statistics
CREATE TABLE IF NOT EXISTS player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  total_matches integer DEFAULT 0,
  total_goals integer DEFAULT 0,
  total_assists integer DEFAULT 0,
  total_clean_sheets integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  total_losses integer DEFAULT 0,
  draft_participations integer DEFAULT 0,
  preferred_position text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES draft_events(id) ON DELETE CASCADE,
  team1_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team2_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team1_score integer DEFAULT 0,
  team2_score integer DEFAULT 0,
  winner_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  match_date timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  screenshot1_url text,
  screenshot2_url text,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create match_players table to track who played in each match
CREATE TABLE IF NOT EXISTS match_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  username text NOT NULL,
  position text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- Create player_match_stats table for individual match statistics
CREATE TABLE IF NOT EXISTS player_match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  username text NOT NULL,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  clean_sheet boolean DEFAULT false,
  position text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- Create custom_team_names table for event-specific team names
CREATE TABLE IF NOT EXISTS custom_team_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES draft_events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  custom_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, team_id)
);

-- Enable Row Level Security
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_team_names ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_stats
CREATE POLICY "Anyone can view player stats"
  ON player_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own stats"
  ON player_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert/update player stats"
  ON player_stats FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies for matches
CREATE POLICY "Anyone can view matches"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event admins and team captains can manage matches"
  ON matches FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT admin_id FROM draft_events WHERE id = event_id
    ) OR
    auth.uid() IN (
      SELECT captain_id FROM teams WHERE id = team1_id OR id = team2_id
    )
  );

-- RLS Policies for match_players
CREATE POLICY "Anyone can view match players"
  ON match_players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event admins can manage match players"
  ON match_players FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT admin_id FROM draft_events de
      JOIN matches m ON m.event_id = de.id
      WHERE m.id = match_id
    )
  );

-- RLS Policies for player_match_stats
CREATE POLICY "Anyone can view player match stats"
  ON player_match_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Team captains can manage match stats"
  ON player_match_stats FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT captain_id FROM teams WHERE id = team_id
    ) OR
    auth.uid() IN (
      SELECT admin_id FROM draft_events de
      JOIN matches m ON m.event_id = de.id
      WHERE m.id = match_id
    )
  );

-- RLS Policies for custom_team_names
CREATE POLICY "Anyone can view custom team names"
  ON custom_team_names FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event admins can manage custom team names"
  ON custom_team_names FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT admin_id FROM draft_events WHERE id = event_id
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_stats_user_id ON player_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_event_id ON matches(event_id);
CREATE INDEX IF NOT EXISTS idx_matches_teams ON matches(team1_id, team2_id);
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_user_id ON match_players(user_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_match_id ON player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_user_id ON player_match_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_team_names_event_id ON custom_team_names(event_id);

-- Function to update player stats after match completion
CREATE OR REPLACE FUNCTION update_player_stats_after_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Update player stats when match is completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Update stats for all players in this match
    INSERT INTO player_stats (user_id, username, total_matches, total_goals, total_assists, total_clean_sheets, total_wins, total_losses)
    SELECT 
      pms.user_id,
      pms.username,
      1,
      pms.goals,
      pms.assists,
      CASE WHEN pms.clean_sheet THEN 1 ELSE 0 END,
      CASE WHEN pms.team_id = NEW.winner_team_id THEN 1 ELSE 0 END,
      CASE WHEN pms.team_id != NEW.winner_team_id THEN 1 ELSE 0 END
    FROM player_match_stats pms
    WHERE pms.match_id = NEW.id
    ON CONFLICT (user_id) DO UPDATE SET
      total_matches = player_stats.total_matches + EXCLUDED.total_matches,
      total_goals = player_stats.total_goals + EXCLUDED.total_goals,
      total_assists = player_stats.total_assists + EXCLUDED.total_assists,
      total_clean_sheets = player_stats.total_clean_sheets + EXCLUDED.total_clean_sheets,
      total_wins = player_stats.total_wins + EXCLUDED.total_wins,
      total_losses = player_stats.total_losses + EXCLUDED.total_losses,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updating player stats
DROP TRIGGER IF EXISTS update_player_stats_trigger ON matches;
CREATE TRIGGER update_player_stats_trigger
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_player_stats_after_match();

-- Function to automatically assign clean sheets to defenders and goalkeepers
CREATE OR REPLACE FUNCTION assign_clean_sheets()
RETURNS TRIGGER AS $$
BEGIN
  -- If the team didn't concede goals, give clean sheet to defenders and goalkeepers
  IF NEW.status = 'completed' THEN
    -- Team 1 clean sheet
    IF NEW.team1_score > NEW.team2_score OR (NEW.team1_score = NEW.team2_score AND NEW.team1_score = 0) THEN
      UPDATE player_match_stats 
      SET clean_sheet = true 
      WHERE match_id = NEW.id 
        AND team_id = NEW.team1_id 
        AND (position LIKE '%Difensore%' OR position LIKE '%Portiere%' OR position = 'POR' OR position LIKE 'D%' OR position LIKE 'T%');
    END IF;
    
    -- Team 2 clean sheet  
    IF NEW.team2_score > NEW.team1_score OR (NEW.team1_score = NEW.team2_score AND NEW.team2_score = 0) THEN
      UPDATE player_match_stats 
      SET clean_sheet = true 
      WHERE match_id = NEW.id 
        AND team_id = NEW.team2_id 
        AND (position LIKE '%Difensore%' OR position LIKE '%Portiere%' OR position = 'POR' OR position LIKE 'D%' OR position LIKE 'T%');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for clean sheet assignment
DROP TRIGGER IF EXISTS assign_clean_sheets_trigger ON matches;
CREATE TRIGGER assign_clean_sheets_trigger
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION assign_clean_sheets();

-- Function to update draft participation count
CREATE OR REPLACE FUNCTION update_draft_participation()
RETURNS TRIGGER AS $$
BEGIN
  -- Update draft participation when player is drafted
  IF NEW.status = 'drafted' AND (OLD.status IS NULL OR OLD.status != 'drafted') THEN
    INSERT INTO player_stats (user_id, username, draft_participations, preferred_position)
    VALUES (NEW.user_id, NEW.username, 1, NEW.preferred_position)
    ON CONFLICT (user_id) DO UPDATE SET
      draft_participations = player_stats.draft_participations + 1,
      preferred_position = EXCLUDED.preferred_position,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for draft participation
DROP TRIGGER IF EXISTS update_draft_participation_trigger ON registrations;
CREATE TRIGGER update_draft_participation_trigger
  AFTER UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION update_draft_participation();