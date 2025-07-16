/*
  # EA FC Positions System

  1. New Tables
    - `game_positions` - Posizioni generali e specifiche per ogni gioco
    - Aggiornamento `registrations` per posizione specifica
  
  2. Security
    - Enable RLS on new tables
    - Add policies for reading positions
    - Update registration policies
*/

-- Create game positions table
CREATE TABLE IF NOT EXISTS game_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_name text NOT NULL,
  position_type text NOT NULL CHECK (position_type IN ('general', 'specific')),
  position_code text NOT NULL,
  position_name text NOT NULL,
  parent_position_code text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE game_positions ENABLE ROW LEVEL SECURITY;

-- Create policy for reading positions
CREATE POLICY "Anyone can view game positions"
  ON game_positions
  FOR SELECT
  TO public
  USING (is_active = true);

-- Add specific position to registrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'specific_position'
  ) THEN
    ALTER TABLE registrations ADD COLUMN specific_position text;
  END IF;
END $$;

-- Insert EA FC positions
INSERT INTO game_positions (game_name, position_type, position_code, position_name, display_order) VALUES
-- General positions
('EA FC', 'general', 'GK', 'Portiere', 1),
('EA FC', 'general', 'DEF', 'Difensore', 2),
('EA FC', 'general', 'MID', 'Centrocampista', 3),
('EA FC', 'general', 'ATT', 'Attaccante', 4),

-- Specific goalkeeper positions
('EA FC', 'specific', 'GK', 'Portiere', 1),

-- Specific defender positions
('EA FC', 'specific', 'CB', 'Difensore Centrale', 2),
('EA FC', 'specific', 'LB', 'Terzino Sinistro', 3),
('EA FC', 'specific', 'RB', 'Terzino Destro', 4),
('EA FC', 'specific', 'LWB', 'Esterno Sinistro', 5),
('EA FC', 'specific', 'RWB', 'Esterno Destro', 6),

-- Specific midfielder positions
('EA FC', 'specific', 'CDM', 'Mediano', 7),
('EA FC', 'specific', 'CM', 'Centrocampista Centrale', 8),
('EA FC', 'specific', 'CAM', 'Trequartista', 9),
('EA FC', 'specific', 'LM', 'Centrocampista Sinistro', 10),
('EA FC', 'specific', 'RM', 'Centrocampista Destro', 11),

-- Specific attacker positions
('EA FC', 'specific', 'LW', 'Ala Sinistra', 12),
('EA FC', 'specific', 'RW', 'Ala Destra', 13),
('EA FC', 'specific', 'CF', 'Centravanti', 14),
('EA FC', 'specific', 'ST', 'Prima Punta', 15),
('EA FC', 'specific', 'LF', 'Attaccante Sinistro', 16),
('EA FC', 'specific', 'RF', 'Attaccante Destro', 17)

ON CONFLICT DO NOTHING;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_game_positions_game_type ON game_positions(game_name, position_type);
CREATE INDEX IF NOT EXISTS idx_game_positions_parent ON game_positions(parent_position_code);