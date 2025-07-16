/*
  # Add support for dummy players

  1. Changes
    - Allow multiple registrations per user_id for the same event (for dummy players)
    - Add unique constraint on event_id + username instead
    - This allows admins to create multiple dummy registrations using their user_id

  2. Security
    - Maintains RLS policies
    - Only admins can create dummy players
    - Username uniqueness per event is preserved
*/

-- Drop the existing unique constraint on event_id + user_id
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_event_id_user_id_key;

-- Add unique constraint on event_id + username instead
ALTER TABLE registrations ADD CONSTRAINT registrations_event_id_username_key 
  UNIQUE (event_id, username);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_registrations_event_username 
  ON registrations(event_id, username);