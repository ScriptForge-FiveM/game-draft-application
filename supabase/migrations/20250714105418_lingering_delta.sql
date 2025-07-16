/*
  # Fix registrations RLS policies for dummy players

  1. Security Updates
    - Update RLS policies to allow admin insertions
    - Add policy for system-generated dummy players
    - Maintain security for regular users

  2. Changes
    - Allow admins to insert registrations for any user
    - Add special handling for dummy players
    - Keep existing user restrictions intact
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create registrations" ON registrations;
DROP POLICY IF EXISTS "Users can update own registrations" ON registrations;
DROP POLICY IF EXISTS "Users can delete own registrations" ON registrations;

-- Recreate policies with admin support
CREATE POLICY "Users can create own registrations"
  ON registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can create any registrations"
  ON registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Users can update own registrations or admins can update any"
  ON registrations
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = user_id) OR 
    (auth.uid() IN (
      SELECT draft_events.admin_id
      FROM draft_events
      WHERE draft_events.id = registrations.event_id
    )) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    ))
  );

CREATE POLICY "Users can delete own registrations or admins can delete any"
  ON registrations
  FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = user_id) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    ))
  );