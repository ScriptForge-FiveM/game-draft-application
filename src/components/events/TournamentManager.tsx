import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Trophy, Users, Play, Calendar, Settings, Target, Crown, Zap, CheckCircle, AlertCircle } from 'lucide-react'
import { EliminationBracket } from './EliminationBracket'
import { GroupsBracket } from './GroupsBracket'
import { MatchResultForm } from './MatchResultForm'
import { TeamNameEditor } from './TeamNameEditor'
import { finalizeTournamentAndDistributeRewards } from '../../utils/rewardDistribution'
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
  const { user, profile, isAdminViewActive } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bracket' | 'matches' | 'results'>('bracket')
  const [finalizingTournament, setFinalizingTournament] = useState(false)

  // Check if user is admin for this event
  const isEventAdmin = profile?.is_admin && isAdminViewActive
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

      // Fetch event details for first match time
      const { data: eventData, error: eventError } = await supabase
        .from('draft_events')
        .select('first_match_time')
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError

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

      if (matchesError) {
        // Se non ci sono match, non è un errore
        if (matchesError.code === 'PGRST116') {
          console.log('ℹ️ No matches found for bracket')
          setMatches([])
        } else {
          throw matchesError
        }
      } else {
        setMatches(matchesData || [])
      }

      // Check if all matches are completed and update bracket status
      if (matchesData && matchesData.length > 0 && bracket.status === 'active') {
        const allMatchesCompleted = matchesData.every(match => match.status === 'completed')
        if (allMatchesCompleted) {
          console.log('🏆 All matches completed for this bracket. Updating bracket status to completed.')
          const { error: updateBracketError } = await supabase
            .from('tournament_brackets')
            .update({ status: 'completed' })
            .eq('id', bracket.id)

          if (updateBracketError) {
            console.error('❌ Error updating tournament bracket status:', updateBracketError)
            toast.error('Errore nell\'aggiornamento dello stato del bracket')
          } else {
            console.log('✅ Tournament bracket status updated to completed')
            toast.success('Torneo completato! Avvio finalizzazione e distribuzione premi...')
            
            // Chiamata alla funzione di finalizzazione automatica
            setFinalizingTournament(true)
            try {
              await finalizeTournamentAndDistributeRewards(eventId, profile, teamsWithMembers)
              toast.success('Finalizzazione e distribuzione premi completate!')
            } catch (distributeError) {
              console.error('❌ Error during reward distribution:', distributeError)
              toast.error('Errore durante la distribuzione dei premi.')
            } finally {
              setFinalizingTournament(false)
            }
          }
        }
      }

      // Se non ci sono match e il bracket è pending, generali
      if ((!matchesData || matchesData.length === 0) && bracket.status === 'pending') {
        await generateMatches(teamsWithMembers, eventData.first_match_time)
      }

    } catch (error) {
      console.error('Error fetching tournament data:', error)
      toast.error('Errore nel caricamento dei dati del torneo')
    } finally {
      setLoading(false)
    }
  }

  const generateMatches = async (teamsList: Team[], firstMatchTime?: string) => {
    try {
      if (bracket.format === 'elimination') {
        await generateEliminationMatches(teamsList, firstMatchTime)
      } else if (bracket.format === 'groups') {
        await generateGroupMatches(teamsList, firstMatchTime)
      }
    } catch (error) {
      console.error('Error generating matches:', error)
      toast.error('Errore nella generazione delle partite')
    }
  }

  const generateEliminationMatches = async (teamsList: Team[], firstMatchTime?: string) => {
    console.log('🎯 Generating elimination matches for', teamsList.length, 'teams')
    
    // Shuffle teams
    const shuffledTeams = [...teamsList].sort(() => Math.random() - 0.5)
    
    // Calculate rounds needed
    const totalRounds = Math.ceil(Math.log2(shuffledTeams.length))
    const firstRoundTeams = Math.pow(2, totalRounds)
    
    // Create first round matches
    const matchesToCreate = []
    let matchIndex = 0
    const baseTime = firstMatchTime ? new Date(firstMatchTime) : new Date()
    
    // Teniamo traccia di quali squadre stanno giocando in ogni slot orario
    let teamSchedule = {}
    
    console.log('⏰ Base time for matches:', baseTime)
    
    // Calcola quante partite possono essere giocate contemporaneamente (2 squadre per partita)
    let matchesPerTimeSlot = Math.floor(shuffledTeams.length / 4)
    matchesPerTimeSlot = matchesPerTimeSlot > 0 ? matchesPerTimeSlot : 1
    
    console.log('🕒 Partite per slot orario:', matchesPerTimeSlot)
    
    // Prepara tutte le partite
    const allMatches = []
    for (let i = 0; i < Math.ceil(firstRoundTeams / 2); i++) {
      const team1 = shuffledTeams[i * 2] || null
      const team2 = shuffledTeams[i * 2 + 1] || null
      
      if (team1 || team2) {
        allMatches.push({
          team1,
          team2,
          round: 1,
          match_number: i + 1
        })
      }
    }
    
    // Pianifica le partite evitando conflitti
    let currentTimeSlotIndex = 0
    
    while (allMatches.length > 0) {
      // Inizia un nuovo slot orario
      const teamsInCurrentSlot = new Set()
      const matchesInThisSlot = []
      
      // Cerca partite che possono essere giocate in questo slot
      for (let i = 0; i < allMatches.length; i++) {
        const match = allMatches[i]
        
        // Verifica se entrambe le squadre sono disponibili in questo slot
        const team1Id = match.team1?.id
        const team2Id = match.team2?.id
        
        if ((!team1Id || !teamsInCurrentSlot.has(team1Id)) && 
            (!team2Id || !teamsInCurrentSlot.has(team2Id))) {
          // Aggiungi le squadre a quelle occupate in questo slot
          if (team1Id) teamsInCurrentSlot.add(team1Id)
          if (team2Id) teamsInCurrentSlot.add(team2Id)
          
          // Aggiungi la partita a quelle di questo slot
          matchesInThisSlot.push(match)
          
          // Rimuovi la partita dalla lista delle partite da pianificare
          allMatches.splice(i, 1)
          i--
          
          // Se abbiamo raggiunto il massimo di partite per slot, interrompi
          if (matchesInThisSlot.length >= matchesPerTimeSlot) {
            break
          }
        }
      }
      
      // Crea le partite per questo slot orario
      const matchTime = new Date(baseTime.getTime() + (currentTimeSlotIndex * 25 * 60 * 1000))
      
      for (const match of matchesInThisSlot) {
        matchesToCreate.push({
          bracket_id: bracket.id,
          round: match.round,
          match_number: match.match_number,
          team1_id: match.team1?.id || null,
          team2_id: match.team2?.id || null,
          team1_score: 0,
          team2_score: 0,
          status: 'pending' as const,
          scheduled_at: matchTime.toISOString()
        })
      }
      
      // Passa al prossimo slot orario
      currentTimeSlotIndex++
    }

    console.log('📝 Creating', matchesToCreate.length, 'elimination matches')

    if (matchesToCreate.length > 0) {
      const { error } = await supabase
        .from('tournament_matches')
        .insert(matchesToCreate)

      if (error) throw error
      
      console.log('✅ Elimination matches created successfully')

      // Update bracket status to active
      await supabase
        .from('tournament_brackets')
        .update({ status: 'active' })
        .eq('id', bracket.id)

      toast.success('Bracket eliminazione diretta generato!')
      fetchTournamentData()
    }
  }

  const generateGroupMatches = async (teamsList: Team[], firstMatchTime?: string) => {
    console.log('👥 Generating group matches for', teamsList.length, 'teams')
    
    const settings = bracket.settings || {}
    const groupsCount = settings.groupsCount || Math.ceil(teamsList.length / 4)
    const teamsPerGroup = Math.ceil(teamsList.length / groupsCount)
    
    console.log('⚙️ Groups settings:', { groupsCount, teamsPerGroup })
    
    // Shuffle teams
    const shuffledTeams = [...teamsList].sort(() => Math.random() - 0.5)
    
    const matchesToCreate = []
    let matchNumber = 1
    const baseTime = firstMatchTime ? new Date(firstMatchTime) : new Date()
    let totalMatchCount = 0
    
    // Calcola il numero totale di partite per determinare quante possono essere giocate contemporaneamente
    for (let groupIndex = 0; groupIndex < groupsCount; groupIndex++) {
      const groupTeams = shuffledTeams.slice(
        groupIndex * teamsPerGroup, 
        (groupIndex + 1) * teamsPerGroup
      )
      totalMatchCount += (groupTeams.length * (groupTeams.length - 1)) / 2
    }
    
    // Calcola quante partite possono essere giocate contemporaneamente
    let matchesPerTimeSlot = Math.floor(teams.length / 4)
    matchesPerTimeSlot = matchesPerTimeSlot > 0 ? matchesPerTimeSlot : 1
    
    console.log('🕒 Partite totali:', totalMatchCount, 'Partite per slot orario:', matchesPerTimeSlot)

    console.log('⏰ Base time for group matches:', baseTime)

    let currentTimeSlotIndex = 0
    let matchesInCurrentTimeSlot = 0
    
    // Create groups and matches
    for (let groupIndex = 0; groupIndex < groupsCount; groupIndex++) {
      const groupTeams = shuffledTeams.slice(
        groupIndex * teamsPerGroup, 
        (groupIndex + 1) * teamsPerGroup
      )

      console.log(`🏟️ Group ${groupIndex + 1} teams:`, groupTeams.map(t => t.name))

      // Generate round-robin matches for this group
      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          // Aggiorna l'indice dello slot orario se necessario
          if (matchesInCurrentTimeSlot >= matchesPerTimeSlot) {
            currentTimeSlotIndex++;
            matchesInCurrentTimeSlot = 0;
          }
          
          const matchTime = new Date(baseTime.getTime() + (currentTimeSlotIndex * 25 * 60 * 1000)) // 25 minuti per slot orario
          
          matchesToCreate.push({
            bracket_id: bracket.id,
            round: groupIndex + 1, // Use round to represent group
            match_number: matchNumber++,
            team1_id: groupTeams[i].id,
            team2_id: groupTeams[j].id,
            team1_score: 0,
            team2_score: 0,
            status: 'pending' as const,
            scheduled_at: matchTime.toISOString()
          })
          
          matchesInCurrentTimeSlot++;
          matchNumber++
        }
      }
    }

    console.log('📝 Creating', matchesToCreate.length, 'group matches')

    if (matchesToCreate.length > 0) {
      const { error } = await supabase
        .from('tournament_matches')
        .insert(matchesToCreate)

      if (error) throw error
      
      console.log('✅ Group matches created successfully')

      // Update bracket status to active
      await supabase
        .from('tournament_brackets')
        .update({ status: 'active', stage: 'group_stage' })
        .eq('id', bracket.id)

      toast.success('Gironi generati!')
      fetchTournamentData()
    }
  }

  const generateKnockoutBracket = async () => {
    try {
      const settings = bracket.settings || {}
      const teamsToAdvancePerGroup = settings.teamsToAdvancePerGroup || 2
      const groupsCount = settings.groupsCount || Math.ceil(teams.length / 4)
      
      // Get qualified teams from each group
      const qualifiedTeams = []
      
      for (let groupIndex = 1; groupIndex <= groupsCount; groupIndex++) {
        const groupMatches = matches.filter(m => m.round === groupIndex && m.status === 'completed')
        const groupTeams = [...new Set([
          ...groupMatches.map(m => m.team1).filter(Boolean),
          ...groupMatches.map(m => m.team2).filter(Boolean)
        ])]
        
        // Calculate standings for this group
        const standings = groupTeams.map(team => {
          let points = 0
          let goalsFor = 0
          let goalsAgainst = 0
          let wins = 0
          
          groupMatches.forEach(match => {
            if (match.team1?.id === team.id) {
              goalsFor += match.team1_score
              goalsAgainst += match.team2_score
              if (match.team1_score > match.team2_score) {
                points += 3
                wins++
              } else if (match.team1_score === match.team2_score) {
                points += 1
              }
            } else if (match.team2?.id === team.id) {
              goalsFor += match.team2_score
              goalsAgainst += match.team1_score
              if (match.team2_score > match.team1_score) {
                points += 3
                wins++
              } else if (match.team2_score === match.team1_score) {
                points += 1
              }
            }
          })
          
          return {
            team,
            points,
            goalDifference: goalsFor - goalsAgainst,
            goalsFor,
            wins
          }
        })
        
        // Sort by points, then goal difference, then goals for
        standings.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
          return b.goalsFor - a.goalsFor
        })
        
        // Take top teams from this group
        qualifiedTeams.push(...standings.slice(0, teamsToAdvancePerGroup).map(s => s.team))
      }
      
      // Shuffle qualified teams for knockout bracket
      const shuffledQualified = [...qualifiedTeams].sort(() => Math.random() - 0.5)
      
      // Prepara tutte le partite
      const allMatches = []
      const firstKnockoutRound = groupsCount + 1
      
      // Get first match time for knockout stage
      const { data: eventData } = await supabase
        .from('draft_events')
        .select('first_match_time')
        .eq('id', eventId)
        .single()
      
      const baseTime = eventData?.first_match_time ? new Date(eventData.first_match_time) : new Date()
      // Start knockout matches after all group matches
      const knockoutStartTime = new Date(baseTime.getTime() + (matches.length * 25 * 60 * 1000))
      
      // Calcola quante partite possono essere giocate contemporaneamente
      let matchesPerTimeSlot = Math.floor(shuffledQualified.length / 4)
      matchesPerTimeSlot = matchesPerTimeSlot > 0 ? matchesPerTimeSlot : 1
      let matchNumber = 1
      
      console.log('🕒 Partite per slot orario (knockout):', matchesPerTimeSlot)
      
      // Prepara tutte le partite
      for (let i = 0; i < shuffledQualified.length; i += 2) {
        if (i + 1 < shuffledQualified.length) {
          allMatches.push({
            team1: shuffledQualified[i],
            team2: shuffledQualified[i + 1],
            round: firstKnockoutRound,
            match_number: matchNumber++
          })
        }
      }
      
      // Pianifica le partite evitando conflitti
      let currentTimeSlotIndex = 0
      const knockoutMatches = []
      
      while (allMatches.length > 0) {
        // Inizia un nuovo slot orario
        const teamsInCurrentSlot = new Set()
        const matchesInThisSlot = []
        
        // Cerca partite che possono essere giocate in questo slot
        for (let i = 0; i < allMatches.length; i++) {
          const match = allMatches[i]
          
          // Verifica se entrambe le squadre sono disponibili in questo slot
          if (!teamsInCurrentSlot.has(match.team1.id) && !teamsInCurrentSlot.has(match.team2.id)) {
            // Aggiungi le squadre a quelle occupate in questo slot
            teamsInCurrentSlot.add(match.team1.id)
            teamsInCurrentSlot.add(match.team2.id)
            
            // Aggiungi la partita a quelle di questo slot
            matchesInThisSlot.push(match)
            
            // Rimuovi la partita dalla lista delle partite da pianificare
            allMatches.splice(i, 1)
            i--
            
            // Se abbiamo raggiunto il massimo di partite per slot, interrompi
            if (matchesInThisSlot.length >= matchesPerTimeSlot) {
              break
            }
          }
        }
        
        // Crea le partite per questo slot orario
        const matchTime = new Date(knockoutStartTime.getTime() + (currentTimeSlotIndex * 25 * 60 * 1000))
        
        for (const match of matchesInThisSlot) {
          knockoutMatches.push({
            bracket_id: bracket.id,
            round: match.round,
            match_number: match.match_number,
            team1_id: match.team1.id,
            team2_id: match.team2.id,
            team1_score: 0,
            team2_score: 0,
            status: 'pending' as const,
            scheduled_at: matchTime.toISOString()
          })
        }
        
        // Passa al prossimo slot orario
        currentTimeSlotIndex++
      }
      
      if (knockoutMatches.length > 0) {
        const { error } = await supabase
          .from('tournament_matches')
          .insert(knockoutMatches)

        if (error) throw error

        // Update bracket stage to knockout
        await supabase
          .from('tournament_brackets')
          .update({ stage: 'knockout_stage' })
          .eq('id', bracket.id)

        toast.success(`Fase finale generata! ${qualifiedTeams.length} squadre qualificate.`)
        fetchTournamentData()
      }
    } catch (error) {
      console.error('Error generating knockout bracket:', error)
      toast.error('Errore nella generazione della fase finale')
    }
  }

  const canGenerateKnockout = () => {
    if (bracket.format !== 'groups' || bracket.stage !== 'group_stage') return false
    
    const settings = bracket.settings || {}
    const groupsCount = settings.groupsCount || Math.ceil(teams.length / 4)
    
    // Check if all group matches are completed
    for (let groupIndex = 1; groupIndex <= groupsCount; groupIndex++) {
      const groupMatches = matches.filter(m => m.round === groupIndex)
      const completedGroupMatches = groupMatches.filter(m => m.status === 'completed')
      
      if (groupMatches.length === 0 || completedGroupMatches.length !== groupMatches.length) {
        return false
      }
    }
    
    return true
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

  if (loading || finalizingTournament) {
    return (
      <div className="flex flex-col items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        {finalizingTournament && (
          <div className="mt-4 text-center">
            <p className="text-white font-medium">Finalizzazione torneo in corso...</p>
            <p className="text-gray-400 text-sm">Calcolo statistiche, assegnazione premi e distribuzione crediti</p>
          </div>
        )}
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
                <EliminationBracket 
                  eventId={eventId} 
                  matches={matches} 
                  teams={teams} 
                  isAdmin={isEventAdmin}
                />
              ) : (
                <GroupsBracket 
                  eventId={eventId} 
                  matches={matches} 
                  teams={teams} 
                  isAdmin={isEventAdmin}
                />
              )}
              
              {/* Team Names Management - Solo per Admin */}
              {isEventAdmin && (
                <div className="mt-8 glass rounded-xl p-6 border border-white/20">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Settings className="h-5 w-5 mr-2 text-orange-400" />
                    Gestione Nomi Squadre
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map((team) => (
                      <div key={team.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                        <div className="flex items-center space-x-3 mb-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <TeamNameEditor
                            teamId={team.id}
                            currentName={team.name}
                            onNameUpdated={(newName) => {
                              setTeams(prev => prev.map(t => 
                                t.id === team.id ? { ...t, name: newName } : t
                              ))
                            }}
                          />
                        </div>
                        <p className="text-sm text-gray-400">
                          {team.members.length} membri
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
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
              
              {/* Generate Knockout Button */}
              {canGenerateKnockout() && (
                <div className="mt-8 p-6 bg-green-800/20 border border-green-600 rounded-lg">
                  <div className="text-center">
                    <Trophy className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <h4 className="text-lg font-bold text-white mb-2">Fase a Gironi Completata!</h4>
                    <p className="text-green-300 mb-4">
                      Tutti i match dei gironi sono stati completati. Puoi ora generare la fase finale.
                    </p>
                    <button
                      onClick={generateKnockoutBracket}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                    >
                      Genera Fase Finale
                    </button>
                  </div>
                </div>
              )}
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
                          {match.scheduled_at && (
                            <span className="text-xs text-blue-400">
                              {new Date(match.scheduled_at).toLocaleTimeString('it-IT', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
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