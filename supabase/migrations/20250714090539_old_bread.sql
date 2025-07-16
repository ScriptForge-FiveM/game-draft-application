/*
  # Add captain features and Discord profile integration

  1. New Tables
    - Update profiles table to include Discord avatar
    - Update registrations table for captain preference and game info
  
  2. Changes
    - Add avatar_url to profiles
    - Add wants_captain, game_name, real_team to registrations
    - Add captain dashboard features
*/

-- Add avatar_url to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Add new columns to registrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'wants_captain'
  ) THEN
    ALTER TABLE registrations ADD COLUMN wants_captain boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'game_name'
  ) THEN
    ALTER TABLE registrations ADD COLUMN game_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'real_team'
  ) THEN
    ALTER TABLE registrations ADD COLUMN real_team text;
  END IF;
END $$;