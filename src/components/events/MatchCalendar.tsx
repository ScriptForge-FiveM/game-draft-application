import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, Users, Trophy, Clock, Filter, Search, Play, CheckCircle, AlertCircle } from 'lucide-react'

interface Team {
  id: string
  name: string
  color: string
}

interface MatchCalendarItem {
  id: string
  type: 'regular' | 'tournament'
  team1?: Team
  team2?: Team
  scheduled_at?: string
  status: string
  round?: number
  match_number?: number
  team1_score?: number
  team2_score?: number
  winner_id?: string
}

interface MatchCalendarProps {
  eventId: string
}

export function MatchCalendar({ eventId }: MatchCalendarProps) {
  const [matches, setMatches] = useState<MatchCalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')

  useEffect(() => {
    fetchMatches()
  }, [eventId])

  const fetchMatches = async () => {
    if (!eventId) return
    
    try {
      // Fetch regular matches
      const { data: regularMatches } = await supabase
        .from('matches')
        .select(`
          id,
          scheduled_at,
          status,
          team1_score,
          team2_score,
          winner_team_id,
          team1:team1_id (id, name, color),
          team2:team2_id (id, name, color)
        `)
        .eq('event_id', eventId)
        .order('scheduled_at')

      // Fetch tournament matches
      const { data: tournamentMatches } = await supabase
        .from('tournament_matches')
        .select(`
          id,
          scheduled_at,
          status,
          round,
          match_number,
          team1_score,
          team2_score,
          winner_id,
          team1:team1_id (id, name, color),
          team2:team2_id (id, name, color),
          tournament_brackets!inner (event_id)
        `)
        .eq('tournament_brackets.event_id', eventId)
        .order('scheduled_at')

      const calendar: MatchCalendarItem[] = [
        ...(regularMatches || []).map(match => ({
          id: match.id,
          type: 'regular' as const,
          team1: match.team1,
          team2: match.team2,
          scheduled_at: match.scheduled_at,
          status: match.status,
          team1_score: match.team1_score,
          team2_score: match.team2_score,
          winner_id: match.winner_team_id
        })),
        ...(tournamentMatches || []).map(match => ({
          id: match.id,
          type: 'tournament' as const,
          team1: match.team1,
          team2: match.team2,
          scheduled_at: match.scheduled_at,
          status: match.status,
          round: match.round,
          match_number: match.match_number,
          team1_score: match.team1_score,
          team2_score: match.team2_score,
          winner_id: match.winner_id
        }))
      ].sort((a, b) => {
        if (!a.scheduled_at) return 1
        if (!b.scheduled_at) return -1
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      })

      setMatches(calendar)
    } catch (error) {
      console.error('Error fetching match calendar:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredMatches = () => {
    let filtered = matches

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(match => match.status === statusFilter)
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(match => 
        match.team1?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.team2?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Play className="h-4 w-4 text-blue-500" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completato'
      case 'pending':
        return 'In Attesa'
      case 'cancelled':
        return 'Annullato'
      default:
        return status
    }
  }

  const groupMatchesByDate = (matches: MatchCalendarItem[]) => {
    const groups: { [key: string]: MatchCalendarItem[] } = {}
    
    matches.forEach(match => {
      if (match.scheduled_at) {
        const date = new Date(match.scheduled_at).toLocaleDateString('it-IT', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        
        if (!groups[date]) {
          groups[date] = []
        }
        groups[date].push(match)
      }
    })
    
    return groups
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const filteredMatches = getFilteredMatches()
  const groupedMatches = groupMatchesByDate(filteredMatches)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Calendar className="h-6 w-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Calendario Match</h3>
          <span className="text-sm text-gray-400">
            ({filteredMatches.length} match)
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca squadre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          >
            <option value="all">Tutti gli Stati</option>
            <option value="pending">In Attesa</option>
            <option value="completed">Completati</option>
          </select>
        </div>
      </div>

      {Object.keys(groupedMatches).length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-300 mb-2">Nessun Match Programmato</h4>
          <p className="text-gray-500">
            {statusFilter === 'all' ? 'Non ci sono match programmati per questo evento' :
             statusFilter === 'pending' ? 'Non ci sono match in attesa' :
             'Non ci sono match completati'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedMatches).map(([date, dayMatches]) => (
            <div key={date} className="space-y-4">
              <h4 className="text-lg font-bold text-white border-b border-gray-700 pb-2">
                {date}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dayMatches.map((match) => (
                  <div key={match.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        match.type === 'tournament' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {match.type === 'tournament' ? `T-R${match.round}` : 'Regular'}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(match.status)}
                        <span className="text-xs text-gray-400">
                          {getStatusLabel(match.status)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Teams */}
                      <div className="flex items-center justify-between">
                        {match.team1 && (
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team1.color }} />
                            <span className="text-white font-medium text-sm">{match.team1.name}</span>
                          </div>
                        )}
                        
                        {match.status === 'completed' && match.team1_score !== undefined && match.team2_score !== undefined ? (
                          <div className="text-white font-bold">
                            {match.team1_score} - {match.team2_score}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">VS</span>
                        )}
                        
                        {match.team2 && (
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-medium text-sm">{match.team2.name}</span>
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team2.color }} />
                          </div>
                        )}
                      </div>
                      
                      {/* Time */}
                      {match.scheduled_at && (
                        <div className="text-center">
                          <span className="text-sm text-blue-400">
                            {new Date(match.scheduled_at).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      
                      {/* Winner indicator */}
                      {match.status === 'completed' && match.winner_id && (
                        <div className="text-center">
                          <div className="inline-flex items-center space-x-1 px-2 py-1 bg-yellow-600 rounded-full">
                            <Trophy className="h-3 w-3 text-white" />
                            <span className="text-xs text-white font-medium">
                              Vincitore: {
                                match.winner_id === match.team1?.id ? match.team1.name :
                                match.winner_id === match.team2?.id ? match.team2.name :
                                'Sconosciuto'
                              }
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}