import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Target, Trophy, Shield, Users, TrendingUp, Award, Gamepad2 } from 'lucide-react'

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

interface Registration {
  id: string
  user_id: string
  username: string
  preferred_position: string
  platform: string
  status: 'pending' | 'approved' | 'drafted'
}

interface PlayerStatsViewProps {
  eventId: string
}

export function PlayerStatsView({ eventId }: PlayerStatsViewProps) {
  const [players, setPlayers] = useState<Registration[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'attacco' | 'centrocampo' | 'difesa' | 'portieri'>('attacco')

  useEffect(() => {
    fetchPlayersAndStats()
  }, [eventId])

  const fetchPlayersAndStats = async () => {
    try {
      // Fetch approved players for this event
      const { data: playersData, error: playersError } = await supabase
        .from('registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'approved')

      if (playersError) throw playersError

      // Fetch ALL player stats (including those with 0 stats)
      const { data: statsData, error: statsError } = await supabase
        .from('player_stats')
        .select('*')

      if (statsError) throw statsError

      setPlayers(playersData || [])
      setPlayerStats(statsData || [])
      
      // Ensure all players have stats entries (create if missing)
      const playersWithoutStats = (playersData || []).filter(player => 
        !statsData?.find(stat => stat.user_id === player.user_id)
      )
      
      if (playersWithoutStats.length > 0) {
        // Create default stats for players without entries
        const defaultStats = playersWithoutStats.map(player => ({
          user_id: player.user_id,
          username: player.username,
          total_matches: 0,
          total_goals: 0,
          total_assists: 0,
          total_clean_sheets: 0,
          total_wins: 0,
          total_losses: 0,
          draft_participations: 0,
          preferred_position: player.preferred_position
        }))
        
        setPlayerStats([...(statsData || []), ...defaultStats])
      }
    } catch (error) {
      console.error('Error fetching players and stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlayerStats = (userId: string): PlayerStats | null => {
    return playerStats.find(stat => stat.user_id === userId) || null
  }

  const categorizePlayer = (position: string): 'attacco' | 'centrocampo' | 'difesa' | 'portieri' => {
    const pos = position.toLowerCase()
    
    // Portieri
    if (pos === 'por' || pos.includes('portiere')) return 'portieri'
    
    // Difensori (solo difensori puri, non esterni)
    if (pos === 'dif' || pos === 'dc' || pos === 'td' || pos === 'ts' || pos === 'lib' || 
        pos.includes('difensore') || pos.includes('terzino') || pos.includes('libero')) return 'difesa'
    
    // Attaccanti
    if (pos === 'att' || pos === 'cf' || pos === 'sp' || pos === 'pf' || 
        pos.includes('ala_') || pos.includes('attaccante') || pos.includes('centravanti') || 
        pos.includes('seconda punta') || pos.includes('punta')) return 'attacco'
    
    // Centrocampisti (include esterni destro/sinistro)
    if (pos === 'cen' || pos === 'cc' || pos === 'mdc' || pos === 'moc' || pos === 'trq' || 
        pos === 'ed' || pos === 'es' || pos.includes('centrocampista') || pos.includes('mediano') || 
        pos.includes('mezzala') || pos.includes('trequartista') || pos.includes('esterno')) return 'centrocampo'
    
    return 'centrocampo' // default
  }

  const getFilteredPlayers = () => {
    return players.filter(player => categorizePlayer(player.preferred_position) === activeTab)
  }

  const getPositionIcon = (category: string) => {
    switch (category) {
      case 'attacco': return <Target className="h-5 w-5 text-red-500" />
      case 'centrocampo': return <Users className="h-5 w-5 text-blue-500" />
      case 'difesa': return <Shield className="h-5 w-5 text-green-500" />
      case 'portieri': return <Award className="h-5 w-5 text-purple-500" />
      default: return <Gamepad2 className="h-5 w-5 text-gray-500" />
    }
  }

  const getWinRate = (wins: number, losses: number): string => {
    const total = wins + losses
    if (total === 0) return '0%'
    return `${Math.round((wins / total) * 100)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  const tabs = [
    { id: 'attacco', label: 'Attacco', icon: Target, color: 'text-red-500' },
    { id: 'centrocampo', label: 'Centrocampo', icon: Users, color: 'text-blue-500' },
    { id: 'difesa', label: 'Difesa', icon: Shield, color: 'text-green-500' },
    { id: 'portieri', label: 'Portieri', icon: Award, color: 'text-purple-500' }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <TrendingUp className="h-6 w-6 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Statistiche Giocatori</h3>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const filteredCount = players.filter(p => categorizePlayer(p.preferred_position) === tab.id).length
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? `border-purple-500 ${tab.color}`
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded-full text-xs">
                  {filteredCount}
                </span>
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {getFilteredPlayers().length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">{getPositionIcon(activeTab)}</div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">
                Nessun Giocatore in {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <p className="text-gray-500">
                Non ci sono giocatori approvati per questa posizione.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredPlayers().map((player) => {
                const stats = getPlayerStats(player.user_id)
                
                return (
                  <div key={player.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-white">{player.username}</h4>
                        <p className="text-sm text-gray-400">{player.preferred_position}</p>
                        <p className="text-xs text-gray-500">{player.platform}</p>
                      </div>
                      {getPositionIcon(activeTab)}
                    </div>
                    
                    {stats ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-gray-800 rounded p-2 text-center">
                            <p className="text-gray-400 text-xs">Partite</p>
                            <p className="font-bold text-white">{stats.total_matches}</p>
                          </div>
                          <div className="bg-gray-800 rounded p-2 text-center">
                            <p className="text-gray-400 text-xs">Draft</p>
                            <p className="font-bold text-blue-400">{stats.draft_participations}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="bg-gray-800 rounded p-2 text-center">
                            <p className="text-gray-400 text-xs">Goal</p>
                            <p className="font-bold text-green-400">{stats.total_goals}</p>
                          </div>
                          <div className="bg-gray-800 rounded p-2 text-center">
                            <p className="text-gray-400 text-xs">Assist</p>
                            <p className="font-bold text-yellow-400">{stats.total_assists}</p>
                          </div>
                          <div className="bg-gray-800 rounded p-2 text-center">
                            <p className="text-gray-400 text-xs">Clean</p>
                            <p className="font-bold text-purple-400">{stats.total_clean_sheets}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-gray-800 rounded p-2 text-center">
                            <p className="text-gray-400 text-xs">Vittorie</p>
                            <p className="font-bold text-green-400">{stats.total_wins}</p>
                          </div>
                          <div className="bg-gray-800 rounded p-2 text-center">
                            <p className="text-gray-400 text-xs">Win Rate</p>
                            <p className="font-bold text-blue-400">{getWinRate(stats.total_wins, stats.total_losses)}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Trophy className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Nessuna statistica</p>
                        <p className="text-gray-500 text-xs">Primo torneo</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}