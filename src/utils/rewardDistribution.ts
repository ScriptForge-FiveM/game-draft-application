import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface Team {
  id: string
  name: string
  color: string
  captain_id?: string
  members: Array<{
    user_id: string
    username: string
    position: string
  }>
}

interface PlayerStats {
  user_id: string
  username: string
  total_goals: number
  total_assists: number
  total_clean_sheets: number
  total_wins: number
  total_losses: number
  total_matches: number
  position: string
}

interface EventAward {
  award_type: 'mvp' | 'top_scorer' | 'top_assists' | 'best_goalkeeper' | 'tournament_winner'
  user_id: string
  username: string
  value: number
  description: string
}

interface RewardSettings {
  enabled: boolean
  only_captains: boolean
  base_reward_amount: number
  reward_positions: number
  reduction_per_position: number
  reduction_type: 'percentage' | 'fixed'
}

export async function finalizeTournamentAndDistributeRewards(
  eventId: string,
  adminProfile: any,
  teams: Team[]
) {
  console.log('🏆 Starting complete tournament finalization and reward distribution...')

  try {
    // Fetch reward settings for this event
    const { data: rewardSettingsData, error: settingsError } = await supabase
      .from('event_reward_settings')
      .select('*')
      .eq('event_id', eventId)
      .single()

    if (settingsError && settingsError.code !== 'PGRST116') {
      throw settingsError
    }

    const rewardSettings: RewardSettings = rewardSettingsData || {
      enabled: false,
      only_captains: false,
      base_reward_amount: 100,
      reward_positions: 3,
      reduction_per_position: 25,
      reduction_type: 'percentage'
    }

    if (!rewardSettings.enabled) {
      toast('Sistema premi disabilitato per questo evento. Finalizzazione completata senza distribuzione crediti.', { icon: 'ℹ️' })
      return
    }

    // Step 1: Calculate player statistics from match submissions
    const playerStats = await calculatePlayerStatistics(eventId, teams)

    // Step 2: Determine tournament standings
    const tournamentStandings = await determineTournamentStandings(eventId, teams)

    // Step 3: Calculate and assign awards
    const eventAwards = calculateEventAwards(playerStats, tournamentStandings)

    // Step 4: Save awards to database
    await saveEventAwards(eventId, eventAwards)

    // Step 5: Update player stats in database
    await updatePlayerStats(playerStats)

    // Step 6: Update user rankings with all data
    await updateUserRankings(playerStats, eventAwards, tournamentStandings)

    // Step 7: Distribute credits
    await distributeCredits(eventId, adminProfile, tournamentStandings, rewardSettings)

    toast.success('Finalizzazione e distribuzione premi completate!')
  } catch (error) {
    console.error('Error finalizing tournament:', error)
    toast.error('Errore durante la finalizzazione del torneo e la distribuzione dei premi.')
    throw error
  }
}

async function calculatePlayerStatistics(eventId: string, teams: Team[]): Promise<Map<string, PlayerStats>> {
  console.log('📊 Calculating player statistics...')

  // Fetch all player match stats for this event
  const { data: playerMatchStats, error: statsError } = await supabase
    .from('player_match_stats')
    .select('*')

  if (statsError) throw statsError

  // Filter stats for this event by checking related matches
  const eventStats = []
  for (const stat of playerMatchStats || []) {
    let isEventSubmission = false
    
    if (stat.match_id) {
      const { data: match } = await supabase
        .from('matches')
        .select('event_id')
        .eq('id', stat.match_id)
        .single()
      
      if (match?.event_id === eventId) {
        isEventSubmission = true
      }
    }
    
    if (stat.tournament_match_id) {
      const { data: tournamentMatch } = await supabase
        .from('tournament_matches')
        .select('tournament_brackets!inner(event_id)')
        .eq('id', stat.tournament_match_id)
        .single()
      
      if (tournamentMatch?.tournament_brackets?.event_id === eventId) {
        isEventSubmission = true
      }
    }
    
    if (isEventSubmission) {
      eventStats.push(stat)
    }
  }

  const playerStatsMap = new Map<string, PlayerStats>()

  // Initialize all players with zero stats
  teams.forEach(team => {
    team.members.forEach(member => {
      playerStatsMap.set(member.user_id, {
        user_id: member.user_id,
        username: member.username,
        total_goals: 0,
        total_assists: 0,
        total_clean_sheets: 0,
        total_wins: 0,
        total_losses: 0,
        total_matches: 0,
        position: member.position
      })
    })
  })

  // Get all completed matches for this event to count total matches correctly
  const { data: completedMatches, error: matchesError } = await supabase
    .from('tournament_matches')
    .select(`
      id,
      team1_id,
      team2_id,
      team1_score,
      team2_score,
      winner_id,
      status,
      tournament_brackets!inner (event_id)
    `)
    .eq('tournament_brackets.event_id', eventId)
    .eq('status', 'completed')

  if (matchesError) throw matchesError

  // Also get regular matches
  const { data: regularMatches, error: regularMatchesError } = await supabase
    .from('matches')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'completed')

  if (regularMatchesError) throw regularMatchesError

  const allCompletedMatches = [
    ...(completedMatches || []).map(m => ({ ...m, type: 'tournament' })),
    ...(regularMatches || []).map(m => ({ ...m, type: 'regular' }))
  ]

  console.log('🎮 Found', allCompletedMatches.length, 'completed matches for event')

  // Count total matches for each player based on completed matches
  allCompletedMatches.forEach(match => {
    // Find all players from both teams
    const team1 = teams.find(t => t.id === match.team1_id)
    const team2 = teams.find(t => t.id === match.team2_id)
    
    if (team1) {
      team1.members.forEach(member => {
        const playerStats = playerStatsMap.get(member.user_id)
        if (playerStats) {
          playerStats.total_matches += 1
          
          // Determine if this player's team won
          const winnerId = match.winner_id || (match.type === 'regular' ? match.winner_team_id : null)
          if (winnerId === team1.id) {
            playerStats.total_wins += 1
          } else if (winnerId === team2?.id) {
            playerStats.total_losses += 1
          }
          // If winnerId is null, it's a draw - no win or loss counted
        }
      })
    }
    
    if (team2) {
      team2.members.forEach(member => {
        const playerStats = playerStatsMap.get(member.user_id)
        if (playerStats) {
          playerStats.total_matches += 1
          
          // Determine if this player's team won
          const winnerId = match.winner_id || (match.type === 'regular' ? match.winner_team_id : null)
          if (winnerId === team2.id) {
            playerStats.total_wins += 1
          } else if (winnerId === team1?.id) {
            playerStats.total_losses += 1
          }
          // If winnerId is null, it's a draw - no win or loss counted
        }
      })
    }
  })

  // Process player match stats for goals, assists, and clean sheets
  for (const stat of eventStats) {
    const existingStats = playerStatsMap.get(stat.user_id)
    if (existingStats) {
      existingStats.total_goals += stat.goals || 0
      existingStats.total_assists += stat.assists || 0
      if (stat.clean_sheet) {
        existingStats.total_clean_sheets += 1
      }
    }
  }

  console.log('📊 Player statistics calculated for', playerStatsMap.size, 'players')
  
  // Log some sample stats for debugging
  const sampleStats = Array.from(playerStatsMap.values()).slice(0, 3)
  sampleStats.forEach(stats => {
    console.log(`👤 ${stats.username}: ${stats.total_matches} matches, ${stats.total_goals} goals, ${stats.total_wins} wins`)
  })

  return playerStatsMap
}

async function determineTournamentStandings(eventId: string, teams: Team[]): Promise<Team[]> {
  console.log('🏆 Determining tournament standings...')

  try {
    const { data: bracketData, error: bracketError } = await supabase
      .from('tournament_brackets')
      .select('*')
      .eq('event_id', eventId)
      .single()

    if (bracketError) throw bracketError

    if (bracketData.format === 'elimination') {
      const { data: finalMatches, error: finalError } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          team1:team1_id (id, name, color),
          team2:team2_id (id, name, color),
          winner:winner_id (id, name, color)
        `)
        .eq('bracket_id', bracketData.id)
        .order('round', { ascending: false })
        .limit(10)

      if (finalError) throw finalError

      const standings: Team[] = []

      if (finalMatches && finalMatches.length > 0) {
        finalMatches.sort((a, b) => b.round - a.round || b.match_number - a.match_number)

        const finalMatch = finalMatches.find(m => m.round === Math.max(...finalMatches.map(fm => fm.round)))
        if (!finalMatch) return []

        // 1st place: Winner of final
        if (finalMatch.winner) {
          standings.push(finalMatch.winner)
        }

        // 2nd place: Loser of final
        if (finalMatch.team1 && finalMatch.team2) {
          const loser = finalMatch.winner?.id === finalMatch.team1.id ? finalMatch.team2 : finalMatch.team1
          if (loser) {
            standings.push(loser)
          }
        }

        // 3rd place: Losers of semi-finals
        const semiFinalRound = finalMatch.round - 1
        if (semiFinalRound > 0) {
          const semiFinals = finalMatches.filter(m => m.round === semiFinalRound && m.status === 'completed')
          const semiFinalLosers: Team[] = []
          semiFinals.forEach(semi => {
            if (semi.team1 && semi.team2 && semi.winner) {
              const loser = semi.winner.id === semi.team1.id ? semi.team2 : semi.team1
              if (loser) {
                semiFinalLosers.push(loser)
              }
            }
          })
          standings.push(...semiFinalLosers)
        }
      }

      const uniqueStandings = Array.from(new Map(standings.map(item => [item.id, item])).values())
      return uniqueStandings

    } else {
      // For groups, calculate standings from group results
      return [...teams].sort((a, b) => a.name.localeCompare(b.name))
    }
  } catch (error) {
    console.error('Error determining standings:', error)
    return []
  }
}

function calculateEventAwards(playerStats: Map<string, PlayerStats>, standings: Team[]): EventAward[] {
  console.log('🏅 Calculating event awards...')

  const awards: EventAward[] = []
  const allStats = Array.from(playerStats.values())

  if (allStats.length === 0) return awards

  // MVP Award (best overall performance)
  const mvpCandidate = allStats.reduce((best, current) => {
    const currentScore = current.total_goals + current.total_assists + (current.total_clean_sheets * 2)
    const bestScore = best.total_goals + best.total_assists + (best.total_clean_sheets * 2)
    return currentScore > bestScore ? current : best
  }, allStats[0])

  if (mvpCandidate && (mvpCandidate.total_goals + mvpCandidate.total_assists + mvpCandidate.total_clean_sheets) > 0) {
    awards.push({
      award_type: 'mvp',
      user_id: mvpCandidate.user_id,
      username: mvpCandidate.username,
      value: mvpCandidate.total_goals + mvpCandidate.total_assists + mvpCandidate.total_clean_sheets,
      description: `${mvpCandidate.total_goals} goal, ${mvpCandidate.total_assists} assist, ${mvpCandidate.total_clean_sheets} clean sheets`
    })
  }

  // Top Scorer Award
  const topScorer = allStats.reduce((best, current) =>
    current.total_goals > best.total_goals ? current : best
  , allStats[0])

  if (topScorer && topScorer.total_goals > 0) {
    awards.push({
      award_type: 'top_scorer',
      user_id: topScorer.user_id,
      username: topScorer.username,
      value: topScorer.total_goals,
      description: `${topScorer.total_goals} goal segnati`
    })
  }

  // Top Assists Award
  const topAssists = allStats.reduce((best, current) =>
    current.total_assists > best.total_assists ? current : best
  , allStats[0])

  if (topAssists && topAssists.total_assists > 0) {
    awards.push({
      award_type: 'top_assists',
      user_id: topAssists.user_id,
      username: topAssists.username,
      value: topAssists.total_assists,
      description: `${topAssists.total_assists} assist forniti`
    })
  }

  // Best Goalkeeper Award
  const goalkeepers = allStats.filter(p =>
    p.position.toLowerCase().includes('por') ||
    p.position.toLowerCase().includes('portiere')
  )

  if (goalkeepers.length > 0) {
    const bestGK = goalkeepers.reduce((best, current) =>
      current.total_clean_sheets > best.total_clean_sheets ? current : best
    , goalkeepers[0])

    if (bestGK && bestGK.total_clean_sheets > 0) {
      awards.push({
        award_type: 'best_goalkeeper',
        user_id: bestGK.user_id,
        username: bestGK.username,
        value: bestGK.total_clean_sheets,
        description: `${bestGK.total_clean_sheets} clean sheets`
      })
    }
  }

  // Tournament Winner Award (captain of winning team)
  if (standings.length > 0 && standings[0].captain_id) {
    const winningCaptain = allStats.find(p => p.user_id === standings[0].captain_id)
    if (winningCaptain) {
      awards.push({
        award_type: 'tournament_winner',
        user_id: winningCaptain.user_id,
        username: winningCaptain.username,
        value: 1,
        description: `Capitano di ${standings[0].name} - Vincitori del torneo`
      })
    }
  }

  return awards
}

async function saveEventAwards(eventId: string, awards: EventAward[]) {
  console.log('💾 Saving event awards...')

  if (awards.length === 0) return

  const awardsToInsert = awards.map(award => ({
    event_id: eventId,
    award_type: award.award_type,
    user_id: award.user_id,
    username: award.username,
    value: award.value,
    description: award.description
  }))

  const { error } = await supabase
    .from('draft_awards')
    .insert(awardsToInsert)

  if (error) {
    console.error('Error saving awards:', error)
    throw error
  }
}

async function updatePlayerStats(playerStats: Map<string, PlayerStats>) {
  console.log('📈 Updating player stats...')

  for (const [userId, stats] of playerStats) {
    try {
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
        const { error: updateError } = await supabase
          .from('player_stats')
          .update({
            total_matches: existingStats.total_matches + stats.total_matches,
            total_goals: existingStats.total_goals + stats.total_goals,
            total_assists: existingStats.total_assists + stats.total_assists,
            total_clean_sheets: existingStats.total_clean_sheets + stats.total_clean_sheets,
            total_wins: existingStats.total_wins + stats.total_wins,
            total_losses: existingStats.total_losses + stats.total_losses,
            draft_participations: existingStats.draft_participations + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('Error updating player stats:', updateError)
          throw updateError
        }
      } else {
        const { error: insertError } = await supabase
          .from('player_stats')
          .insert({
            user_id: userId,
            username: stats.username,
            total_matches: stats.total_matches,
            total_goals: stats.total_goals,
            total_assists: stats.total_assists,
            total_clean_sheets: stats.total_clean_sheets,
            total_wins: stats.total_wins,
            total_losses: stats.total_losses,
            draft_participations: 1,
            preferred_position: stats.position
          })

        if (insertError) {
          console.error('Error creating player stats:', insertError)
          throw insertError
        }
      }
    } catch (error) {
      console.error('Error processing player stats for user:', userId, error)
      throw error
    }
  }
}

async function updateUserRankings(
  playerStats: Map<string, PlayerStats>,
  awards: EventAward[],
  standings: Team[]
) {
  console.log('🏆 Updating user rankings with all data...')

  const { data: allPlayerStats, error: statsError } = await supabase
    .from('player_stats')
    .select('*')

  if (statsError) {
    console.error('Error fetching all player stats:', statsError)
    throw statsError
  }

  const { data: allAwards, error: awardsError } = await supabase
    .from('draft_awards')
    .select('*')

  if (awardsError) {
    console.error('Error fetching all awards:', awardsError)
    throw awardsError
  }

  const { data: captainCounts, error: captainError } = await supabase
    .from('teams')
    .select('captain_id')
    .not('captain_id', 'is', null)

  if (captainError) {
    console.error('Error fetching captain counts:', captainError)
    throw captainError
  }

  const { data: tournamentWins, error: winsError } = await supabase
    .from('draft_awards')
    .select('user_id')
    .eq('award_type', 'tournament_winner')

  if (winsError) {
    console.error('Error fetching tournament wins:', winsError)
    throw winsError
  }

  const playerStatsMap = new Map(allPlayerStats?.map(p => [p.user_id, p]) || [])
  const awardsMap = new Map<string, { mvp: number, top_scorer: number, top_assists: number, best_goalkeeper: number }>()

  allAwards?.forEach(award => {
    if (!awardsMap.has(award.user_id)) {
      awardsMap.set(award.user_id, { mvp: 0, top_scorer: 0, top_assists: 0, best_goalkeeper: 0 })
    }
    const userAwards = awardsMap.get(award.user_id)!

    switch (award.award_type) {
      case 'mvp':
        userAwards.mvp += 1
        break
      case 'top_scorer':
        userAwards.top_scorer += 1
        break
      case 'top_assists':
        userAwards.top_assists += 1
        break
      case 'best_goalkeeper':
        userAwards.best_goalkeeper += 1
        break
    }
  })

  const captainCountMap = new Map<string, number>()
  captainCounts?.forEach(team => {
    if (team.captain_id) {
      captainCountMap.set(team.captain_id, (captainCountMap.get(team.captain_id) || 0) + 1)
    }
  })

  const tournamentWinsMap = new Map<string, number>()
  tournamentWins?.forEach(win => {
    tournamentWinsMap.set(win.user_id, (tournamentWinsMap.get(win.user_id) || 0) + 1)
  })

  for (const [userId, stats] of playerStatsMap) {
    try {
      const userAwards = awardsMap.get(userId) || { mvp: 0, top_scorer: 0, top_assists: 0, best_goalkeeper: 0 }
      const captainCount = captainCountMap.get(userId) || 0
      const draftsWon = tournamentWinsMap.get(userId) || 0

      const winRate = stats.total_wins + stats.total_losses > 0
        ? (stats.total_wins / (stats.total_wins + stats.total_losses)) * 100
        : 0

      const goalsPerMatch = stats.total_matches > 0
        ? stats.total_goals / stats.total_matches
        : 0

      const assistsPerMatch = stats.total_matches > 0
        ? stats.total_assists / stats.total_matches
        : 0

      const rankingPoints =
        (stats.total_wins * 3) +
        (stats.total_goals * 2) +
        (stats.total_assists * 1) +
        (stats.total_clean_sheets * 2) +
        (stats.draft_participations * 5) +
        (userAwards.mvp * 50) +
        (userAwards.top_scorer * 30) +
        (userAwards.top_assists * 25) +
        (userAwards.best_goalkeeper * 35) +
        (captainCount * 10) +
        (draftsWon * 100)

      const rankingData = {
        user_id: userId,
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
        mvp_awards: userAwards.mvp,
        top_scorer_awards: userAwards.top_scorer,
        top_assists_awards: userAwards.top_assists,
        best_goalkeeper_awards: userAwards.best_goalkeeper,
        ranking_points: Math.round(rankingPoints),
        win_rate: parseFloat(winRate.toFixed(2)),
        goals_per_match: parseFloat(goalsPerMatch.toFixed(2)),
        assists_per_match: parseFloat(assistsPerMatch.toFixed(2))
      }

      const { data: existingRanking, error: existingError } = await supabase
        .from('user_rankings')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (existingError && existingError.code !== 'PGRST116') {
        console.error('Error checking existing ranking:', existingError)
        throw existingError
      }

      if (existingRanking) {
        const { error: updateError } = await supabase
          .from('user_rankings')
          .update({
            ...rankingData,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('Error updating ranking:', updateError)
          throw updateError
        } else {
          console.log(`✅ Updated ranking for ${stats.username}`)
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_rankings')
          .insert(rankingData)

        if (insertError) {
          console.error('Error creating ranking:', insertError)
          throw insertError
        } else {
          console.log(`✅ Created ranking for ${stats.username}`)
        }
      }
    } catch (error) {
      console.error('Error processing ranking for user:', userId, error)
      throw error
    }
  }
}

async function distributeCredits(eventId: string, adminProfile: any, standings: Team[], rewardSettings: RewardSettings) {
  console.log('💰 Distributing credits...')

  if (!rewardSettings.enabled) return

  const rewardsToDistribute = []

  for (let position = 1; position <= Math.min(rewardSettings.reward_positions, standings.length); position++) {
    const team = standings[position - 1]

    let rewardAmount = rewardSettings.base_reward_amount
    if (position > 1) {
      const reduction = rewardSettings.reduction_per_position * (position - 1)
      if (rewardSettings.reduction_type === 'percentage') {
        rewardAmount = Math.round(rewardSettings.base_reward_amount * (1 - reduction / 100))
      } else {
        rewardAmount = Math.max(0, rewardSettings.base_reward_amount - reduction)
      }
    }

    const recipients = rewardSettings.only_captains
      ? team.members.filter(member => member.user_id === team.captain_id)
      : team.members

    for (const recipient of recipients) {
      rewardsToDistribute.push({
        user_id: recipient.user_id,
        event_id: eventId,
        amount: rewardAmount,
        reason: `${position}° posto - ${team.name}`,
        awarded_by: adminProfile?.id
      })
    }
  }

  if (rewardsToDistribute.length > 0) {
    const { error } = await supabase
      .from('user_credits')
      .insert(rewardsToDistribute)

    if (error) {
      console.error('Error distributing credits:', error)
      throw error
    } else {
      console.log(`✅ Distributed credits to ${rewardsToDistribute.length} players`)
    }
  }
}