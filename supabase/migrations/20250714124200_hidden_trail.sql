/*
  # Fix Italian EA FC Positions System

  1. Updates
    - Replace positions with Italian nomenclature and correct acronyms
    - Fix position categorization (Esterni in centrocampo, not difesa)
    - Add parent_position_code for proper filtering
    
  2. Security
    - Maintain existing RLS policies
*/

-- Clear existing positions
DELETE FROM game_positions WHERE game_name = 'EA FC';

-- Insert Italian general positions
INSERT INTO game_positions (game_name, position_type, position_code, position_name, display_order, is_active) VALUES
('EA FC', 'general', 'POR', 'Portiere', 1, true),
('EA FC', 'general', 'DIF', 'Difensore', 2, true),
('EA FC', 'general', 'CEN', 'Centrocampista', 3, true),
('EA FC', 'general', 'ATT', 'Attaccante', 4, true);

-- Insert Italian specific positions with correct parent mapping
INSERT INTO game_positions (game_name, position_type, position_code, position_name, parent_position_code, display_order, is_active) VALUES
-- Portieri
('EA FC', 'specific', 'POR', 'Portiere', 'POR', 1, true),

-- Difensori
('EA FC', 'specific', 'DC', 'Difensore Centrale', 'DIF', 2, true),
('EA FC', 'specific', 'TD', 'Terzino Destro', 'DIF', 3, true),
('EA FC', 'specific', 'TS', 'Terzino Sinistro', 'DIF', 4, true),
('EA FC', 'specific', 'LIB', 'Libero', 'DIF', 5, true),

-- Centrocampisti
('EA FC', 'specific', 'MDC', 'Mediano Difensivo', 'CEN', 6, true),
('EA FC', 'specific', 'CC', 'Centrocampista Centrale', 'CEN', 7, true),
('EA FC', 'specific', 'MOC', 'Mezzala Offensiva', 'CEN', 8, true),
('EA FC', 'specific', 'TRQ', 'Trequartista', 'CEN', 9, true),
('EA FC', 'specific', 'ED', 'Esterno Destro', 'CEN', 10, true),
('EA FC', 'specific', 'ES', 'Esterno Sinistro', 'CEN', 11, true),

-- Attaccanti
('EA FC', 'specific', 'ALA_D', 'Ala Destra', 'ATT', 12, true),
('EA FC', 'specific', 'ALA_S', 'Ala Sinistra', 'ATT', 13, true),
('EA FC', 'specific', 'SP', 'Seconda Punta', 'ATT', 14, true),
('EA FC', 'specific', 'CF', 'Centravanti', 'ATT', 15, true),
('EA FC', 'specific', 'PF', 'Punta di Fascia', 'ATT', 16, true);