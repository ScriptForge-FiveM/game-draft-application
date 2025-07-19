import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Users, Trophy, Shield, Target, Shuffle, Crown } from 'lucide-react'
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

interface Group {
  id: string
  name: string
  teams: Team[]
  matches: GroupMatch[]
}

interface GroupMatch {
  id: string
  team1: Team
  team2: Team
  team1_score?: number
  team2_score?: number
  completed: boolean
}

interface GroupsBracketProps {
  eventId: string
  matches?: any[]
  teams?: Team[]
  isAdmin?: boolean
}

export function GroupsBracket({ eventId, matches: propMatches, teams: propTeams, isAdmin = false }: GroupsBracketProps) {
  const { user } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [shuffling, setShuffling] = useState(false)

  useEffect(() => {
    if (propMatches && propTeams) {
      setTeams(propTeams)
      generateGroupsFromMatches(propMatches, propTeams)
      setLoading(false)
    } else {
      fetchTeamsAndGenerateGroups()
    }
  }, [eventId, propMatches, propTeams])

  const generateGroupsFromMatches = (matches: any[], teamsList: Team[]) => {
    // Group matches by round (which represents groups)
    const groupsData: { [key: number]: any[] } = {}
    matches.forEach(match => {
      if (!groupsData[match.round]) {
        groupsData[match.round] = []
      }
      groupsData[match.round].push(match)
    })

    // Convert to groups format
    const newGroups: Group[] = []
    Object.keys(groupsData).sort((a, b) => parseInt(a) - parseInt(b)).forEach((groupKey, index) => {
      const groupMatches = groupsData[parseInt(groupKey)]
      
      // Get unique teams in this group
      const teamIds = new Set<string>()
      groupMatches.forEach((match: any) => {
        if (match.team1_id) teamIds.add(match.team1_id)
        if (match.team2_id) teamIds.add(match.team2_id)
      })
      
      const groupTeams = Array.from(teamIds).map(id => 
        teamsList.find(t => t.id === id)
      ).filter(Boolean) as Team[]

      // Convert matches to group format
      const matches: GroupMatch[] = groupMatches.map((match: any) => ({
        id: match.id,
        team1: teamsList.find(t => t.id === match.team1_id) || null,
        team2: teamsList.find(t => t.id === match.team2_id) || null,
        team1_score: match.team1_score,
        team2_score: match.team2_score,
        completed: match.status === 'completed'
      })).filter(m => m.team1 && m.team2) as GroupMatch[]

      newGroups.push({
        id: `group-${index}`,
        name: `Girone ${String.fromCharCode(65 + index)}`,
        teams: groupTeams,
        matches
      })
    })

    setGroups(newGroups)
  }

  const fetchTeamsAndGenerateGroups = async () => {
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
      generateGroups(teamsWithMembers)
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast.error('Errore nel caricamento delle squadre')
    } finally {
      setLoading(false)
    }
  }

  const generateGroups = (teamsList: Team[]) => {
    if (teamsList.length < 4) {
      setGroups([])
      return
    }

    // Shuffle teams
    const shuffledTeams = [...teamsList].sort(() => Math.random() - 0.5)
    
    // Calculate number of groups (max 4 teams per group)
    const groupCount = Math.ceil(shuffledTeams.length / 4)
    const teamsPerGroup = Math.ceil(shuffledTeams.length / groupCount)
    
    const newGroups: Group[] = []
    
    for (let i = 0; i < groupCount; i++) {
      const groupTeams = shuffledTeams.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup)
      
      // Generate all matches for this group (round robin)
      const matches: GroupMatch[] = []
      for (let j = 0; j < groupTeams.length; j++) {
        for (let k = j + 1; k < groupTeams.length; k++) {
          matches.push({
            id: `group-${i}-match-${j}-${k}`,
            team1: groupTeams[j],
            team2: groupTeams[k],
            completed: false
          })
        }
      }
      
      newGroups.push({
        id: `group-${i}`,
        name: `Girone ${String.fromCharCode(65 + i)}`,
        teams: groupTeams,
        matches
      })
    }
    
    setGroups(newGroups)
  }

  const shuffleGroups = () => {
    if (!isAdmin || !user) {
      toast.error('Solo gli amministratori possono rimescolare i gironi')
      return
    }
    
    setShuffling(true)
    generateGroups(teams)
    
    // Salva i nuovi gironi nel database
    saveGroupsToDatabase()
  }

  const saveGroupsToDatabase = async () => {
    try {
      console.log('💾 Saving shuffled groups to database...')
      
      // Ottieni il bracket ID per questo evento
      const { data: bracketData, error: bracketError } = await supabase
        .from('tournament_brackets')
        .select('id')
        .eq('event_id', eventId)
        .single()
      
      if (bracketError) {
        console.error('❌ Error finding bracket:', bracketError)
        throw bracketError
      }
      
      if (bracketData?.id) {
        console.log('🗑️ Deleting existing matches for bracket:', bracketData.id)
        
        const { error: deleteError } = await supabase
          .from('tournament_matches')
          .delete()
          .eq('bracket_id', bracketData.id)
        
        if (deleteError) {
          console.error('❌ Error deleting matches:', deleteError)
          throw deleteError
        }
        
        console.log('✅ Existing matches deleted')
        
        // Ora rigenera i match con i nuovi gironi
        await regenerateGroupMatches(bracketData.id)
      }
      
      toast.success('Gironi rimescolati e salvati!')
      
      // Ricarica i dati per mostrare i nuovi match
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error) {
      console.error('Error saving groups:', error)
      toast.error('Errore nel salvataggio dei gironi')
    } finally {
      setShuffling(false)
    }
  }

  const regenerateGroupMatches = async (bracketId: string) => {
    try {
      console.log('🔄 Regenerating group matches...')
      
      // Ottieni le impostazioni del bracket
      const { data: bracketSettings, error: settingsError } = await supabase
        .from('tournament_brackets')
        .select('settings')
        .eq('id', bracketId)
        .single()
      
      if (settingsError) throw settingsError
      
      const settings = bracketSettings.settings || {}
      const groupsCount = settings.groupsCount || Math.ceil(teams.length / 4)
      
      // Ottieni l'orario del primo match dall'evento
      const { data: eventData, error: eventError } = await supabase
        .from('draft_events')
        .select('first_match_time')
        .eq('id', eventId)
        .single()
      
      if (eventError) throw eventError
      
      const baseTime = eventData.first_match_time ? new Date(eventData.first_match_time) : new Date()
      
      // Rimescola le squadre
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5)
      const teamsPerGroup = Math.ceil(shuffledTeams.length / groupsCount)
      
      const matchesToCreate = []
      let matchNumber = 1
      let totalMatchCount = 0
      
      // Teniamo traccia di quali squadre stanno giocando in ogni slot orario
      let teamSchedule = {}
      
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
      // Inizializziamo la struttura per tenere traccia degli slot orari
      let timeSlots = []
      
      // Crea i gironi e i match
      for (let groupIndex = 0; groupIndex < groupsCount; groupIndex++) {
        const groupTeams = shuffledTeams.slice(
          groupIndex * teamsPerGroup, 
          (groupIndex + 1) * teamsPerGroup
        )
        
        console.log(`🏟️ Group ${groupIndex + 1} teams:`, groupTeams.map(t => t.name))
        
        // Prepara tutte le partite per questo girone
        const groupMatches = []
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            groupMatches.push({
              team1: groupTeams[i],
              team2: groupTeams[j],
              round: groupIndex + 1
            })
          }
        }
        
        // Aggiungi tutte le partite del girone alla lista
        timeSlots.push(...groupMatches)
      }
      

      
      // Ordiniamo le partite in modo casuale per una distribuzione più equa
      timeSlots = timeSlots.sort(() => Math.random() - 0.5)
       
const MATCH_INTERVAL_MINUTES = 25
let currentTimeSlotIndex = 0



while (timeSlots.length > 0) {
  const slotMatches = []
  const busyTeams = new Set<string>()

  // Cerca match non in conflitto da mettere nello stesso slot
  for (let i = 0; i < timeSlots.length; i++) {
    const match = timeSlots[i]
    const t1 = match.team1.id
    const t2 = match.team2.id

    if (!busyTeams.has(t1) && !busyTeams.has(t2)) {
      slotMatches.push(match)
      busyTeams.add(t1)
      busyTeams.add(t2)
      timeSlots.splice(i, 1)
      i--
    }
  }

  const scheduledAt = new Date(baseTime.getTime() + currentTimeSlotIndex * MATCH_INTERVAL_MINUTES * 60 * 1000)

  for (const match of slotMatches) {
    matchesToCreate.push({
      bracket_id: bracketId,
      round: match.round,
      match_number: matchNumber++,
      team1_id: match.team1.id,
      team2_id: match.team2.id,
      team1_score: 0,
      team2_score: 0,
      status: 'pending' as const,
      scheduled_at: scheduledAt.toISOString()
    })
  }

  currentTimeSlotIndex++
}

      console.log('📝 Creating', matchesToCreate.length, 'new group matches')
      
      if (matchesToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('tournament_matches')
          .insert(matchesToCreate)
        
        if (insertError) throw insertError
        
        console.log('✅ New group matches created successfully')
      }
      
    } catch (error) {
      console.error('Error regenerating group matches:', error)
      throw error
    }
  }

  const getTeamStats = (team: Team, group: Group) => {
    let wins = 0
    let draws = 0
    let losses = 0
    let goalsFor = 0
    let goalsAgainst = 0
    let points = 0

    group.matches.forEach(match => {
      if (!match.completed || match.team1_score === undefined || match.team2_score === undefined) return

      const isTeam1 = match.team1.id === team.id
      const isTeam2 = match.team2.id === team.id

      if (isTeam1) {
        goalsFor += match.team1_score
        goalsAgainst += match.team2_score
        if (match.team1_score > match.team2_score) {
          wins++
          points += 3
        } else if (match.team1_score === match.team2_score) {
          draws++
          points += 1
        } else {
          losses++
        }
      } else if (isTeam2) {
        goalsFor += match.team2_score
        goalsAgainst += match.team1_score
        if (match.team2_score > match.team1_score) {
          wins++
          points += 3
        } else if (match.team2_score === match.team1_score) {
          draws++
          points += 1
        } else {
          losses++
        }
      }
    })

    return {
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      points,
      played: wins + draws + losses
    }
  }

  const getSortedTeams = (group: Group) => {
    return group.teams
      .map(team => ({ team, stats: getTeamStats(team, group) }))
      .sort((a, b) => {
        // Sort by points, then goal difference, then goals for
        if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points
        if (b.stats.goalDifference !== a.stats.goalDifference) return b.stats.goalDifference - a.stats.goalDifference
        return b.stats.goalsFor - a.stats.goalsFor
      })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (teams.length < 4) {
    return (
      <div className="text-center py-12">
        <Users className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">Squadre Insufficienti</h3>
        <p className="text-gray-500">Servono almeno 4 squadre per i gironi.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Users className="h-6 w-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Fase a Gironi</h3>
        </div>
        
        <button
          onClick={shuffleGroups}
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
              {isAdmin ? 'Rimescola Gironi' : 'Solo Admin'}
            </>
          )}
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Clicca "Rimescola Gironi" per generare i gruppi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groups.map((group) => {
            const sortedTeams = getSortedTeams(group)
            
            return (
              <div key={group.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xl font-bold text-white">{group.name}</h4>
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Shield className="h-4 w-4" />
                    <span>{group.teams.length} squadre</span>
                  </div>
                </div>

                {/* Classifica */}
                <div className="mb-6">
                  <h5 className="font-semibold text-gray-300 mb-3 flex items-center">
                    <Trophy className="h-4 w-4 mr-2" />
                    Classifica
                  </h5>
                  <div className="space-y-2">
                    {sortedTeams.map((item, index) => (
                      <div 
                        key={item.team.id} 
                        className={`flex items-center justify-between p-3 rounded ${
                          index === 0 ? 'bg-yellow-600/20 border border-yellow-600' : 'bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300'
                          }`}>
                            {index + 1}
                          </span>
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.team.color }}
                          />
                          <span className="text-white font-medium">{item.team.name}</span>
                          {index === 0 && <Crown className="h-4 w-4 text-yellow-400" />}
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="text-gray-300">{item.stats.played}G</span>
                          <span className="text-green-400">{item.stats.wins}V</span>
                          <span className="text-yellow-400">{item.stats.draws}P</span>
                          <span className="text-red-400">{item.stats.losses}S</span>
                          <span className="text-blue-400">{item.stats.goalDifference > 0 ? '+' : ''}{item.stats.goalDifference}</span>
                          <span className="font-bold text-white">{item.stats.points}pt</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Partite */}

                </div>
         
            )
          })}
        </div>
      )}

      <div className="bg-blue-800/20 border border-blue-600 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-blue-300 mb-2">
          <Users className="h-5 w-5" />
          <p className="font-medium">Formato: Fase a Gironi</p>
        </div>
        <p className="text-blue-300 text-sm">
          {groups.length} gironi • Tutti contro tutti • I primi di ogni girone si qualificano
        </p>
      </div>
    </div>
  )
}