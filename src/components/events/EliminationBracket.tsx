import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Trophy, Crown, Zap, Users, Shuffle, ChevronRight, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

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
  isAdmin?: boolean
}

export function EliminationBracket({ eventId, matches: propMatches, teams: propTeams, isAdmin = false }: EliminationBracketProps) {
  const { user } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [bracket, setBracket] = useState<Match[][]>([])
  const [loading, setLoading] = useState(true)
  const [shuffling, setShuffling] = useState(false)
  const [nextRoundGenerating, setNextRoundGenerating] = useState(false)

  const fetchTeamsAndGenerateBracket = useCallback(async () => {
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
  }, [eventId])

  useEffect(() => {
    if (propMatches && propTeams) {
      setTeams(propTeams)
      generateBracketFromMatches(propMatches, propTeams)
      setLoading(false)
    } else {
      fetchTeamsAndGenerateBracket()
    }
  }, [eventId, propMatches, propTeams, fetchTeamsAndGenerateBracket])

  const generateBracketFromMatches = (matches: any[], teamsList: Team[]) => {
    const rounds: { [key: number]: any[] } = {}
    matches.forEach(match => {
      if (!rounds[match.round]) {
        rounds[match.round] = []
      }
      rounds[match.round].push(match)
    })

    const bracketRounds: Match[][] = []
    Object.keys(rounds)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach(roundKey => {
        const roundNum = parseInt(roundKey)
        const roundMatches = rounds[roundNum].map((match: any) => {
          // Handle byes automatically
          const winner = 
            (match.team1_id && !match.team2_id) ? teamsList.find(t => t.id === match.team1_id) || null :
            (!match.team1_id && match.team2_id) ? teamsList.find(t => t.id === match.team2_id) || null :
            match.winner_id ? teamsList.find(t => t.id === match.winner_id) || null : null
          
          return {
            id: match.id,
            team1: match.team1 || teamsList.find(t => t.id === match.team1_id) || null,
            team2: match.team2 || teamsList.find(t => t.id === match.team2_id) || null,
            winner,
            round: roundNum,
            matchNumber: match.match_number
          }
        })
        bracketRounds.push(roundMatches)
      })

    setBracket(bracketRounds)
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
      
      // Auto-set winner for byes
      const winner = 
        (team1 && !team2) ? team1 : 
        (!team1 && team2) ? team2 : 
        null
      
      firstRound.push({
        id: `round-1-match-${i}`,
        team1,
        team2,
        winner,
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

  const shuffleBracket = async () => {
    if (!isAdmin || !user) {
      toast.error('Solo gli amministratori possono rimescolare il bracket')
      return
    }
    
    setShuffling(true)
    generateBracket(teams)
    await saveBracketToDatabase()
    setShuffling(false)
  }

  const saveBracketToDatabase = async () => {
    try {
      const { data: bracketData, error: bracketError } = await supabase
        .from('tournament_brackets')
        .select('id')
        .eq('event_id', eventId)
        .single()
      
      if (bracketError) throw bracketError
      
      if (bracketData?.id) {
        const { error: deleteError } = await supabase
          .from('tournament_matches')
          .delete()
          .eq('bracket_id', bracketData.id)
        
        if (deleteError) throw deleteError
        
        await regenerateEliminationMatches(bracketData.id)
      }
      
      toast.success('Bracket rimescolato e salvato!')
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      console.error('Error saving bracket:', error)
      toast.error('Errore nel salvataggio del bracket')
    }
  }

  const regenerateEliminationMatches = async (bracketId: string) => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('draft_events')
        .select('first_match_time')
        .eq('id', eventId)
        .single()
      
      if (eventError) throw eventError
      
      const baseTime = eventData.first_match_time ? new Date(eventData.first_match_time) : new Date()
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5)
      const totalRounds = Math.ceil(Math.log2(shuffledTeams.length))
      const firstRoundTeams = Math.pow(2, totalRounds)
      let matchesPerTimeSlot = Math.floor(shuffledTeams.length / 4) || 1
      
      const matchesToCreate = []
      let matchIndex = 0
      
      for (let i = 0; i < Math.ceil(firstRoundTeams / 2); i++) {
        const team1 = shuffledTeams[i * 2] || null
        const team2 = shuffledTeams[i * 2 + 1] || null
        
        if (team1 || team2) {
          const timeSlotIndex = Math.floor(matchIndex / matchesPerTimeSlot)
          const matchTime = new Date(baseTime.getTime() + (timeSlotIndex * 25 * 60 * 1000))
          
          matchesToCreate.push({
            bracket_id: bracketId,
            round: 1,
            match_number: i + 1,
            team1_id: team1?.id || null,
            team2_id: team2?.id || null,
            team1_score: 0,
            team2_score: 0,
            status: 'pending',
            scheduled_at: matchTime.toISOString()
          })
          matchIndex++
        }
      }
      
      if (matchesToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('tournament_matches')
          .insert(matchesToCreate)
        
        if (insertError) throw insertError
      }
    } catch (error) {
      console.error('Error regenerating elimination matches:', error)
      throw error
    }
  }

  const getRoundName = (round: number, roundMatches: Match[]) => {
    const teamsInRound = roundMatches.length * 2
    const roundNames: Record<number, string> = {
      2: 'Finale',
      4: 'Semifinale',
      8: 'Quarti di Finale',
      16: 'Ottavi di Finale',
      32: 'Sedicesimi di Finale',
      64: 'Trentaduesimi di Finale'
    }
    
    return roundNames[teamsInRound] || `Round ${round}`
  }
  
  const generateNextRoundFromWinners = async () => {
    if (bracket.length === 0) return
    
    try {
      setNextRoundGenerating(true)
      const currentRound = bracket.length - 1
      const lastRound = bracket[currentRound]
      
      // Verify current round is complete
      if (!lastRound.every(match => match.winner !== null)) {
        toast.error('Completa tutti i match di questo turno prima di procedere')
        return
      }
      
      const winners = lastRound.map(m => m.winner).filter(Boolean) as Team[]
      
      if (winners.length < 2) {
        toast.error('Servono almeno 2 vincitori per il prossimo round')
        return
      }

      const { data: bracketData, error: bracketError } = await supabase
        .from('tournament_brackets')
        .select('id')
        .eq('event_id', eventId)
        .single()

      if (bracketError) throw bracketError

      const { data: eventData, error: eventError } = await supabase
        .from('draft_events')
        .select('first_match_time')
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError

      const baseTime = eventData.first_match_time ? new Date(eventData.first_match_time) : new Date()
      const matchesPerTimeSlot = Math.max(Math.floor(winners.length / 4), 1)
      const newRoundNumber = currentRound + 2 // +1 for next round index

      const newMatches = []
      for (let i = 0; i < winners.length; i += 2) {
        const team1 = winners[i]
        const team2 = winners[i + 1] || null
        const timeSlotIndex = Math.floor(i / 2 / matchesPerTimeSlot)
        const matchTime = new Date(baseTime.getTime() + (timeSlotIndex * 25 * 60 * 1000))

        newMatches.push({
          bracket_id: bracketData.id,
          round: newRoundNumber,
          match_number: Math.floor(i / 2) + 1,
          team1_id: team1?.id || null,
          team2_id: team2?.id || null,
          team1_score: 0,
          team2_score: 0,
          status: 'pending',
          scheduled_at: matchTime.toISOString()
        })
      }

      const { error: insertError } = await supabase
        .from('tournament_matches')
        .insert(newMatches)

      if (insertError) throw insertError

      toast.success('Nuovo turno creato!')
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      console.error('Errore generazione turno successivo:', error)
      toast.error('Errore nel creare il nuovo turno')
    } finally {
      setNextRoundGenerating(false)
    }
  }

  // Check if we should show next round button
  const shouldShowNextRoundButton = () => {
    if (!isAdmin || bracket.length === 0) return false
    
    const currentRoundIndex = bracket.length - 1
    const currentRound = bracket[currentRoundIndex]
    
    // Check if current round is complete
    const currentRoundComplete = currentRound.every(match => match.winner !== null)
    if (!currentRoundComplete) return false
    
    // Check if we're not in the final round
    const totalRounds = Math.ceil(Math.log2(teams.length))
    if (currentRoundIndex + 1 >= totalRounds) return false
    
    // Check if next round already exists
    const nextRoundExists = bracket.length > currentRoundIndex + 1 && 
      bracket[currentRoundIndex + 1].length > 0
      
    return !nextRoundExists
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (teams.length < 2) {
    return (
      <div className="text-center py-12 rounded-xl bg-gray-800 border border-gray-700">
        <Trophy className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">Squadre Insufficienti</h3>
        <p className="text-gray-500 mb-4">Servono almeno 2 squadre per generare un bracket.</p>
        {isAdmin && (
          <button
            onClick={shuffleBracket}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg flex items-center mx-auto"
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Genera Bracket
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Zap className="h-6 w-6 text-red-400" />
          <h3 className="text-lg font-bold text-white">Bracket Eliminazione Diretta</h3>
          <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">
            {teams.length} squadre
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {shouldShowNextRoundButton() && (
            <button
              onClick={generateNextRoundFromWinners}
              disabled={nextRoundGenerating}
              className={`flex items-center px-4 py-2 font-medium rounded-lg transition-colors ${
                nextRoundGenerating
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {nextRoundGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creando...
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4 mr-2" />
                  Prossimo Turno
                </>
              )}
            </button>
          )}
          
          <button
            onClick={shuffleBracket}
            disabled={!isAdmin || shuffling}
            className={`flex items-center px-4 py-2 font-medium rounded-lg transition-colors ${
              isAdmin && !shuffling
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {shuffling ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Rimescolando...
              </>
            ) : (
              <>
                <Shuffle className="h-4 w-4 mr-2" />
                {isAdmin ? 'Rimescola' : 'Solo Admin'}
              </>
            )}
          </button>
        </div>
      </div>

      {bracket.length === 0 ? (
        <div className="text-center py-8 rounded-xl bg-gray-800 border border-gray-700">
          <Trophy className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Clicca "Rimescola" per generare il bracket</p>
          <button
            onClick={shuffleBracket}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg flex items-center mx-auto"
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Genera Bracket
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 overflow-x-auto">
          <div className="flex space-x-6 min-w-max">
            {bracket.map((round, roundIndex) => (
              <div key={roundIndex} className="flex flex-col">
                <div className="sticky top-0 z-10 bg-gray-800 py-3 mb-3 border-b border-gray-700">
                  <h4 className="text-center font-bold text-white">
                    {getRoundName(roundIndex + 1, round)}
                  </h4>
                  <p className="text-center text-xs text-gray-400 mt-1">
                    {round.length} match
                  </p>
                </div>
                
                <div className="flex flex-col space-y-4">
                  {round.map((match) => (
                    <motion.div 
                      key={match.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-gray-700 rounded-lg p-4 border border-gray-600 min-w-[240px]"
                    >
                      <div className="text-center text-xs text-gray-400 mb-3">
                        Match {match.matchNumber}
                      </div>
                      
                      <div className="space-y-3">
                        {/* Team 1 */}
                        <div className={`p-3 rounded-lg flex items-center justify-between ${
                          match.team1 
                            ? match.winner?.id === match.team1.id
                              ? 'bg-yellow-600/20 border border-yellow-500/50'
                              : 'bg-gray-600'
                            : 'bg-gray-800'
                        }`}>
                          {match.team1 ? (
                            <div className="flex items-center space-x-2 truncate">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: match.team1.color }}
                              />
                              <span className="text-white font-medium text-sm truncate">
                                {match.team1.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 italic text-sm">BYE</span>
                          )}
                          
                          {match.winner?.id === match.team1?.id && (
                            <Crown className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                          )}
                        </div>
                        
                        <div className="flex items-center justify-center my-1">
                          <div className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded">
                            VS
                          </div>
                        </div>
                        
                        {/* Team 2 */}
                        <div className={`p-3 rounded-lg flex items-center justify-between ${
                          match.team2 
                            ? match.winner?.id === match.team2.id
                              ? 'bg-yellow-600/20 border border-yellow-500/50'
                              : 'bg-gray-600'
                            : 'bg-gray-800'
                        }`}>
                          {match.team2 ? (
                            <div className="flex items-center space-x-2 truncate">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: match.team2.color }}
                              />
                              <span className="text-white font-medium text-sm truncate">
                                {match.team2.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 italic text-sm">BYE</span>
                          )}
                          
                          {match.winner?.id === match.team2?.id && (
                            <Crown className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      
                      {!match.team1 && !match.team2 && (
                        <div className="mt-3 text-center text-xs text-gray-500 italic">
                          Match vuoto
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-red-800/20 border border-red-600 rounded-lg p-4 flex items-start">
        <AlertCircle className="h-5 w-5 text-red-300 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <p className="font-medium text-red-300 mb-1">Formato: Eliminazione Diretta</p>
          <p className="text-red-300 text-sm">
            • {teams.length} squadre • {bracket.length} turni totali<br />
            • Chi perde è eliminato • Le squadre senza avversario (BYE) passano automaticamente
          </p>
        </div>
      </div>
    </div>
  )
}