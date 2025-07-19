/*
  # Improve Match Statistics System

  1. New Tables
    - `match_player_stats_temp` - Temporary stats for match submissions
      - `id` (uuid, primary key)
      - `submission_id` (uuid, foreign key to match_result_submissions)
      - `user_id` (uuid, foreign key to users)
      - `team_id` (uuid, foreign key to teams)
      - `username` (text)
      - `position` (text)
      - `goals` (integer, default 0)
      - `assists` (integer, default 0)
      - `clean_sheet` (boolean, default false)
      - `created_at` (timestamp)

  2. Table Updates
    - Add `penalties_won` column to match_result_submissions
    - Add `penalty_score` column to match_result_submissions
    - Add `confirmed_by_opponent` column to match_result_submissions

  3. Security
    - Enable RLS on new table
    - Add policies for reading and writing stats
*/

-- Create temporary match player stats table
CREATE TABLE IF NOT EXISTS match_player_stats_temp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES match_result_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  username text NOT NULL,
  position text NOT NULL,
  goals integer DEFAULT 0,
  assists integer DEFAULT 0,
  clean_sheet boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add new columns to match_result_submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_result_submissions' AND column_name = 'penalties_won'
  ) THEN
    ALTER TABLE match_result_submissions ADD COLUMN penalties_won boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_result_submissions' AND column_name = 'penalty_score'
  ) THEN
    ALTER TABLE match_result_submissions ADD COLUMN penalty_score text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_result_submissions' AND column_name = 'confirmed_by_opponent'
  ) THEN
    ALTER TABLE match_result_submissions ADD COLUMN confirmed_by_opponent boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_result_submissions' AND column_name = 'screenshot2_url'
  ) THEN
    ALTER TABLE match_result_submissions ADD COLUMN screenshot2_url text;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE match_player_stats_temp ENABLE ROW LEVEL SECURITY;

-- Policies for match_player_stats_temp
CREATE POLICY "Anyone can view temp match stats"
  ON match_player_stats_temp
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Team captains can manage temp match stats"
  ON match_player_stats_temp
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = match_player_stats_temp.team_id
      AND teams.captain_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_player_stats_temp_submission_id 
  ON match_player_stats_temp(submission_id);
CREATE INDEX IF NOT EXISTS idx_match_player_stats_temp_user_id 
  ON match_player_stats_temp(user_id);
CREATE INDEX IF NOT EXISTS idx_match_player_stats_temp_team_id 
  ON match_player_stats_temp(team_id);