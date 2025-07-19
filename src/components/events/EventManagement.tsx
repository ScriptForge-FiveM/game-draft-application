import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Users, Trophy, Settings, Play, UserCheck, Clock, Target, Calendar, Gamepad2, Shield, Crown, Zap, CheckCircle, Circle, ArrowRight, Award, FileText, CalendarDays, Gift } from 'lucide-react'
import { RegistrationList } from './RegistrationList'
import { CaptainSelection } from './CaptainSelection'
import { LiveDraft } from './LiveDraft'
import { TournamentFormatSelector } from './TournamentFormatSelector'
import { EliminationBracket } from './EliminationBracket'
import { GroupsBracket } from './GroupsBracket'
import { TournamentManager } from './TournamentManager'
import { AdminMatchApproval } from './AdminMatchApproval'
import { MatchCalendar } from './MatchCalendar'
import { RewardsManager } from './RewardsManager'
import toast from 'react-hot-toast'

interface DraftEvent {
  id: string
  title: string
  description?: string
  admin_id: string
  team_count: number
  max_players_per_team: number
  max_participants: number
  status: 'registration' | 'captain_selection' | 'drafting' | 'completed' | 'ended'
  tournament_format?: 'elimination' | 'groups' | null
  tournament_bracket?: {
    id: string
    format: string
    status: string
    stage?: string
    settings: any
  }
  discord_server_id?: string
  game_type?: string
  scheduled_at?: string
  created_at: string
}

interface EventStats {
  totalRegistrations: number
  approvedRegistrations: number
  teamsWithCaptains: number
  draftedPlayers: number
}

interface TabConfig {
  id: string
  label: string
  icon: React.ComponentType<any>
  visible: boolean
  disabled?: boolean
}
export function EventManagement() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user, profile, isAdminViewActive } = useAuth()
  const [event, setEvent] = useState<DraftEvent | null>(null)
  const [stats, setStats] = useState<EventStats>({
    totalRegistrations: 0,
    approvedRegistrations: 0,
    teamsWithCaptains: 0,
    draftedPlayers: 0
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('registrations')
  const [finalizing, setFinalizing] = useState(false)

  const steps = [
    {
      id: 'registrations',
      title: 'Gestione Registrazioni',
      description: '',
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      status: 'registration'
    },
    {
      id: 'captains',
      title: 'Selezione Capitani',
      description: '',
      icon: Crown,
      color: 'from-yellow-500 to-orange-500',
      status: 'captain_selection'
    },
    {
      id: 'draft',
      title: 'Draft Live',
      description: '',
      icon: Play,
      color: 'from-red-500 to-pink-500',
      status: 'drafting'
    },
    {
      id: 'tournament',
      title: 'Torneo',
      description: '',
      icon: Trophy,
      color: 'from-purple-500 to-pink-500',
      status: 'completed'
    }
  ]

  useEffect(() => {
    if (eventId) {
      fetchEventAndStats()
    }
  }, [eventId])

  useEffect(() => {
    if (event) {
      const stepIndex = steps.findIndex(step => step.status === event.status)
      const currentStep = stepIndex >= 0 ? stepIndex : 0
      
      // Auto-select appropriate tab based on event status
      if (event.status === 'registration') {
        setActiveTab('registrations')
      } else if (event.status === 'captain_selection') {
        setActiveTab('captains')
      } else if (event.status === 'drafting') {
        setActiveTab('draft')
      } else if (event.status === 'completed' || event.status === 'ended') {
        setActiveTab('tournament')
      }
    }
  }, [event])
  


const handleCaptainsChange = (count: number) => {
  setStats(prev => ({ ...prev, teamsWithCaptains: count }))
}

  // Tab configuration
  const tabsConfig: TabConfig[] = [
    {
      id: 'registrations',
      label: 'Registrazioni',
      icon: Users,
      visible: true
    },
    {
      id: 'captains',
      label: 'Capitani',
      icon: Crown,
      visible: event?.status !== 'registration'
    },
    {
      id: 'draft',
      label: 'Draft Live',
      icon: Play,
      visible: event?.status === 'drafting' || (event?.status === 'completed' || event?.status === 'ended')
    },
    {
      id: 'tournament',
      label: 'Torneo',
      icon: Trophy,
      visible: event?.status === 'completed' || event?.status === 'ended'
    },
    {
      id: 'match_approval',
      label: 'Approvazione Match',
      icon: Award,
      visible: event?.status === 'completed' || event?.status === 'ended'
    },
    {
      id: 'match_calendar',
      label: 'Calendario',
      icon: CalendarDays,
      visible: event?.status === 'completed' || event?.status === 'ended'
    },
    {
      id: 'rewards',
      label: 'Premi',
      icon: Gift,
      visible: event?.status === 'completed' || event?.status === 'ended'
    }
  ]
  
  const fetchEventAndStats = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('draft_events')
        .select(`
          *,
          tournament_brackets (
            id,
            format,
            status,
            settings
          )
        `)
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError
      
      // Process the event data to include tournament bracket info
      const processedEvent = {
        ...eventData,
        tournament_bracket: eventData.tournament_brackets?.[0] || null
      }
      delete processedEvent.tournament_brackets
      
      setEvent(processedEvent)

      // Fetch stats
      await fetchStats()
    } catch (error) {
      console.error('Error fetching event:', error)
      toast.error('Errore nel caricamento dell\'evento')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      // Total registrations
      const { count: totalRegs } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)

      // Approved registrations
      const { count: approvedRegs } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'approved')

      // Teams with captains
      const { count: teamsWithCaptains } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .not('captain_id', 'is', null)

      // Drafted players
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('event_id', eventId)

      let draftedCount = 0
      if (teams && teams.length > 0) {
        const { count: drafted } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .in('team_id', teams.map(t => t.id))

        draftedCount = drafted || 0
      }

      setStats({
        totalRegistrations: totalRegs || 0,
        approvedRegistrations: approvedRegs || 0,
        teamsWithCaptains: teamsWithCaptains || 0,
        draftedPlayers: draftedCount
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

const updateEventStatus = async (newStatus: DraftEvent['status']) => {
  if (!event) return

  try {
    // Se si passa al draft, aggiungi i capitani nei team_members
    if (event.status === 'captain_selection' && newStatus === 'drafting') {
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, captain_id')
        .eq('event_id', event.id)
        .not('captain_id', 'is', null)

      if (teamsError) throw teamsError

      const { data: registrations, error: regError } = await supabase
        .from('registrations')
        .select('user_id, username, preferred_position')
        .eq('event_id', event.id)
        .eq('status', 'approved')

      if (regError) throw regError

      const captainData = teams.map(team => {
        const reg = registrations.find(r => r.user_id === team.captain_id)
        if (!reg) return null
        return {
          team_id: team.id,
          user_id: reg.user_id,
          username: reg.username,
          position: reg.preferred_position,
          pick_order: 0,
        }
      }).filter(Boolean)

      if (captainData.length > 0) {
        const { error: insertError } = await supabase
          .from('team_members')
          .insert(captainData)

        if (insertError) throw insertError

        toast.success('Capitani aggiunti nei rispettivi team!')
      }
    }

    // Poi aggiorna lo stato evento
    const { error } = await supabase
      .from('draft_events')
      .update({ status: newStatus })
      .eq('id', event.id)

    if (error) throw error

    setEvent({ ...event, status: newStatus })
    toast.success(`Evento spostato alla fase: ${getStatusLabel(newStatus)}`)


  } catch (error) {
    console.error('Errore aggiornamento stato evento:', error)
    toast.error('Errore durante il passaggio di fase')
  }
}

  const handleFinalizeTournament = async () => {
    if (!event || !profile?.is_admin) return

    setFinalizing(true)
    try {
      console.log('🏆 Starting tournament finalization process...')
      
      // Check if tournament bracket is completed
      if (!event.tournament_bracket || event.tournament_bracket.status !== 'completed') {
        toast.error('Il torneo deve essere completato prima di finalizzare l\'evento')
        return
      }

      // Check if all tournament matches are completed
      const { data: pendingMatches, error: matchesError } = await supabase
        .from('tournament_matches')
        .select('id')
        .eq('bracket_id', event.tournament_bracket.id)
        .neq('status', 'completed')

      if (matchesError) throw matchesError

      if (pendingMatches && pendingMatches.length > 0) {
        toast.error(`Ci sono ancora ${pendingMatches.length} partite non completate`)
        return
      }

      // Step 1: Update player statistics from match result submissions
      console.log('📊 Step 1: Updating player statistics...')
      await updatePlayerStatisticsFromSubmissions()
      
      // Step 2: Calculate and assign event awards
      console.log('🏆 Step 2: Calculating and assigning awards...')
      await calculateAndAssignEventAwards()
      
      // Step 3: Distribute rewards based on tournament results
      console.log('💰 Step 3: Distributing rewards...')
      await distributeRewardsBasedOnTournamentResults()
      
      // Step 4: Update rankings
      console.log('📈 Step 4: Updating rankings...')
      await updateRankings()
      
      // Update event status to ended
      const { error: eventError } = await supabase
        .from('draft_events')
        .update({ status: 'ended' })
        .eq('id', event.id)

      if (eventError) throw eventError

      setEvent({ ...event, status: 'ended' })
      toast.success('Torneo finalizzato! Awards assegnati, premi distribuiti e statistiche aggiornate automaticamente.')
      
      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload()
      }, 2000)

    } catch (error) {
      console.error('Error finalizing tournament:', error)
      toast.error('Errore nella finalizzazione del torneo')
    } finally {
      setFinalizing(false)
    }
  }

  const calculateAndAssignEventAwards = async () => {
    if (!event) return
    
    try {
      console.log('🏆 Calculating event awards...')
      
      // Get all match stats for this event
      const { data: matchStats, error: statsError } = await supabase
        .from('player_match_stats')
        .select(`
          *,
          match:match_id!inner (event_id)
        `)
        .eq('match.event_id', event.id)
      
      if (statsError) {
        console.error('Error fetching match stats:', statsError)
        return
      }
      
      if (!matchStats || matchStats.length === 0) {
        console.log('ℹ️ No match stats found for awards calculation')
        return
      }
      
      // Calculate MVP (goals + assists + clean_sheets * 2)
      const mvpStats = new Map()
      matchStats.forEach(stat => {
        const userId = stat.user_id
        if (!mvpStats.has(userId)) {
          mvpStats.set(userId, {
            user_id: userId,
            username: stat.username,
            goals: 0,
            assists: 0,
            clean_sheets: 0,
            mvp_score: 0
          })
        }
        
        const userStats = mvpStats.get(userId)
        userStats.goals += stat.goals
        userStats.assists += stat.assists
        userStats.clean_sheets += stat.clean_sheet ? 1 : 0
        userStats.mvp_score = userStats.goals + userStats.assists + (userStats.clean_sheets * 2)
      })
      
      // Find MVP
      let mvpWinner = null
      let maxMvpScore = 0
      mvpStats.forEach(stats => {
        if (stats.mvp_score > maxMvpScore) {
          maxMvpScore = stats.mvp_score
          mvpWinner = stats
        }
      })
      
      // Find Top Scorer
      let topScorer = null
      let maxGoals = 0
      mvpStats.forEach(stats => {
        if (stats.goals > maxGoals) {
          maxGoals = stats.goals
          topScorer = stats
        }
      })
      
      // Find Top Assists
      let topAssists = null
      let maxAssists = 0
      mvpStats.forEach(stats => {
        if (stats.assists > maxAssists) {
          maxAssists = stats.assists
          topAssists = stats
        }
      })
      
      // Find Best Goalkeeper (most clean sheets among goalkeepers)
      const goalkeeperStats = matchStats.filter(stat => 
        stat.position.toLowerCase().includes('por') || 
        stat.position.toLowerCase().includes('portiere')
      )
      
      const gkCleanSheets = new Map()
      goalkeeperStats.forEach(stat => {
        const userId = stat.user_id
        if (!gkCleanSheets.has(userId)) {
          gkCleanSheets.set(userId, {
            user_id: userId,
            username: stat.username,
            clean_sheets: 0
          })
        }
        
        if (stat.clean_sheet) {
          gkCleanSheets.get(userId).clean_sheets += 1
        }
      })
      
      let bestGoalkeeper = null
      let maxCleanSheets = 0
      gkCleanSheets.forEach(stats => {
        if (stats.clean_sheets > maxCleanSheets) {
          maxCleanSheets = stats.clean_sheets
          bestGoalkeeper = stats
        }
      })
      
      // Find Tournament Winner (winner of final match)
      const { data: finalMatch, error: finalError } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          winner:winner_id (
            id,
            name,
            captain_id
          )
        `)
        .eq('bracket_id', event.tournament_bracket?.id)
        .order('round', { ascending: false })
        .limit(1)
        .single()
      
      if (finalError) {
        console.error('Error finding final match:', finalError)
      }
      
      let tournamentWinner = null
      if (finalMatch?.winner?.captain_id) {
        const { data: captainProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', finalMatch.winner.captain_id)
          .single()
        
        if (captainProfile) {
          tournamentWinner = {
            user_id: finalMatch.winner.captain_id,
            username: captainProfile.username
          }
        }
      }
      
      // Insert awards
      const awardsToInsert = []
      
      if (mvpWinner && maxMvpScore > 0) {
        awardsToInsert.push({
          event_id: event.id,
          award_type: 'mvp',
          user_id: mvpWinner.user_id,
          username: mvpWinner.username,
          value: maxMvpScore,
          description: `MVP del torneo con ${maxMvpScore} punti (${mvpWinner.goals} goal, ${mvpWinner.assists} assist, ${mvpWinner.clean_sheets} clean sheets)`
        })
      }
      
      if (topScorer && maxGoals > 0) {
        awardsToInsert.push({
          event_id: event.id,
          award_type: 'top_scorer',
          user_id: topScorer.user_id,
          username: topScorer.username,
          value: maxGoals,
          description: `Miglior marcatore con ${maxGoals} goal`
        })
      }
      
      if (topAssists && maxAssists > 0) {
        awardsToInsert.push({
          event_id: event.id,
          award_type: 'top_assists',
          user_id: topAssists.user_id,
          username: topAssists.username,
          value: maxAssists,
          description: `Miglior assistman con ${maxAssists} assist`
        })
      }
      
      if (bestGoalkeeper && maxCleanSheets > 0) {
        awardsToInsert.push({
          event_id: event.id,
          award_type: 'best_goalkeeper',
          user_id: bestGoalkeeper.user_id,
          username: bestGoalkeeper.username,
          value: maxCleanSheets,
          description: `Miglior portiere con ${maxCleanSheets} clean sheets`
        })
      }
      
      if (tournamentWinner) {
        awardsToInsert.push({
          event_id: event.id,
          award_type: 'tournament_winner',
          user_id: tournamentWinner.user_id,
          username: tournamentWinner.username,
          value: 1,
          description: 'Vincitore del torneo come capitano'
        })
      }
      
      if (awardsToInsert.length > 0) {
        // Delete existing awards for this event first
        await supabase
          .from('draft_awards')
          .delete()
          .eq('event_id', event.id)
        
        // Insert new awards
        const { error: insertError } = await supabase
          .from('draft_awards')
          .insert(awardsToInsert)
        
        if (insertError) {
          console.error('Error inserting awards:', insertError)
        } else {
          console.log(`✅ Assigned ${awardsToInsert.length} awards`)
        }
      }
      
    } catch (error) {
      console.error('Error calculating and assigning awards:', error)
      // Don't throw error as it's not critical
    }
  }
  const updatePlayerStatisticsFromSubmissions = async () => {
    try {
      console.log('📊 Updating player statistics from match submissions...')
      
      // Get all approved match result submissions for this event
      const { data: submissions, error: submissionsError } = await supabase
        .from('match_result_submissions')
        .select('*')
        .eq('status', 'approved')
      
      if (submissionsError) throw submissionsError
      
      console.log(`🔍 Found ${submissions?.length || 0} total approved submissions`)
      
      // Filter submissions for this event by checking matches manually  
      const eventSubmissions = []
      
      for (const submission of submissions || []) {
        let belongsToEvent = false
        
        if (submission.match_id) {
          // Check if this match belongs to our event
          const { data: matchData } = await supabase
            .from('matches')
            .select('event_id')
            .eq('id', submission.match_id)
            .single()
          
          if (matchData?.event_id === event?.id) {
            belongsToEvent = true
          }
        }
        
        if (submission.tournament_match_id) {
          // Check if this tournament match belongs to our event
          const { data: tournamentMatchData } = await supabase
            .from('tournament_matches')
            .select(`
              tournament_brackets!inner (event_id)
            `)
            .eq('id', submission.tournament_match_id)
            .single()
          
          if (tournamentMatchData?.tournament_brackets?.event_id === event?.id) {
            belongsToEvent = true
          }
        }
        
        if (belongsToEvent) {
          eventSubmissions.push(submission)
        }
      }
      
      console.log(`📋 Found ${eventSubmissions.length} approved submissions for this event`)
      
      // Get ALL participants in this event (not just winners)
      const { data: allParticipants, error: participantsError } = await supabase
        .from('registrations')
        .select('user_id, username')
        .eq('event_id', event?.id)
        .eq('status', 'approved')
      
      if (participantsError) throw participantsError
      
      console.log(`👥 Found ${allParticipants?.length || 0} total participants in event`)
      
      // Initialize stats for ALL participants
      const playerStatsMap = new Map()
      
      // First, initialize all participants with zero stats
      for (const participant of allParticipants || []) {
        playerStatsMap.set(participant.user_id, {
          user_id: participant.user_id,
          username: participant.username,
          total_matches: 0,
          total_goals: 0,
          total_assists: 0,
          total_clean_sheets: 0,
          total_wins: 0,
          total_losses: 0,
          draft_participations: 1
        })
      }
      
      // Then, process submissions to update stats
      for (const submission of eventSubmissions) {
        if (!submission.notes) continue
        
        try {
          const parsedNotes = JSON.parse(submission.notes)
          if (parsedNotes.player_stats && Array.isArray(parsedNotes.player_stats)) {
            for (const playerStat of parsedNotes.player_stats) {
              const userId = playerStat.user_id
              
              // Skip if player not in our participants list
              if (!playerStatsMap.has(userId)) {
                console.warn(`⚠️ Player ${playerStat.username} not found in participants, skipping`)
                continue
              }
              
              const stats = playerStatsMap.get(userId)
              stats.total_matches += 1
              stats.total_goals += playerStat.goals || 0
              stats.total_assists += playerStat.assists || 0
              
              // Clean sheet logic: if goalkeeper/defender and team didn't concede
              const isGoalkeeperOrDefender = playerStat.position && 
                (playerStat.position.toLowerCase().includes('por') || 
                 playerStat.position.toLowerCase().includes('dif'))
              
              // Check if this player's team kept a clean sheet
              let teamKeptCleanSheet = false
              if (submission.match_id) {
                const { data: matchData } = await supabase
                  .from('matches')
                  .select('team1_id, team2_id')
                  .eq('id', submission.match_id)
                  .single()
                
                if (matchData) {
                  if (playerStat.team_id === matchData.team1_id && submission.team2_score === 0) {
                    teamKeptCleanSheet = true
                  } else if (playerStat.team_id === matchData.team2_id && submission.team1_score === 0) {
                    teamKeptCleanSheet = true
                  }
                }
              } else if (submission.tournament_match_id) {
                const { data: tournamentMatchData } = await supabase
                  .from('tournament_matches')
                  .select('team1_id, team2_id')
                  .eq('id', submission.tournament_match_id)
                  .single()
                
                if (tournamentMatchData) {
                  if (playerStat.team_id === tournamentMatchData.team1_id && submission.team2_score === 0) {
                    teamKeptCleanSheet = true
                  } else if (playerStat.team_id === tournamentMatchData.team2_id && submission.team1_score === 0) {
                    teamKeptCleanSheet = true
                  }
                }
              }
              
              if (playerStat.clean_sheet || (isGoalkeeperOrDefender && teamKeptCleanSheet)) {
                stats.total_clean_sheets += 1
              }
              
              // Win/loss logic - determine if this player's team won
              let isWinner = false
              
              if (submission.match_id) {
                const { data: matchData } = await supabase
                  .from('matches')
                  .select('team1_id, team2_id')
                  .eq('id', submission.match_id)
                  .single()
                
                if (matchData) {
                  if (playerStat.team_id === matchData.team1_id && submission.team1_score > submission.team2_score) {
                    isWinner = true
                  } else if (playerStat.team_id === matchData.team2_id && submission.team2_score > submission.team1_score) {
                    isWinner = true
                  }
                }
              } else if (submission.tournament_match_id) {
                const { data: tournamentMatchData } = await supabase
                  .from('tournament_matches')
                  .select('team1_id, team2_id')
                  .eq('id', submission.tournament_match_id)
                  .single()
                
                if (tournamentMatchData) {
                  if (playerStat.team_id === tournamentMatchData.team1_id && submission.team1_score > submission.team2_score) {
                    isWinner = true
                  } else if (playerStat.team_id === tournamentMatchData.team2_id && submission.team2_score > submission.team1_score) {
                    isWinner = true
                  }
                }
              }
              
              if (isWinner) {
                stats.total_wins += 1
              } else if (submission.team1_score !== submission.team2_score) {
                stats.total_losses += 1
              }
              // Note: draws (same score) don't count as wins or losses
            }
          }
        } catch (parseError) {
          console.warn('⚠️ Could not parse notes for submission:', submission.id)
        }
      }
      
      console.log(`👥 Processing stats for ${playerStatsMap.size} players`)
      
      // Update or create player stats for ALL participants
      for (const [userId, newStats] of playerStatsMap) {
        // Check if player stats already exist
        const { data: existingStats, error: existingError } = await supabase
          .from('player_stats')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (existingError && existingError.code !== 'PGRST116') {
          console.error('Error checking existing stats:', existingError)
          continue
        }
        
        if (existingStats) {
          // Update existing stats
          const { error: updateError } = await supabase
            .from('player_stats')
            .update({
              total_matches: existingStats.total_matches + newStats.total_matches,
              total_goals: existingStats.total_goals + newStats.total_goals,
              total_assists: existingStats.total_assists + newStats.total_assists,
              total_clean_sheets: existingStats.total_clean_sheets + newStats.total_clean_sheets,
              total_wins: existingStats.total_wins + newStats.total_wins,
              total_losses: existingStats.total_losses + newStats.total_losses,
              draft_participations: existingStats.draft_participations + 1,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
          
          if (updateError) {
            console.error('Error updating player stats:', updateError)
          } else {
            console.log(`✅ Updated stats for ${newStats.username}`)
          }
        } else {
          // Create new stats record
          const { error: insertError } = await supabase
            .from('player_stats')
            .insert({
              user_id: userId,
              username: newStats.username,
              total_matches: newStats.total_matches,
              total_goals: newStats.total_goals,
              total_assists: newStats.total_assists,
              total_clean_sheets: newStats.total_clean_sheets,
              total_wins: newStats.total_wins,
              total_losses: newStats.total_losses,
              draft_participations: 1
            })
          
          if (insertError) {
            console.error('Error creating player stats:', insertError)
          } else {
            console.log(`✅ Created new stats for ${newStats.username}`)
          }
        }
      }
      
    } catch (error) {
      console.error('Error updating player statistics:', error)
      throw error
    }
  }
  
  const distributeRewardsBasedOnTournamentResults = async () => {
    if (!event?.tournament_bracket) return
    
    try {
      console.log('💰 Distributing rewards based on tournament results...')
      
      // Get reward settings for this event
      const { data: rewardSettings, error: rewardError } = await supabase
        .from('event_reward_settings')
        .select('*')
        .eq('event_id', event.id)
        .single()
      
      if (rewardError || !rewardSettings?.enabled) {
        console.log('ℹ️ No reward settings found or rewards disabled for this event')
        return
      }
      
      console.log('⚙️ Reward settings:', rewardSettings)
      
      // Get tournament bracket to determine final standings
      const { data: bracketData, error: bracketError } = await supabase
        .from('tournament_brackets')
        .select('*')
        .eq('event_id', event.id)
        .single()

      if (bracketError) throw bracketError

      if (!bracketData || bracketData.status !== 'completed') {
        throw new Error('Il torneo deve essere completato prima di distribuire i premi')
      }

      // Determine final standings based on tournament format
      let finalStandings = []
      
      if (bracketData.format === 'elimination') {
        // For elimination, get winner from final match
        const { data: finalMatches, error: finalError } = await supabase
          .from('tournament_matches')
          .select(`
            *,
            team1:team1_id (*),
            team2:team2_id (*),
            winner:winner_id (*)
          `)
          .eq('bracket_id', bracketData.id)
          .order('round', { ascending: false })
          .limit(10)

        if (finalError) throw finalError

        if (finalMatches && finalMatches.length > 0) {
          const finalMatch = finalMatches[0] // Highest round number
          const semiFinals = finalMatches.filter(m => m.round === finalMatch.round - 1)
          
          console.log('🏆 Final match:', finalMatch)
          console.log('🥉 Semi-finals:', semiFinals)
          
          // 1st place: Winner of final
          if (finalMatch.winner) {
            finalStandings.push(finalMatch.winner)
            console.log('🥇 1st place:', finalMatch.winner.name)
          }
          
          // 2nd place: Loser of final
          if (finalMatch.team1 && finalMatch.team2) {
            const loser = finalMatch.winner?.id === finalMatch.team1.id ? finalMatch.team2 : finalMatch.team1
            if (loser) {
              finalStandings.push(loser)
              console.log('🥈 2nd place:', loser.name)
            }
          }
          
          // 3rd place: Losers of semi-finals (if any)
          semiFinals.forEach(semi => {
            if (semi.team1 && semi.team2 && semi.winner) {
              const loser = semi.winner.id === semi.team1.id ? semi.team2 : semi.team1
              if (loser && !finalStandings.find(t => t.id === loser.id)) {
                finalStandings.push(loser)
                console.log('🥉 3rd place:', loser.name)
              }
            }
          })
        }
      }
      
      // Get team members for reward distribution
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          *,
          team_members (
            user_id,
            username,
            position
          )
        `)
        .eq('event_id', event.id)
        .order('name')

      if (teamsError) throw teamsError

      const teamsWithMembers = (teamsData || []).map(team => ({
        ...team,
        members: team.team_members || []
      }))

      const rewardsToDistribute = []

      // Calculate rewards based on final standings
      for (let position = 1; position <= Math.min(rewardSettings.reward_positions, finalStandings.length); position++) {
        const team = finalStandings[position - 1]
        const teamWithMembers = teamsWithMembers.find(t => t.id === team.id)
        
        if (!teamWithMembers) continue
        
        // Calculate reward amount for this position
        let rewardAmount = rewardSettings.base_reward_amount
        if (position > 1) {
          const reduction = rewardSettings.reduction_per_position * (position - 1)
          if (rewardSettings.reduction_type === 'percentage') {
            rewardAmount = Math.round(rewardSettings.base_reward_amount * (1 - reduction / 100))
          } else {
            rewardAmount = Math.max(0, rewardSettings.base_reward_amount - reduction)
          }
        }

        // Determine recipients
        const recipients = rewardSettings.only_captains 
          ? teamWithMembers.members.filter(member => member.user_id === teamWithMembers.captain_id)
          : teamWithMembers.members

        console.log(`💰 Position ${position}: ${team.name} - ${rewardAmount} credits to ${recipients.length} players`)

        for (const recipient of recipients) {
          rewardsToDistribute.push({
            user_id: recipient.user_id,
            event_id: event.id,
            amount: rewardAmount,
            reason: `${position}° posto - ${team.name}`,
            awarded_by: profile?.id
          })
        }
      }

      if (rewardsToDistribute.length > 0) {
        const { error } = await supabase
          .from('user_credits')
          .insert(rewardsToDistribute)

        if (error) throw error
        
        // Update total_credits in profiles table
        for (const reward of rewardsToDistribute) {
          // Get current credits first
          const { data: currentProfile, error: getError } = await supabase
            .from('profiles')
            .select('total_credits')
            .eq('id', reward.user_id)
            .single()
          
          if (getError) {
            console.error('Error getting current credits:', getError)
            continue
          }
          
          // Update with new total
          const newTotal = (currentProfile?.total_credits || 0) + reward.amount
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ total_credits: newTotal })
            .eq('id', reward.user_id)
          
          if (profileError) {
            console.error('Error updating profile credits:', profileError)
          } else {
            console.log(`✅ Updated credits for user ${reward.user_id}: +${reward.amount} (total: ${newTotal})`)
          }
        }
        
        console.log(`✅ Distributed rewards to ${rewardsToDistribute.length} players`)
        toast.success(`Premi distribuiti a ${rewardsToDistribute.length} giocatori!`)
      }
      
    } catch (error) {
      console.error('Error distributing rewards:', error)
      throw error
    }
  }
  
  const updateRankings = async () => {
    console.log('📈 Updating user rankings...')
    
    try {
      // Get all users with player stats
      const { data: playerStats, error: statsError } = await supabase
        .from('player_stats')
        .select('*')
      
      if (statsError) throw statsError
      
      // Get all draft awards to calculate award counts
      const { data: draftAwards, error: awardsError } = await supabase
        .from('draft_awards')
        .select('*')
      
      if (awardsError) throw awardsError
      
      // Get captain counts for each user
      const { data: captainData, error: captainError } = await supabase
        .from('teams')
        .select('captain_id')
        .not('captain_id', 'is', null)
      
      if (captainError) throw captainError
      
      // Count captaincies per user
      const captainCounts = new Map()
      captainData?.forEach(team => {
        if (team.captain_id) {
          captainCounts.set(team.captain_id, (captainCounts.get(team.captain_id) || 0) + 1)
        }
      })
      
      // Get tournament winners (drafts_won)
      const { data: tournamentWinners, error: winnersError } = await supabase
        .from('draft_awards')
        .select('user_id')
        .eq('award_type', 'tournament_winner')
      
      if (winnersError) throw winnersError
      
      const draftsWonCounts = new Map()
      tournamentWinners?.forEach(winner => {
        draftsWonCounts.set(winner.user_id, (draftsWonCounts.get(winner.user_id) || 0) + 1)
      })
      
      // Update or create user rankings for each player
      for (const stats of playerStats || []) {
        const winRate = stats.total_wins + stats.total_losses > 0 
          ? (stats.total_wins / (stats.total_wins + stats.total_losses)) * 100 
          : 0
        
        const goalsPerMatch = stats.total_matches > 0 
          ? stats.total_goals / stats.total_matches 
          : 0
        
        const assistsPerMatch = stats.total_matches > 0 
          ? stats.total_assists / stats.total_matches 
          : 0
        
        // Get award counts for this user
        const userAwards = draftAwards?.filter(award => award.user_id === stats.user_id) || []
        const mvpAwards = userAwards.filter(award => award.award_type === 'mvp').length
        const topScorerAwards = userAwards.filter(award => award.award_type === 'top_scorer').length
        const topAssistsAwards = userAwards.filter(award => award.award_type === 'top_assists').length
        const bestGoalkeeperAwards = userAwards.filter(award => award.award_type === 'best_goalkeeper').length
        
        const captainCount = captainCounts.get(stats.user_id) || 0
        const draftsWon = draftsWonCounts.get(stats.user_id) || 0
        
        // Calculate comprehensive ranking points
        const rankingPoints = 
          (stats.total_wins * 3) + 
          (stats.total_goals * 2) + 
          (stats.total_assists * 1) + 
          (stats.total_clean_sheets * 2) +
          (stats.draft_participations * 5) +
          (mvpAwards * 50) +
          (topScorerAwards * 30) +
          (topAssistsAwards * 25) +
          (bestGoalkeeperAwards * 35) +
          (captainCount * 10) +
          (draftsWon * 100)
        
        // Check if ranking exists
        const { data: existingRanking, error: existingError } = await supabase
          .from('user_rankings')
          .select('id')
          .eq('user_id', stats.user_id)
          .single()
        
        if (existingError && existingError.code !== 'PGRST116') {
          console.error('Error checking existing ranking:', existingError)
          continue
        }
        
        const rankingData = {
          user_id: stats.user_id,
          username: stats.username,
          total_drafts: stats.draft_participations,
          drafts_won: draftsWon,
          total_matches: stats.total_matches,
          total_wins: stats.total_wins,
          total_losses: stats.total_losses,
          total_goals: stats.total_goals,
          total_assists: stats.total_assists,
          total_clean_sheets: stats.total_clean_sheets,
          captain_count: captainCount,
          mvp_awards: mvpAwards,
          top_scorer_awards: topScorerAwards,
          top_assists_awards: topAssistsAwards,
          best_goalkeeper_awards: bestGoalkeeperAwards,
          ranking_points: rankingPoints,
          win_rate: Math.round(winRate * 100) / 100,
          goals_per_match: Math.round(goalsPerMatch * 100) / 100,
          assists_per_match: Math.round(assistsPerMatch * 100) / 100,
          updated_at: new Date().toISOString()
        }
        
        if (existingRanking) {
          // Update existing ranking
          const { error: updateError } = await supabase
            .from('user_rankings')
            .update(rankingData)
            .eq('user_id', stats.user_id)
          
          if (updateError) {
            console.error('Error updating ranking:', updateError)
          } else {
            console.log(`✅ Updated ranking for ${stats.username}`)
          }
        } else {
          // Create new ranking
          const { error: insertError } = await supabase
            .from('user_rankings')
            .insert(rankingData)
          
          if (insertError) {
            console.error('Error creating ranking:', insertError)
          } else {
            console.log(`✅ Created ranking for ${stats.username}`)
          }
        }
      }
      
      console.log('✅ Rankings updated successfully')
    } catch (error) {
      console.error('Error in updateRankings:', error)
      // Don't throw error here as it's not critical
    }
  }

  const getStatusLabel = (status: string) => {
    const labels = {
      registration: 'Registrazioni',
      captain_selection: 'Selezione Capitani',
      drafting: 'Draft Live',
      completed: 'Torneo',
      ended: 'Concluso'
    }
    return labels[status as keyof typeof labels] || status
  }

  const canProgressToNextStep = () => {
    if (!event) return false

    switch (event.status) {
      case 'registration':
        return stats.approvedRegistrations >= event.team_count
      case 'captain_selection':
        return stats.teamsWithCaptains === event.team_count
      case 'drafting':
        return stats.draftedPlayers >= stats.approvedRegistrations
      default:
        return false
    }
  }

  const getNextStepAction = () => {
    if (!event) return null

    switch (event.status) {
      case 'registration':
        return {
          label: 'Inizia Selezione Capitani',
          action: () => updateEventStatus('captain_selection'),
          disabled: !canProgressToNextStep(),
          reason: stats.approvedRegistrations < event.team_count 
            ? `Servono almeno ${event.team_count} giocatori approvati` 
            : null
        }
      case 'captain_selection':
        return {
          label: 'Avvia Draft',
          action: () => updateEventStatus('drafting'),
          disabled: !canProgressToNextStep(),
          reason: stats.teamsWithCaptains < event.team_count 
            ? `Servono ${event.team_count} capitani` 
            : null
        }
      case 'drafting':
        return {
          label: 'Completa Draft',
          action: () => updateEventStatus('completed'),
          disabled: !canProgressToNextStep(),
          reason: stats.draftedPlayers < stats.approvedRegistrations 
            ? 'Completa il draft di tutti i giocatori' 
            : null
        }
      default:
        return null
    }
  }

  const renderTabContent = () => {
    if (!event) return null

    switch (activeTab) {
      case 'registrations':
        return <RegistrationList eventId={event.id} showDummyGenerator={true} />
      
      case 'captains':
        return <CaptainSelection 
          eventId={event.id} 
          teamCount={event.team_count}
          onCaptainsChange={handleCaptainsChange}
        />
      
      case 'draft':
        return <LiveDraft eventId={event.id} />
      
      case 'tournament':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Trophy className="h-6 w-6 text-purple-400" />
                <h4 className="text-xl font-bold text-white">Gestione Torneo</h4>
              </div>
              
              {/* Finalize Tournament Button */}
              {event.status === 'completed' && 
               event.tournament_bracket?.status === 'completed' && 
               profile?.is_admin && isAdminViewActive && (
                <button
                  onClick={handleFinalizeTournament}
                  disabled={finalizing}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50"
                >
                  {finalizing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Finalizzando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>Finalizza Torneo</span>
                    </>
                  )}
                </button>
              )}
            </div>
            
            {!event.tournament_bracket ? (
              <TournamentFormatSelector 
                eventId={event.id} 
                teamCount={event.team_count}
                onFormatSelected={(bracket) => {
                  setEvent(prev => prev ? { ...prev, tournament_bracket: bracket, tournament_format: bracket.format } : null)
                }}
              />
            ) : (
              <TournamentManager 
                eventId={event.id}
                bracket={event.tournament_bracket}
              />
            )}
          </div>
        )
      
      case 'match_approval':
        return <AdminMatchApproval eventId={event.id} />
      
      case 'match_calendar':
        return <MatchCalendar eventId={event.id} />
      
      case 'rewards':
        return <RewardsManager 
          eventId={event.id} 
          isCompleted={event.status === 'ended'} 
        />
      
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-white text-xl">Caricamento evento...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="glass rounded-2xl p-12 border border-white/20 max-w-md">
            <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">Evento Non Trovato</h2>
            <p className="text-white/70 mb-8">L'evento che stai cercando non esiste o è stato eliminato.</p>
            <Link to="/dashboard" className="btn-primary inline-flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna alla Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const nextStepAction = getNextStepAction()

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-6">
            <Link
              to="/dashboard"
              className="flex items-center text-white hover:text-orange-400 mr-6 transition-colors group"
            >
              <ArrowLeft className="h-6 w-6 group-hover:transform group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="flex-1">
              <h1 className="text-5xl font-bold bg-gradient-to-r white-400 bg-clip-text mb-2">
                {event.title}
              </h1>
              <div className="flex items-center space-x-6 text-white/80">
                {event.game_type && (
                  <div className="flex items-center space-x-2">
                    <Gamepad2 className="h-5 w-5 text-blue-400" />
                    <span className="font-medium">{event.game_type}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-green-400" />
                  <span className="font-medium">{event.team_count} Squadre</span>
                </div>
                {event.scheduled_at && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-purple-400" />
                    <span className="font-medium">
                      {new Date(event.scheduled_at).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step Progress */}
        <div className="mb-8">
          <div className="glass rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-6">Progresso Evento</h3>
            
            <div className="flex items-center justify-between mb-6">
              {steps.map((step, index) => {
                const Icon = step.icon
                const currentStepIndex = steps.findIndex(s => s.status === event.status)
                const isActive = index === currentStepIndex
                const isCompleted = index < currentStepIndex
                const isAccessible = index <= currentStepIndex
                
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => {
                          if (isAccessible) {
                            // Auto-select appropriate tab based on step
                            if (step.status === 'registration') setActiveTab('registrations')
                            else if (step.status === 'captain_selection') setActiveTab('captains')
                            else if (step.status === 'drafting') setActiveTab('draft')
                            else if (step.status === 'completed') setActiveTab('tournament')
                          }
                        }}
                        disabled={!isAccessible}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isActive 
                            ? `bg-gradient-to-r ${step.color} shadow-lg scale-110` 
                            : isCompleted
                            ? 'bg-green-500 shadow-md'
                            : 'bg-gray-600'
                        } ${isAccessible ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-50'}`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-8 w-8 text-white" />
                        ) : (
                          <Icon className="h-8 w-8 text-white" />
                        )}
                      </button>
                      <div className="mt-3 text-center">
                        <p className={`font-bold text-sm ${isActive ? 'text-white' : 'text-white/70'}`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-white/50 mt-1 max-w-24">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-1 mx-4 rounded-full transition-colors ${
                        index < currentStepIndex ? 'bg-green-500' : 'bg-gray-600'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="glass rounded-xl p-4 border border-blue-400/30">
                <div className="flex items-center space-x-3">
                  <Users className="h-6 w-6 text-blue-400" />
                  <div>
                    <p className="text-sm text-blue-300 font-medium">Registrazioni</p>
                    <p className="text-xl font-bold text-white">{stats.totalRegistrations}</p>
                  </div>
                </div>
              </div>
              
              <div className="glass rounded-xl p-4 border border-green-400/30">
                <div className="flex items-center space-x-3">
                  <UserCheck className="h-6 w-6 text-green-400" />
                  <div>
                    <p className="text-sm text-green-300 font-medium">Approvati</p>
                    <p className="text-xl font-bold text-white">{stats.approvedRegistrations}</p>
                  </div>
                </div>
              </div>
              
              <div className="glass rounded-xl p-4 border border-yellow-400/30">
                <div className="flex items-center space-x-3">
                  <Crown className="h-6 w-6 text-yellow-400" />
                  <div>
                    <p className="text-sm text-yellow-300 font-medium">Capitani</p>
                    <p className="text-xl font-bold text-white">{stats.teamsWithCaptains}/{event.team_count}</p>
                  </div>
                </div>
              </div>
              
              <div className="glass rounded-xl p-4 border border-purple-400/30">
                <div className="flex items-center space-x-3">
                  <Target className="h-6 w-6 text-purple-400" />
                  <div>
                    <p className="text-sm text-purple-300 font-medium">Draftati</p>
                    <p className="text-xl font-bold text-white">{stats.draftedPlayers}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Step Action */}
            {nextStepAction && (
              <div className="flex items-center justify-end">
                {nextStepAction.disabled && nextStepAction.reason && (
                  <p className="text-yellow-300 text-sm mr-4">{nextStepAction.reason}</p>
                )}
                <button
                  onClick={nextStepAction.action}
                  disabled={nextStepAction.disabled}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all duration-200 ${
                    nextStepAction.disabled
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:scale-105 shadow-lg'
                  }`}
                >
                  <span>{nextStepAction.label}</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 overflow-x-auto">
            {tabsConfig
              .filter(tab => tab.visible)
              .map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    disabled={tab.disabled}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-md font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="glass rounded-2xl border border-white/20 overflow-hidden">
          <div className="p-8 bg-gray-900/30 backdrop-blur-sm min-h-[600px]">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}