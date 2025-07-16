import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Trophy, Users, Play, Calendar, Settings, Target, Crown, Zap, CheckCircle, AlertCircle } from 'lucide-react'
import { EliminationBracket } from './EliminationBracket'
import { GroupsBracket } from './GroupsBracket'
import { MatchResultForm } from './MatchResultForm'
import toast from 'react-hot-toast'

interface Team {
  id: string
  name: string
  color: string
  members: Array<{
    username: string
    position: string
  }>
}

interface TournamentMatch {
  id: string
  bracket_id: string
  round: number
  match_number: number
  team1_id?: string
  team2_id?: string
  winner_id?: string
  team1_score: number
  team2_score: number
  status: 'pending' | 'completed' | 'cancelled'
  scheduled_at?: string
  completed_at?: string
  team1?: Team
  team2?: Team
  winner?: Team
}

interface TournamentBracket {
  id: string
  format: string
  status: string
  settings: any
}

interface TournamentManagerProps {
  eventId: string
  bracket: TournamentBracket
}

export function TournamentManager({ eventId, bracket }: TournamentManagerProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bracket' | 'matches' | 'results'>('bracket')

  useEffect(() => {
    fetchTournamentData()
  }, [eventId, bracket.id])

  const fetchTournamentData = async () => {
    try {
      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          *,
          team_members (
            username,
            position
          )
        `)
        .eq('event_id', eventId)
        .order('name')

      if (teamsError) throw teamsError

      const teamsWithMembers = (teamsData || []).map(team => ({
        ...team,
        members: team.team_members || []
      }))

      setTeams(teamsWithMembers)

      // Fetch tournament matches
      const { data: matchesData, error: matchesError } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          team1:team1_id (id, name, color),
          team2:team2_id (id, name, color),
          winner:winner_id (id, name, color)
        `)
        .eq('bracket_id', bracket.id)
        .order('round')
        .order('match_number')

      if (matchesError) throw matchesError

      setMatches(matchesData || [])

      // If no matches exist and bracket is pending, generate them
      if ((!matchesData || matchesData.length === 0) && bracket.status === 'pending') {
        await generateMatches(teamsWithMembers)
      }

    } catch (error) {
      console.error('Error fetching tournament data:', error)
      toast.error('Errore nel caricamento dei dati del torneo')
    } finally {
      setLoading(false)
    }
  }

  const generateMatches = async (teamsList: Team[]) => {
    try {
      if (bracket.format === 'elimination') {
        await generateEliminationMatches(teamsList)
      } else if (bracket.format === 'groups') {
        await generateGroupMatches(teamsList)
      }
    } catch (error) {
      console.error('Error generating matches:', error)
      toast.error('Errore nella generazione delle partite')
    }
  }

  const generateEliminationMatches = async (teamsList: Team[]) => {
    // Shuffle teams
    const shuffledTeams = [...teamsList].sort(() => Math.random() - 0.5)
    
    // Calculate rounds needed
    const totalRounds = Math.ceil(Math.log2(shuffledTeams.length))
    const firstRoundTeams = Math.pow(2, totalRounds)
    
    // Create first round matches
    const matchesToCreate = []
    for (let i = 0; i < firstRoundTeams / 2; i++) {
      const team1 = shuffledTeams[i * 2] || null
      const team2 = shuffledTeams[i * 2 + 1] || null
      
      if (team1 || team2) {
        matchesToCreate.push({
          bracket_id: bracket.id,
          round: 1,
          match_number: i + 1,
          team1_id: team1?.id || null,
          team2_id: team2?.id || null,
          team1_score: 0,
          team2_score: 0,
          status: 'pending' as const
        })
      }
    }

    if (matchesToCreate.length > 0) {
      const { error } = await supabase
        .from('tournament_matches')
        .insert(matchesToCreate)

      if (error) throw error

      // Update bracket status to active
      await supabase
        .from('tournament_brackets')
        .update({ status: 'active' })
        .eq('id', bracket.id)

      toast.success('Bracket eliminazione diretta generato!')
      fetchTournamentData()
    }
  }

  const generateGroupMatches = async (teamsList: Team[]) => {
    const groupsCount = bracket.settings?.groupsCount || Math.ceil(teamsList.length / 4)
    const teamsPerGroup = Math.ceil(teamsList.length / groupsCount)
    
    // Shuffle teams
    const shuffledTeams = [...teamsList].sort(() => Math.random() - 0.5)
    
    const matchesToCreate = []
    let matchNumber = 1

    // Create groups and matches
    for (let groupIndex = 0; groupIndex < groupsCount; groupIndex++) {
      const groupTeams = shuffledTeams.slice(
        groupIndex * teamsPerGroup, 
        (groupIndex + 1) * teamsPerGroup
      )

      // Generate round-robin matches for this group
      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          matchesToCreate.push({
            bracket_id: bracket.id,
            round: groupIndex + 1, // Use round to represent group
            match_number: matchNumber++,
            team1_id: groupTeams[i].id,
            team2_id: groupTeams[j].id,
            team1_score: 0,
            team2_score: 0,
            status: 'pending' as const
          })
        }
      }
    }

    if (matchesToCreate.length > 0) {
      const { error } = await supabase
        .from('tournament_matches')
        .insert(matchesToCreate)

      if (error) throw error

      // Update bracket status to active
      await supabase
        .from('tournament_brackets')
        .update({ status: 'active' })
        .eq('id', bracket.id)

      toast.success('Gironi generati!')
      fetchTournamentData()
    }
  }

  const updateMatchResult = async (matchId: string, team1Score: number, team2Score: number, winnerId?: string) => {
    try {
      const { error } = await supabase
        .from('tournament_matches')
        .update({
          team1_score: team1Score,
          team2_score: team2Score,
          winner_id: winnerId,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', matchId)

      if (error) throw error

      toast.success('Risultato partita aggiornato!')
      fetchTournamentData()
    } catch (error) {
      console.error('Error updating match result:', error)
      toast.error('Errore nell\'aggiornamento del risultato')
    }
  }

  const getMatchesByRound = () => {
    const rounds: { [key: number]: TournamentMatch[] } = {}
    matches.forEach(match => {
      if (!rounds[match.round]) {
        rounds[match.round] = []
      }
      rounds[match.round].push(match)
    })
    return rounds
  }

  const getCompletedMatches = () => {
    return matches.filter(match => match.status === 'completed')
  }

  const getPendingMatches = () => {
    return matches.filter(match => match.status === 'pending')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tournament Header */}
      <div className="glass rounded-xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              bracket.format === 'elimination' 
                ? 'bg-gradient-to-r from-red-500 to-red-600' 
                : 'bg-gradient-to-r from-blue-500 to-blue-600'
            }`}>
              {bracket.format === 'elimination' ? <Zap className="h-6 w-6 text-white" /> : <Users className="h-6 w-6 text-white" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                {bracket.format === 'elimination' ? 'Eliminazione Diretta' : 'Fase a Gironi'}
              </h3>
              <p className="text-white/70">
                {teams.length} squadre • {matches.length} partite totali
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              bracket.status === 'pending' 
                ? 'bg-yellow-600 text-white'
                : bracket.status === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 text-white'
            }`}>
              {bracket.status === 'pending' ? 'In Preparazione' : 
               bracket.status === 'active' ? 'In Corso' : 'Completato'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{getCompletedMatches().length}</p>
            <p className="text-sm text-white/70">Partite Completate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{getPendingMatches().length}</p>
            <p className="text-sm text-white/70">Partite Rimanenti</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{teams.length}</p>
            <p className="text-sm text-white/70">Squadre Partecipanti</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
        {[
          { id: 'bracket', label: 'Bracket', icon: Trophy },
          { id: 'matches', label: 'Partite', icon: Play },
          { id: 'results', label: 'Risultati', icon: Target }
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="glass rounded-xl border border-white/20 overflow-hidden">
        <div className="p-6">
          {activeTab === 'bracket' && (
            <div>
              {bracket.format === 'elimination' ? (
                <EliminationBracket eventId={eventId} matches={matches} teams={teams} />
              ) : (
                <GroupsBracket eventId={eventId} matches={matches} teams={teams} />
              )}
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-white">Gestione Partite</h4>
              
              {Object.entries(getMatchesByRound()).map(([round, roundMatches]) => (
                <div key={round} className="space-y-4">
                  <h5 className="font-medium text-white">
                    {bracket.format === 'elimination' ? `Round ${round}` : `Girone ${String.fromCharCode(64 + parseInt(round))}`}
                  </h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roundMatches.map((match) => (
                      <div key={match.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-gray-400">Match {match.match_number}</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            match.status === 'completed' 
                              ? 'bg-green-600 text-white'
                              : 'bg-yellow-600 text-white'
                          }`}>
                            {match.status === 'completed' ? 'Completata' : 'In Attesa'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {match.team1 && (
                                <>
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team1.color }} />
                                  <span className="text-white">{match.team1.name}</span>
                                </>
                              )}
                            </div>
                            <span className="text-white font-bold">{match.team1_score}</span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {match.team2 && (
                                <>
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team2.color }} />
                                  <span className="text-white">{match.team2.name}</span>
                                </>
                              )}
                            </div>
                            <span className="text-white font-bold">{match.team2_score}</span>
                          </div>
                        </div>
                        
                        {match.status === 'pending' && match.team1 && match.team2 && (
                          <button
                            onClick={() => setSelectedMatch(match.id)}
                            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                          >
                            Inserisci Risultato
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'results' && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Risultati Partite</h4>
              
              {getCompletedMatches().length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">Nessuna partita completata ancora</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getCompletedMatches().map((match) => (
                    <div key={match.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-400">Match {match.match_number}</span>
                          <div className="flex items-center space-x-2">
                            {match.team1 && (
                              <>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team1.color }} />
                                <span className="text-white">{match.team1.name}</span>
                              </>
                            )}
                            <span className="text-white font-bold mx-2">{match.team1_score} - {match.team2_score}</span>
                            {match.team2 && (
                              <>
                                <span className="text-white">{match.team2.name}</span>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team2.color }} />
                              </>
                            )}
                          </div>
                        </div>
                        
                        {match.winner && (
                          <div className="flex items-center space-x-2 text-yellow-400">
                            <Crown className="h-4 w-4" />
                            <span className="text-sm font-medium">Vincitore: {match.winner.name}</span>
                          </div>
                        )}
                      </div>
                      
                      {match.completed_at && (
                        <p className="text-xs text-gray-500 mt-2">
                          Completata il {new Date(match.completed_at).toLocaleString('it-IT')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Match Result Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <MatchResultForm
              eventId={eventId}
              matchId={selectedMatch}
              onClose={() => setSelectedMatch(null)}
              onResult={(team1Score, team2Score, winnerId) => {
                updateMatchResult(selectedMatch, team1Score, team2Score, winnerId)
                setSelectedMatch(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}