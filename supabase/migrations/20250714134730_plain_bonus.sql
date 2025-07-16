/*
  # Delete User Function

  1. Function
    - `delete_user_completely` - Deletes a user and all related data
    
  2. Security
    - Only admins can call this function
    - Cascading deletes for all related data
*/

-- Function to delete a user completely
CREATE OR REPLACE FUNCTION delete_user_completely(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Delete user's data in order (due to foreign key constraints)
  
  -- 1. Delete player match stats
  DELETE FROM player_match_stats WHERE user_id = target_user_id;
  
  -- 2. Delete match players
  DELETE FROM match_players WHERE user_id = target_user_id;
  
  -- 3. Delete team members
  DELETE FROM team_members WHERE user_id = target_user_id;
  
  -- 4. Delete draft picks
  DELETE FROM draft_picks WHERE user_id = target_user_id;
  
  -- 5. Delete registrations
  DELETE FROM registrations WHERE user_id = target_user_id;
  
  -- 6. Delete player stats
  DELETE FROM player_stats WHERE user_id = target_user_id;
  
  -- 7. Delete user rankings
  DELETE FROM user_rankings WHERE user_id = target_user_id;
  
  -- 8. Delete user draft profiles
  DELETE FROM user_draft_profiles WHERE user_id = target_user_id;
  
  -- 9. Delete user draft awards
  DELETE FROM user_draft_awards WHERE user_id = target_user_id;
  
  -- 10. Delete draft awards
  DELETE FROM draft_awards WHERE user_id = target_user_id;
  
  -- 11. Update teams to remove captain reference
  UPDATE teams SET captain_id = NULL WHERE captain_id = target_user_id;
  
  -- 12. Update matches to remove submitted_by reference
  UPDATE matches SET submitted_by = NULL WHERE submitted_by = target_user_id;
  
  -- 13. Delete match result submissions
  DELETE FROM match_result_submissions WHERE submitted_by = target_user_id;
  
  -- 14. Delete events created by user (this will cascade delete related data)
  DELETE FROM draft_events WHERE admin_id = target_user_id;
  
  -- 15. Finally delete the profile
  DELETE FROM profiles WHERE id = target_user_id;
  
  -- Note: The auth.users record needs to be deleted separately via Supabase Admin API
END;
$$;