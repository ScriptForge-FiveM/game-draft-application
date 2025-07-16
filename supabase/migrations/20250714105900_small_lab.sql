/*
  # Allow multiple registrations for admin users

  1. Changes
    - Remove unique constraint on (event_id, user_id) 
    - Keep unique constraint on (event_id, username) to prevent duplicate usernames
    - Allow admins to register multiple times with different usernames

  2. Security
    - Maintains username uniqueness per event
    - Allows dummy player generation
    - Preserves data integrity
*/

-- Remove the unique constraint on event_id + user_id
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_event_id_user_id_key;

-- Add unique constraint on event_id + username instead (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'registrations_event_id_username_key' 
    AND table_name = 'registrations'
  ) THEN
    ALTER TABLE registrations ADD CONSTRAINT registrations_event_id_username_key UNIQUE (event_id, username);
  END IF;
END $$;