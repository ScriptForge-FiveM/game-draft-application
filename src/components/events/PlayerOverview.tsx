import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Users, Target, Shield, Crown, Star, Eye, Filter, X } from 'lucide-react'
import { PlayerStatsModal } from './PlayerStatsModal'

interface Registration {
  id: string
  user_id: string
  username: string
  preferred_position: string
  specific_position?: string
  platform: string
  status: 'pending' | 'approved' | 'drafted'
  wants_captain: boolean
  game_name?: string
  real_team?: string
}

interface GamePosition {
  id: string
  position_code: string
  position_name: string
  position_type: 'general' | 'specific'
}

interface PlayerOverviewProps {
  eventId: string
}

export function PlayerOverview({ eventId }: PlayerOverviewProps) {
  const [players, setPlayers] = useState<Registration[]>([])
  const [gamePositions, setGamePositions] = useState<GamePosition[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string, name: string } | null>(null)
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [showCaptainsOnly, setShowCaptainsOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlayersAndPositions()
  }, [eventId])

const fetchPlayersAndPositions = async () => {
  try {
    // Fetch all approved players for the event
    const { data: playersData, error: playersError } = await supabase
      .from('registrations')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('username')

    if (playersError) throw playersError

    // Fetch drafted player user_ids from team_members
    const { data: draftedMembers, error: draftedError } = await supabase
      .from('team_members')
      .select('user_id')

    if (draftedError) throw draftedError

    const draftedIds = new Set(draftedMembers?.map(m => m.user_id))

    // Exclude drafted players
    const undraftedPlayers = (playersData || []).filter(p => !draftedIds.has(p.user_id))

    // Fetch game positions
    const { data: positionsData, error: positionsError } = await supabase
      .from('game_positions')
      .select('*')
      .eq('game_name', 'EA FC')
      .eq('is_active', true)
      .order('display_order')

    if (positionsError) throw positionsError

    setPlayers(undraftedPlayers)
    setGamePositions(positionsData || [])
  } catch (error) {
    console.error('Error fetching players and positions:', error)
  } finally {
    setLoading(false)
  }
}


  const getPositionName = (positionCode: string, isSpecific: boolean = false) => {
    const position = gamePositions.find(pos => 
      pos.position_code === positionCode && 
      pos.position_type === (isSpecific ? 'specific' : 'general')
    )
    return position?.position_name || positionCode
  }

  // Get unique positions actually chosen by players
  const getAvailablePositions = () => {
    const positionCounts = new Map<string, number>()
    
    players.forEach(player => {
      const count = positionCounts.get(player.preferred_position) || 0
      positionCounts.set(player.preferred_position, count + 1)
    })

    return Array.from(positionCounts.entries())
      .map(([code, count]) => ({
        code,
        name: getPositionName(code),
        count
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // Get unique platforms actually chosen by players
  const getAvailablePlatforms = () => {
    const platformCounts = new Map<string, number>()
    
    players.forEach(player => {
      const count = platformCounts.get(player.platform) || 0
      platformCounts.set(player.platform, count + 1)
    })

    return Array.from(platformCounts.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => a.platform.localeCompare(b.platform))
  }

  const getFilteredPlayers = () => {
    let filtered = players

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      
      filtered = filtered.filter(player =>
        // Nome utente
        player.username.toLowerCase().includes(searchLower) ||
        // Nome in gioco
        (player.game_name && player.game_name.toLowerCase().includes(searchLower)) ||
        // Team reale
        (player.real_team && player.real_team.toLowerCase().includes(searchLower)) ||
        // Posizione generale
        getPositionName(player.preferred_position).toLowerCase().includes(searchLower) ||
        // Posizione specifica
        (player.specific_position && getPositionName(player.specific_position, true).toLowerCase().includes(searchLower)) ||
        // Piattaforma
        player.platform.toLowerCase().includes(searchLower) ||
        // Codice posizione
        player.preferred_position.toLowerCase().includes(searchLower) ||
        (player.specific_position && player.specific_position.toLowerCase().includes(searchLower))
      )
    }

    // Position filter
    if (selectedPositions.length > 0) {
      filtered = filtered.filter(player => 
        selectedPositions.includes(player.preferred_position)
      )
    }

    // Platform filter
    if (selectedPlatforms.length > 0) {
      filtered = filtered.filter(player => 
        selectedPlatforms.includes(player.platform)
      )
    }

    // Captain filter
    if (showCaptainsOnly) {
      filtered = filtered.filter(player => player.wants_captain)
    }

    return filtered
  }

  const togglePositionFilter = (positionCode: string) => {
    setSelectedPositions(prev => 
      prev.includes(positionCode)
        ? prev.filter(p => p !== positionCode)
        : [...prev, positionCode]
    )
  }

  const togglePlatformFilter = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const clearAllFilters = () => {
    setSelectedPositions([])
    setSelectedPlatforms([])
    setShowCaptainsOnly(false)
    setSearchTerm('')
  }

  const getActiveFiltersCount = () => {
    return selectedPositions.length + selectedPlatforms.length + (showCaptainsOnly ? 1 : 0)
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

  const getPlayersByPosition = () => {
    const filteredPlayers = getFilteredPlayers()
    
    const positions = {
      'POR': { name: 'Portieri', icon: Shield, color: 'from-orange-500 to-orange-800', players: [] as Registration[] },
      'DIF': { name: 'Difensori', icon: Shield, color: 'from-yellow-500 to-yellow-800', players: [] as Registration[] },
      'CEN': { name: 'Centrocampisti', icon: Users, color: 'from-green-500 to-green-800', players: [] as Registration[] },
      'ATT': { name: 'Attaccanti', icon: Target, color: 'from-blue-500 to-blue-800', players: [] as Registration[] }
    }

    filteredPlayers.forEach(player => {
      const positionGroup = positions[player.preferred_position as keyof typeof positions]
      if (positionGroup) {
        positionGroup.players.push(player)
      }
    })

    return positions
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const playersByPosition = getPlayersByPosition()
  const availablePositions = getAvailablePositions()
  const availablePlatforms = getAvailablePlatforms()
  const filteredPlayersCount = getFilteredPlayers().length
  const activeFiltersCount = getActiveFiltersCount()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Users className="h-6 w-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Lista Giocatori</h3>
          <span className="text-sm text-gray-400">
            ({filteredPlayersCount} di {players.length})
          </span>
        </div>
        
        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
            <span>Rimuovi Filtri ({activeFiltersCount})</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="glass rounded-xl p-6 border border-white/20 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca per nome, posizione, team, piattaforma, nome in gioco..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="space-y-4">
          {/* Position Filters */}
          {availablePositions.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Filter className="h-4 w-4 text-blue-400" />
                <h4 className="font-semibold text-white">Posizioni</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {availablePositions.map(({ code, name, count }) => (
                  <button
                    key={code}
                    onClick={() => togglePositionFilter(code)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedPositions.includes(code)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {name} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Platform Filters */}
          {availablePlatforms.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Filter className="h-4 w-4 text-green-400" />
                <h4 className="font-semibold text-white">Piattaforme</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map(({ platform, count }) => (
                  <button
                    key={platform}
                    onClick={() => togglePlatformFilter(platform)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedPlatforms.includes(platform)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {platform} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Position Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(playersByPosition).map(([positionCode, positionData]) => {
          const Icon = positionData.icon
          
          return (
            <div key={positionCode} className="glass rounded-xl border border-white/20 overflow-hidden">
              <div className={`bg-gradient-to-r ${positionData.color} p-4`}>
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-3">
                    <Icon className="h-6 w-6" />
                    <h4 className="font-bold text-lg">{positionData.name}</h4>
                  </div>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                    {positionData.players.length}
                  </span>
                </div>
              </div>
              
              <div className="p-4 bg-gray-800/50">
                {positionData.players.length === 0 ? (
                  <div className="text-center py-8">
                    <Icon className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">Nessun giocatore</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {positionData.players.map((player) => (
                      <div 
                        key={player.id} 
                        className="bg-gray-700 rounded-lg p-3 border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer group"
                        onClick={() => setSelectedPlayer({ id: player.user_id, name: player.username })}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h5 className="font-semibold text-white">
                                {player.username}
                              </h5>
                              {player.wants_captain && (
                                <Crown className="h-4 w-4 text-yellow-400" title="Vuole fare il capitano" />
                              )}
                            </div>
                            
                            {/* Position */}
                            <div className="mb-2">
                              <p className="text-sm text-blue-300 font-medium">
                                {player.specific_position ? getPositionName(player.specific_position, true) : getPositionName(player.preferred_position)}
                              </p>
                            </div>
                            
                            {/* Platform */}
                            <div className="flex items-center space-x-1 mb-2">
                              <span className="text-xs text-gray-400">Piattaforma:</span>
                              <span className="text-xs text-white font-medium">{player.platform}</span>
                            </div>
                            
                            {/* Game Name */}
                            {player.game_name && (
                              <div className="flex items-center space-x-1 mb-2">
                                <span className="text-xs text-gray-400">Nome in gioco:</span>
                                <span className="text-xs text-green-300 font-medium">🎮 {player.game_name}</span>
                              </div>
                            )}
                            
                            {/* Real Team */}
                            {player.real_team && (
                              <div className="flex items-center space-x-1 mb-2">
                                <span className="text-xs text-gray-400">Team:</span>
                                <span className="text-xs text-blue-300 font-medium">⚽ {player.real_team}</span>
                              </div>
                            )}
                            
                            {/* Captain Status */}
                            {player.wants_captain && (
                              <div className="flex items-center space-x-1">
                                <span className="text-xs bg-yellow-600/20 text-yellow-300 px-2 py-1 rounded-full">
                                  👑 Disponibile come capitano
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end space-y-1">
                            <Eye className="h-4 w-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                            {player.wants_captain && (
                              <Star className="h-3 w-3 text-yellow-400" title="Vuole fare il capitano" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Stats */} 
      <div className="glass rounded-xl p-6 border border-white/20">

        

        
        {/* Most Popular Teams */}

      </div>

      {/* No Results */}
      {filteredPlayersCount === 0 && (
        <div className="text-center py-12">
          <Search className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Nessun Risultato</h3>
          <p className="text-gray-500">
            Nessun giocatore trovato con i filtri attuali
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Prova a modificare i filtri o la ricerca
          </p>
        </div>
      )}

      {/* Player Stats Modal */}
      {selectedPlayer && (
        <PlayerStatsModal
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          isOpen={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  )
}