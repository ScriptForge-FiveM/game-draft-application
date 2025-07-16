/*
  # Add games table and organizer fields

  1. New Tables
    - `games`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `category` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)

  2. Changes to draft_events table
    - Add `organizer_name` (text)
    - Add `twitch_channel` (text)
    - Change `game_type` to reference games table

  3. Security
    - Enable RLS on `games` table
    - Add policies for reading games
*/

-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text DEFAULT 'Sports',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add new fields to draft_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'draft_events' AND column_name = 'organizer_name'
  ) THEN
    ALTER TABLE draft_events ADD COLUMN organizer_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'draft_events' AND column_name = 'twitch_channel'
  ) THEN
    ALTER TABLE draft_events ADD COLUMN twitch_channel text;
  END IF;
END $$;

-- Enable RLS on games table
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Add policy for reading games (public can read)
CREATE POLICY "Anyone can view games"
  ON games
  FOR SELECT
  TO public
  USING (is_active = true);

-- Add policy for admins to manage games
CREATE POLICY "Admins can manage games"
  ON games
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Insert default games
INSERT INTO games (name, category) VALUES
  ('FIFA Pro Clubs', 'Sports'),
  ('NBA 2K Pro-Am', 'Sports'),
  ('Rocket League', 'Sports'),
  ('Call of Duty', 'FPS'),
  ('Valorant', 'FPS'),
  ('League of Legends', 'MOBA'),
  ('Fortnite', 'Battle Royale'),
  ('Apex Legends', 'Battle Royale')
ON CONFLICT (name) DO NOTHING;