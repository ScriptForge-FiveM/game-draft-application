import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Trophy, Crown, Zap, Users, Shuffle } from 'lucide-react'
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

interface Match {
  id: string
  team1: Team | null
  team2: Team | null
  winner: Team | null
  round: number
  matchNumber: number
}

interface EliminationBracketProps {
  eventId: string
  matches?: any[]
  teams?: Team[]
}

export function EliminationBracket({ eventId, matches: propMatches, teams: propTeams }: EliminationBracketProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [bracket, setBracket] = useState<Match[][]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (propMatches && propTeams) {
      setTeams(propTeams)
      generateBracketFromMatches(propMatches, propTeams)
      setLoading(false)
    } else {
      fetchTeamsAndGenerateBracket()
    }
  }, [eventId, propMatches, propTeams])

  const generateBracketFromMatches = (matches: any[], teamsList: Team[]) => {
    // Group matches by round
    const rounds: { [key: number]: any[] } = {}
    matches.forEach(match => {
      if (!rounds[match.round]) {
        rounds[match.round] = []
      }
      rounds[match.round].push(match)
    })

    // Convert to bracket format
    const bracketRounds: Match[][] = []
    Object.keys(rounds).sort((a, b) => parseInt(a) - parseInt(b)).forEach(roundKey => {
      const roundMatches = rounds[parseInt(roundKey)].map((match: any) => ({
        id: match.id,
        team1: match.team1 || teamsList.find(t => t.id === match.team1_id) || null,
        team2: match.team2 || teamsList.find(t => t.id === match.team2_id) || null,
        winner: match.winner || (match.winner_id ? teamsList.find(t => t.id === match.winner_id) : null) || null,
        round: match.round,
        matchNumber: match.match_number
      }))
      bracketRounds.push(roundMatches)
    })

    setBracket(bracketRounds)
  }

  const fetchTeamsAndGenerateBracket = async () => {
    try {
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
      generateBracket(teamsWithMembers)
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast.error('Errore nel caricamento delle squadre')
    } finally {
      setLoading(false)
    }
  }

  const generateBracket = (teamsList: Team[]) => {
    if (teamsList.length < 2) {
      setBracket([])
      return
    }

    // Shuffle teams
    const shuffledTeams = [...teamsList].sort(() => Math.random() - 0.5)
    
    // Calculate rounds needed
    const totalRounds = Math.ceil(Math.log2(shuffledTeams.length))
    const firstRoundTeams = Math.pow(2, totalRounds)
    
    // Create first round matches
    const firstRound: Match[] = []
    for (let i = 0; i < firstRoundTeams / 2; i++) {
      const team1 = shuffledTeams[i * 2] || null
      const team2 = shuffledTeams[i * 2 + 1] || null
      
      firstRound.push({
        id: `round-1-match-${i}`,
        team1,
        team2,
        winner: null,
        round: 1,
        matchNumber: i + 1
      })
    }

    // Create subsequent rounds
    const allRounds: Match[][] = [firstRound]
    
    for (let round = 2; round <= totalRounds; round++) {
      const previousRound = allRounds[round - 2]
      const currentRound: Match[] = []
      
      for (let i = 0; i < previousRound.length; i += 2) {
        currentRound.push({
          id: `round-${round}-match-${Math.floor(i / 2)}`,
          team1: null,
          team2: null,
          winner: null,
          round,
          matchNumber: Math.floor(i / 2) + 1
        })
      }
      
      allRounds.push(currentRound)
    }

    setBracket(allRounds)
  }

  const shuffleBracket = () => {
    generateBracket(teams)
    toast.success('Bracket rimescolato!')
  }

  const getRoundName = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Finale'
    if (round === totalRounds - 1) return 'Semifinale'
    if (round === totalRounds - 2) return 'Quarti di Finale'
    return `${round}° Turno`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (teams.length < 2) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">Squadre Insufficienti</h3>
        <p className="text-gray-500">Servono almeno 2 squadre per generare un bracket.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Zap className="h-6 w-6 text-red-400" />
          <h3 className="text-lg font-semibold text-white">Bracket Eliminazione Diretta</h3>
        </div>
        
        <button
          onClick={shuffleBracket}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Shuffle className="h-4 w-4 mr-2" />
          Rimescola
        </button>
      </div>

      {bracket.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Clicca "Rimescola" per generare il bracket</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6 overflow-x-auto">
          <div className="flex space-x-8 min-w-max">
            {bracket.map((round, roundIndex) => (
              <div key={roundIndex} className="flex flex-col space-y-4 min-w-[200px]">
                <h4 className="text-center font-bold text-white mb-4">
                  {getRoundName(roundIndex + 1, bracket.length)}
                </h4>
                
                {round.map((match, matchIndex) => (
                  <div key={match.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="text-center text-xs text-gray-400 mb-3">
                      Match {match.matchNumber}
                    </div>
                    
                    <div className="space-y-2">
                      {/* Team 1 */}
                      <div className={`p-3 rounded ${match.team1 ? 'bg-gray-600' : 'bg-gray-800'}`}>
                        {match.team1 ? (
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: match.team1.color }}
                            />
                            <span className="text-white font-medium text-sm">{match.team1.name}</span>
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 text-sm">TBD</div>
                        )}
                      </div>
                      
                      <div className="text-center text-xs text-gray-500">VS</div>
                      
                      {/* Team 2 */}
                      <div className={`p-3 rounded ${match.team2 ? 'bg-gray-600' : 'bg-gray-800'}`}>
                        {match.team2 ? (
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: match.team2.color }}
                            />
                            <span className="text-white font-medium text-sm">{match.team2.name}</span>
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 text-sm">TBD</div>
                        )}
                      </div>
                    </div>
                    
                    {match.winner && (
                      <div className="mt-3 p-2 bg-yellow-600 rounded text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Crown className="h-3 w-3 text-white" />
                          <span className="text-white text-xs font-bold">Vincitore</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-red-800/20 border border-red-600 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-red-300 mb-2">
          <Zap className="h-5 w-5" />
          <p className="font-medium">Formato: Eliminazione Diretta</p>
        </div>
        <p className="text-red-300 text-sm">
          {teams.length} squadre • {bracket.length} turni • Chi perde è eliminato
        </p>
      </div>
    </div>
  )
}