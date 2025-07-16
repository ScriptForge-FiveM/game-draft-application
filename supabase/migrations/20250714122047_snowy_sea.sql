/*
  # Match Results Management and Awards System

  1. New Tables
    - `match_result_submissions` - Submissions from captains
    - `user_rankings` - Global user rankings and stats
    - `draft_awards` - Awards for each draft event
    - `user_draft_awards` - Awards won by users

  2. Security
    - Enable RLS on all new tables
    - Add policies for captains, admins, and public viewing

  3. Functions
    - Function to calculate user rankings
    - Function to calculate draft awards
*/

-- Match result submissions table
CREATE TABLE IF NOT EXISTS match_result_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  tournament_match_id uuid,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  team1_score integer NOT NULL DEFAULT 0,
  team2_score integer NOT NULL DEFAULT 0,
  screenshot_url text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'conflicted')),
  admin_notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User rankings table
CREATE TABLE IF NOT EXISTS user_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  total_drafts integer DEFAULT 0,
  drafts_won integer DEFAULT 0,
  total_matches integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  total_losses integer DEFAULT 0,
  total_goals integer DEFAULT 0,
  total_assists integer DEFAULT 0,
  total_clean_sheets integer DEFAULT 0,
  captain_count integer DEFAULT 0,
  mvp_awards integer DEFAULT 0,
  top_scorer_awards integer DEFAULT 0,
  top_assists_awards integer DEFAULT 0,
  best_goalkeeper_awards integer DEFAULT 0,
  ranking_points integer DEFAULT 0,
  win_rate decimal(5,2) DEFAULT 0,
  goals_per_match decimal(4,2) DEFAULT 0,
  assists_per_match decimal(4,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Draft awards table
CREATE TABLE IF NOT EXISTS draft_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES draft_events(id) ON DELETE CASCADE,
  award_type text NOT NULL CHECK (award_type IN ('mvp', 'top_scorer', 'top_assists', 'best_goalkeeper', 'best_defender', 'tournament_winner')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  value integer DEFAULT 0, -- goals, assists, clean sheets, etc.
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, award_type)
);

-- User draft awards junction table
CREATE TABLE IF NOT EXISTS user_draft_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES draft_events(id) ON DELETE CASCADE,
  award_type text NOT NULL,
  award_value integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_match_result_submissions_match_id ON match_result_submissions(match_id);
CREATE INDEX IF NOT EXISTS idx_match_result_submissions_tournament_match_id ON match_result_submissions(tournament_match_id);
CREATE INDEX IF NOT EXISTS idx_match_result_submissions_submitted_by ON match_result_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_match_result_submissions_status ON match_result_submissions(status);

CREATE INDEX IF NOT EXISTS idx_user_rankings_ranking_points ON user_rankings(ranking_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_rankings_win_rate ON user_rankings(win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_user_rankings_total_goals ON user_rankings(total_goals DESC);

CREATE INDEX IF NOT EXISTS idx_draft_awards_event_id ON draft_awards(event_id);
CREATE INDEX IF NOT EXISTS idx_draft_awards_award_type ON draft_awards(award_type);
CREATE INDEX IF NOT EXISTS idx_user_draft_awards_user_id ON user_draft_awards(user_id);

-- Enable RLS
ALTER TABLE match_result_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_draft_awards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for match_result_submissions
CREATE POLICY "Anyone can view match result submissions"
  ON match_result_submissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Captains can submit match results"
  ON match_result_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid() AND
    team_id IN (
      SELECT id FROM teams WHERE captain_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage match result submissions"
  ON match_result_submissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- RLS Policies for user_rankings
CREATE POLICY "Anyone can view user rankings"
  ON user_rankings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can manage user rankings"
  ON user_rankings
  FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies for draft_awards
CREATE POLICY "Anyone can view draft awards"
  ON draft_awards
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage draft awards"
  ON draft_awards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- RLS Policies for user_draft_awards
CREATE POLICY "Anyone can view user draft awards"
  ON user_draft_awards
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can manage user draft awards"
  ON user_draft_awards
  FOR ALL
  TO authenticated
  USING (true);

-- Function to update user rankings
CREATE OR REPLACE FUNCTION update_user_rankings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update user rankings based on player_stats and other data
  INSERT INTO user_rankings (
    user_id,
    username,
    total_drafts,
    total_matches,
    total_wins,
    total_losses,
    total_goals,
    total_assists,
    total_clean_sheets,
    captain_count,
    win_rate,
    goals_per_match,
    assists_per_match,
    ranking_points
  )
  SELECT 
    ps.user_id,
    ps.username,
    ps.draft_participations,
    ps.total_matches,
    ps.total_wins,
    ps.total_losses,
    ps.total_goals,
    ps.total_assists,
    ps.total_clean_sheets,
    COALESCE(captain_stats.captain_count, 0),
    CASE 
      WHEN (ps.total_wins + ps.total_losses) > 0 
      THEN ROUND((ps.total_wins::decimal / (ps.total_wins + ps.total_losses)) * 100, 2)
      ELSE 0 
    END,
    CASE 
      WHEN ps.total_matches > 0 
      THEN ROUND(ps.total_goals::decimal / ps.total_matches, 2)
      ELSE 0 
    END,
    CASE 
      WHEN ps.total_matches > 0 
      THEN ROUND(ps.total_assists::decimal / ps.total_matches, 2)
      ELSE 0 
    END,
    -- Calculate ranking points (wins * 3 + goals + assists + clean_sheets * 2)
    (ps.total_wins * 3) + ps.total_goals + ps.total_assists + (ps.total_clean_sheets * 2)
  FROM player_stats ps
  LEFT JOIN (
    SELECT 
      captain_id as user_id,
      COUNT(*) as captain_count
    FROM teams 
    WHERE captain_id IS NOT NULL
    GROUP BY captain_id
  ) captain_stats ON ps.user_id = captain_stats.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    total_drafts = EXCLUDED.total_drafts,
    total_matches = EXCLUDED.total_matches,
    total_wins = EXCLUDED.total_wins,
    total_losses = EXCLUDED.total_losses,
    total_goals = EXCLUDED.total_goals,
    total_assists = EXCLUDED.total_assists,
    total_clean_sheets = EXCLUDED.total_clean_sheets,
    captain_count = EXCLUDED.captain_count,
    win_rate = EXCLUDED.win_rate,
    goals_per_match = EXCLUDED.goals_per_match,
    assists_per_match = EXCLUDED.assists_per_match,
    ranking_points = EXCLUDED.ranking_points,
    updated_at = now();
END;
$$;

-- Function to calculate draft awards
CREATE OR REPLACE FUNCTION calculate_draft_awards(event_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  top_scorer_record RECORD;
  top_assists_record RECORD;
  best_goalkeeper_record RECORD;
  tournament_winner_record RECORD;
BEGIN
  -- Clear existing awards for this event
  DELETE FROM draft_awards WHERE event_id = event_id_param;
  DELETE FROM user_draft_awards WHERE event_id = event_id_param;

  -- Top Scorer
  SELECT 
    pms.user_id,
    pms.username,
    SUM(pms.goals) as total_goals
  INTO top_scorer_record
  FROM player_match_stats pms
  JOIN matches m ON pms.match_id = m.id
  WHERE m.event_id = event_id_param AND m.status = 'completed'
  GROUP BY pms.user_id, pms.username
  ORDER BY total_goals DESC
  LIMIT 1;

  IF top_scorer_record.total_goals > 0 THEN
    INSERT INTO draft_awards (event_id, award_type, user_id, username, value, description)
    VALUES (
      event_id_param,
      'top_scorer',
      top_scorer_record.user_id,
      top_scorer_record.username,
      top_scorer_record.total_goals,
      format('%s goals scored', top_scorer_record.total_goals)
    );

    INSERT INTO user_draft_awards (user_id, event_id, award_type, award_value)
    VALUES (top_scorer_record.user_id, event_id_param, 'top_scorer', top_scorer_record.total_goals);
  END IF;

  -- Top Assists
  SELECT 
    pms.user_id,
    pms.username,
    SUM(pms.assists) as total_assists
  INTO top_assists_record
  FROM player_match_stats pms
  JOIN matches m ON pms.match_id = m.id
  WHERE m.event_id = event_id_param AND m.status = 'completed'
  GROUP BY pms.user_id, pms.username
  ORDER BY total_assists DESC
  LIMIT 1;

  IF top_assists_record.total_assists > 0 THEN
    INSERT INTO draft_awards (event_id, award_type, user_id, username, value, description)
    VALUES (
      event_id_param,
      'top_assists',
      top_assists_record.user_id,
      top_assists_record.username,
      top_assists_record.total_assists,
      format('%s assists provided', top_assists_record.total_assists)
    );

    INSERT INTO user_draft_awards (user_id, event_id, award_type, award_value)
    VALUES (top_assists_record.user_id, event_id_param, 'top_assists', top_assists_record.total_assists);
  END IF;

  -- Best Goalkeeper (most clean sheets)
  SELECT 
    pms.user_id,
    pms.username,
    COUNT(*) as clean_sheets
  INTO best_goalkeeper_record
  FROM player_match_stats pms
  JOIN matches m ON pms.match_id = m.id
  WHERE m.event_id = event_id_param 
    AND m.status = 'completed'
    AND pms.clean_sheet = true
    AND pms.position ILIKE '%portiere%'
  GROUP BY pms.user_id, pms.username
  ORDER BY clean_sheets DESC
  LIMIT 1;

  IF best_goalkeeper_record.clean_sheets > 0 THEN
    INSERT INTO draft_awards (event_id, award_type, user_id, username, value, description)
    VALUES (
      event_id_param,
      'best_goalkeeper',
      best_goalkeeper_record.user_id,
      best_goalkeeper_record.username,
      best_goalkeeper_record.clean_sheets,
      format('%s clean sheets', best_goalkeeper_record.clean_sheets)
    );

    INSERT INTO user_draft_awards (user_id, event_id, award_type, award_value)
    VALUES (best_goalkeeper_record.user_id, event_id_param, 'best_goalkeeper', best_goalkeeper_record.clean_sheets);
  END IF;

  -- Tournament Winner (from tournament_matches or team with most wins)
  SELECT 
    tm.user_id,
    r.username
  INTO tournament_winner_record
  FROM teams t
  JOIN team_members tm ON t.id = tm.team_id
  JOIN registrations r ON tm.user_id = r.user_id AND r.event_id = event_id_param
  WHERE t.event_id = event_id_param
    AND t.captain_id = tm.user_id -- Only captain gets the award
    AND EXISTS (
      SELECT 1 FROM tournament_matches tmatch
      JOIN tournament_brackets tb ON tmatch.bracket_id = tb.id
      WHERE tb.event_id = event_id_param 
        AND tmatch.winner_id = t.id
        AND tmatch.round = (
          SELECT MAX(round) FROM tournament_matches tm2
          JOIN tournament_brackets tb2 ON tm2.bracket_id = tb2.id
          WHERE tb2.event_id = event_id_param
        )
    )
  LIMIT 1;

  IF tournament_winner_record.user_id IS NOT NULL THEN
    INSERT INTO draft_awards (event_id, award_type, user_id, username, value, description)
    VALUES (
      event_id_param,
      'tournament_winner',
      tournament_winner_record.user_id,
      tournament_winner_record.username,
      1,
      'Tournament Champion'
    );

    INSERT INTO user_draft_awards (user_id, event_id, award_type, award_value)
    VALUES (tournament_winner_record.user_id, event_id_param, 'tournament_winner', 1);
  END IF;

  -- Update user rankings after calculating awards
  PERFORM update_user_rankings();
END;
$$;

-- Trigger to update rankings when player stats change
CREATE OR REPLACE FUNCTION trigger_update_rankings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM update_user_rankings();
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER update_rankings_on_stats_change
  AFTER INSERT OR UPDATE OR DELETE ON player_stats
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_update_rankings();

-- Update triggers for timestamps
CREATE OR REPLACE TRIGGER update_match_result_submissions_updated_at
  BEFORE UPDATE ON match_result_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER update_user_rankings_updated_at
  BEFORE UPDATE ON user_rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();