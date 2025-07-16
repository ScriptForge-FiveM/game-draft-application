/*
  # Add clean sheet ranking and show all users

  1. Updates
    - Add clean sheet tab to rankings
    - Ensure all registered users appear in rankings even with 0 stats
    - Update ranking calculation functions

  2. Changes
    - Modified user_rankings view/table to include all users
    - Added clean sheet specific ranking
    - Updated triggers to create ranking entries for new users
*/

-- Function to ensure all users have ranking entries
CREATE OR REPLACE FUNCTION ensure_user_ranking_exists(user_uuid UUID, user_name TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_rankings (
    user_id, 
    username,
    total_drafts,
    drafts_won,
    total_matches,
    total_wins,
    total_losses,
    total_goals,
    total_assists,
    total_clean_sheets,
    captain_count,
    mvp_awards,
    top_scorer_awards,
    top_assists_awards,
    best_goalkeeper_awards,
    ranking_points,
    win_rate,
    goals_per_match,
    assists_per_match
  )
  VALUES (
    user_uuid,
    user_name,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0, 0.0, 0.0
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to create ranking entries for all existing users
CREATE OR REPLACE FUNCTION create_rankings_for_all_users()
RETURNS VOID AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Create ranking entries for all users who have profiles
  FOR user_record IN 
    SELECT DISTINCT p.id, p.username 
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM user_rankings ur WHERE ur.user_id = p.id
    )
  LOOP
    PERFORM ensure_user_ranking_exists(user_record.id, user_record.username);
  END LOOP;
  
  -- Also create for users who have registrations but no profile entry
  FOR user_record IN 
    SELECT DISTINCT r.user_id, r.username 
    FROM registrations r
    WHERE NOT EXISTS (
      SELECT 1 FROM user_rankings ur WHERE ur.user_id = r.user_id
    )
  LOOP
    PERFORM ensure_user_ranking_exists(user_record.user_id, user_record.username);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create ranking entry when user registers for first time
CREATE OR REPLACE FUNCTION create_user_ranking_on_registration()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_user_ranking_exists(NEW.user_id, NEW.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new registrations
DROP TRIGGER IF EXISTS create_ranking_on_registration ON registrations;
CREATE TRIGGER create_ranking_on_registration
  AFTER INSERT ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION create_user_ranking_on_registration();

-- Trigger to create ranking entry when profile is created
CREATE OR REPLACE FUNCTION create_user_ranking_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_user_ranking_exists(NEW.id, NEW.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new profiles
DROP TRIGGER IF EXISTS create_ranking_on_profile ON profiles;
CREATE TRIGGER create_ranking_on_profile
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_ranking_on_profile();

-- Execute function to create rankings for all existing users
SELECT create_rankings_for_all_users();

-- Add index for clean sheet ranking
CREATE INDEX IF NOT EXISTS idx_user_rankings_clean_sheets ON user_rankings (total_clean_sheets DESC);