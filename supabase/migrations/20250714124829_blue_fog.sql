/*
  # Add user draft profile system

  1. New Tables
    - `user_draft_profiles` - Store user's draft preferences for reuse
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `preferred_position` (text)
      - `specific_position` (text)
      - `platform` (text)
      - `game_name` (text)
      - `real_team` (text)
      - `wants_captain` (boolean)
      - `notes` (text)
      - `is_default` (boolean) - for default profile
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_draft_profiles` table
    - Add policies for users to manage their own profiles
*/

-- Create user draft profiles table
CREATE TABLE IF NOT EXISTS user_draft_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  preferred_position text NOT NULL,
  specific_position text,
  platform text NOT NULL,
  game_name text,
  real_team text,
  wants_captain boolean DEFAULT false,
  notes text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_draft_profiles ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view own draft profiles"
  ON user_draft_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own draft profiles"
  ON user_draft_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft profiles"
  ON user_draft_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own draft profiles"
  ON user_draft_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_user_draft_profiles_updated_at
  BEFORE UPDATE ON user_draft_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add index for performance
CREATE INDEX idx_user_draft_profiles_user_id ON user_draft_profiles(user_id);
CREATE INDEX idx_user_draft_profiles_default ON user_draft_profiles(user_id, is_default) WHERE is_default = true;