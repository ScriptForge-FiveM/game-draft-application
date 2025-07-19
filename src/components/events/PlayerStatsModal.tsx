import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Trophy, Target, Users, Shield, TrendingUp, Award } from 'lucide-react'

interface PlayerStats {
  id: string
  user_id: string
  username: string
  total_matches: number
  total_goals: number
  total_assists: number
  total_clean_sheets: number
  total_wins: number
  total_losses: number
  draft_participations: number
  preferred_position?: string
}

interface PlayerRegistration {
  id: string
  username: string
  preferred_position: string
  specific_position?: string
  platform: string
  game_name?: string
  real_team?: string
  wants_captain: boolean
  notes?: string
  created_at: string
}

interface PlayerStatsModalProps {
  playerId: string
  playerName: string
  isOpen: boolean
  onClose: () => void
}

export function PlayerStatsModal({ playerId, playerName, isOpen, onClose }: PlayerStatsModalProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [registration, setRegistration] = useState<PlayerRegistration | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && playerId) {
      fetchPlayerStats()
      fetchPlayerRegistration()
    }
  }, [isOpen, playerId])

  const fetchPlayerStats = async () => {
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('user_id', playerId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setStats(data || null)
    } catch (error) {
      console.error('Error fetching player stats:', error)
    }
  }

  const fetchPlayerRegistration = async () => {
    try {
      setLoading(true)
      // Get the most recent registration for this player
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('user_id', playerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setRegistration(data || null)
    } catch (error) {
      console.error('Error fetching player registration:', error)
    } finally {
      setLoading(false)
    }
  }

  const getWinRate = () => {
    if (!stats || (stats.total_wins + stats.total_losses) === 0) return '0%'
    const total = stats.total_wins + stats.total_losses
    return `${Math.round((stats.total_wins / total) * 100)}%`
  }

  const getGoalsPerMatch = () => {
    if (!stats || stats.total_matches === 0) return '0.0'
    return (stats.total_goals / stats.total_matches).toFixed(1)
  }

  const getAssistsPerMatch = () => {
    if (!stats || stats.total_matches === 0) return '0.0'
    return (stats.total_assists / stats.total_matches).toFixed(1)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Trophy className="h-6 w-6 text-yellow-400" />
            <h3 className="text-xl font-bold text-white">Statistiche Giocatore</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <h4 className="text-2xl font-bold text-white mb-2">{playerName}</h4>
            {registration?.preferred_position && (
              <p className="text-blue-400 font-medium">{registration.preferred_position}</p>
            )}
            {registration?.specific_position && (
              <p className="text-gray-400 text-sm">{registration.specific_position}</p>
            )}
          </div>

          {/* Player Information */}
          {registration && (
            <div className="mb-6 bg-gray-700 rounded-lg p-4">
              <h5 className="font-semibold text-white mb-3 flex items-center">
                <Users className="h-5 w-5 mr-2 text-blue-400" />
                Informazioni Giocatore
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-600 rounded">
                    <span className="text-gray-300">Piattaforma</span>
                    <span className="font-bold text-white">{registration.platform}</span>
                  </div>
                  
                  {registration.game_name && (
                    <div className="flex items-center justify-between p-3 bg-gray-600 rounded">
                      <span className="text-gray-300">Nome in Gioco</span>
                      <span className="font-bold text-green-400">{registration.game_name}</span>
                    </div>
                  )}
                  
                  {registration.real_team && (
                    <div className="flex items-center justify-between p-3 bg-gray-600 rounded">
                      <span className="text-gray-300">Team Reale</span>
                      <span className="font-bold text-blue-400">{registration.real_team}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-600 rounded">
                    <span className="text-gray-300">Vuole Capitano</span>
                    <span className={`font-bold ${registration.wants_captain ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {registration.wants_captain ? 'Sì' : 'No'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-600 rounded">
                    <span className="text-gray-300">Registrato il</span>
                    <span className="font-bold text-white text-sm">
                      {new Date(registration.created_at).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  
                  {registration.notes && (
                    <div className="p-3 bg-gray-600 rounded">
                      <span className="text-gray-300 text-sm">Note:</span>
                      <p className="text-white mt-1 text-sm">{registration.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Users className="h-5 w-5 text-blue-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.total_matches}</p>
                  <p className="text-sm text-gray-400">Partite</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Trophy className="h-5 w-5 text-green-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.total_wins}</p>
                  <p className="text-sm text-gray-400">Vittorie</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Target className="h-5 w-5 text-red-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.total_goals}</p>
                  <p className="text-sm text-gray-400">Goal</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Users className="h-5 w-5 text-yellow-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.total_assists}</p>
                  <p className="text-sm text-gray-400">Assist</p>
                </div>
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h5 className="font-semibold text-white flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2 text-blue-400" />
                    Performance
                  </h5>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                      <span className="text-gray-300">Win Rate</span>
                      <span className="font-bold text-green-400">{getWinRate()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                      <span className="text-gray-300">Goal per Partita</span>
                      <span className="font-bold text-red-400">{getGoalsPerMatch()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                      <span className="text-gray-300">Assist per Partita</span>
                      <span className="font-bold text-yellow-400">{getAssistsPerMatch()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="font-semibold text-white flex items-center">
                    <Award className="h-5 w-5 mr-2 text-purple-400" />
                    Carriera
                  </h5>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                      <span className="text-gray-300">Draft Partecipati</span>
                      <span className="font-bold text-purple-400">{stats.draft_participations}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                      <span className="text-gray-300">Clean Sheets</span>
                      <span className="font-bold text-blue-400">{stats.total_clean_sheets}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                      <span className="text-gray-300">Sconfitte</span>
                      <span className="font-bold text-red-400">{stats.total_losses}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Goals + Assists */}
              <div className="bg-gradient-to-r from-red-900/20 to-yellow-900/20 border border-red-600/30 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-8">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-400">{stats.total_goals}</p>
                    <p className="text-sm text-gray-400">Goal Totali</p>
                  </div>
                  <div className="text-4xl text-gray-600">+</div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-yellow-400">{stats.total_assists}</p>
                    <p className="text-sm text-gray-400">Assist Totali</p>
                  </div>
                  <div className="text-4xl text-gray-600">=</div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-400">{stats.total_goals + stats.total_assists}</p>
                    <p className="text-sm text-gray-400">Contributi</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h4 className="text-xl font-semibold text-gray-300 mb-2">Nessuna Statistica</h4>
              <p className="text-gray-500">
                Questo giocatore non ha ancora statistiche registrate.
              </p>
              {registration && (
                <p className="text-blue-400 text-sm mt-2">
                  Ma puoi vedere le sue informazioni di registrazione qui sopra!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}