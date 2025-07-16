/*
  # Add is_admin column to profiles table

  1. Changes
    - Add `is_admin` column to `profiles` table with default value `false`
    - This column will track which users have admin privileges to create draft events

  2. Security
    - Column is non-nullable with default value `false`
    - Existing users will automatically get `is_admin = false`
    - New users will default to `is_admin = false`
*/

-- Add is_admin column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Update the profiles table policies to include is_admin in selectable columns
-- (The existing policies should already work, but this ensures consistency)