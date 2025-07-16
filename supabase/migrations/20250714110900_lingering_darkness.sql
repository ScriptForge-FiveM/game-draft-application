/*
  # Create tournament system tables

  1. New Tables
    - `tournament_brackets`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to draft_events)
      - `format` (text, 'elimination' or 'groups')
      - `settings` (jsonb, format-specific settings)
      - `status` (text, 'pending', 'active', 'completed')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `tournament_matches`
      - `id` (uuid, primary key)
      - `bracket_id` (uuid, foreign key to tournament_brackets)
      - `round` (integer, round number)
      - `match_number` (integer, match number in round)
      - `team1_id` (uuid, foreign key to teams)
      - `team2_id` (uuid, foreign key to teams)
      - `winner_id` (uuid, foreign key to teams)
      - `team1_score` (integer, default 0)
      - `team2_score` (integer, default 0)
      - `status` (text, 'pending', 'completed', 'cancelled')
      - `scheduled_at` (timestamp)
      - `completed_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read
    - Add policies for event admins to manage
*/

-- Create tournament_brackets table
CREATE TABLE IF NOT EXISTS tournament_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES draft_events(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('elimination', 'groups')),
  settings jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tournament_matches table
CREATE TABLE IF NOT EXISTS tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id uuid NOT NULL REFERENCES tournament_brackets(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1,
  match_number integer NOT NULL DEFAULT 1,
  team1_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  team2_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  team1_score integer DEFAULT 0,
  team2_score integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_event_id ON tournament_brackets(event_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket_id ON tournament_matches(bracket_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round ON tournament_matches(round);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);

-- Enable Row Level Security
ALTER TABLE tournament_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- Create policies for tournament_brackets
CREATE POLICY "Anyone can view tournament brackets"
  ON tournament_brackets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event admins can manage tournament brackets"
  ON tournament_brackets
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT admin_id FROM draft_events WHERE id = tournament_brackets.event_id
    )
  );

-- Create policies for tournament_matches
CREATE POLICY "Anyone can view tournament matches"
  ON tournament_matches
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Event admins can manage tournament matches"
  ON tournament_matches
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT de.admin_id 
      FROM draft_events de
      JOIN tournament_brackets tb ON tb.event_id = de.id
      WHERE tb.id = tournament_matches.bracket_id
    )
  );

-- Create trigger for updated_at on tournament_brackets
CREATE OR REPLACE FUNCTION update_tournament_brackets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tournament_brackets_updated_at
  BEFORE UPDATE ON tournament_brackets
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_brackets_updated_at();