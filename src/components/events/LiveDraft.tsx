import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Play, Users, Trophy, Clock, Crown } from 'lucide-react'
import toast from 'react-hot-toast'

interface Team {
  id: string
  name: string
  captain_id?: string
  color: string
  captain?: {
    username: string
  }
  members: Array<{
    username: string
    position: string
    pick_order: number
  }>
}

interface Player {
  id: string
  user_id: string
  username: string
  preferred_position: string
  platform: string
}

interface LiveDraftProps {
  eventId: string
}

export function LiveDraft({ eventId }: LiveDraftProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [currentPick, setCurrentPick] = useState<{ round: number; teamIndex: number; pickNumber: number }>({
    round: 1,
    teamIndex: 0,
    pickNumber: 1
  })
  const [isDraftActive, setIsDraftActive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDraftData()

    // Set up real-time subscriptions
    const teamsSubscription = supabase
      .channel(`teams-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'team_members' },
        () => fetchDraftData()
      )
      .subscribe()

    return () => {
      teamsSubscription.unsubscribe()
    }
  }, [eventId])

  const fetchDraftData = async () => {
    try {
      // Fetch teams with their captains and members
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          *,
          team_members (
            username,
            position,
            pick_order
          )
        `)
        .eq('event_id', eventId)
        .order('name')

      if (teamsError) throw teamsError

      // Fetch team captains info
      const teamsWithCaptains = await Promise.all(
        (teamsData || []).map(async (team) => {
          let captain = null
          if (team.captain_id) {
            const { data: captainData } = await supabase
              .from('registrations')
              .select('username')
              .eq('user_id', team.captain_id)
              .eq('event_id', eventId)
              .single()
            
            if (captainData) {
              captain = { username: captainData.username }
            }
          }
          
          return {
            ...team,
            captain,
            members: team.team_members || []
          }
        })
      )

      // Fetch available players (approved but not drafted)
      const { data: playersData, error: playersError } = await supabase
        .from('registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'approved')

      if (playersError) throw playersError

      // Filter out players who are already drafted
      const { data: draftedPlayers, error: draftedError } = await supabase
        .from('team_members')
        .select('user_id')
        .in('team_id', teamsWithCaptains.map(t => t.id))

      if (draftedError) throw draftedError

      const draftedUserIds = new Set(draftedPlayers?.map(p => p.user_id) || [])
      const available = (playersData || []).filter(p => !draftedUserIds.has(p.user_id))

      setTeams(teamsWithCaptains)
      setAvailablePlayers(available)

      // Calculate current pick
      const totalDrafted = teamsWithCaptains.reduce((sum, team) => sum + team.members.length, 0)
      const teamCount = teamsWithCaptains.length
      if (teamCount > 0) {
        const round = Math.floor(totalDrafted / teamCount) + 1
        const pickInRound = totalDrafted % teamCount
        
        // Snake draft logic
        let teamIndex
        if (round % 2 === 1) {
          teamIndex = pickInRound
        } else {
          teamIndex = teamCount - 1 - pickInRound
        }
        
        setCurrentPick({
          round,
          teamIndex,
          pickNumber: totalDrafted + 1
        })
      }

    } catch (error) {
      console.error('Error fetching draft data:', error)
      toast.error('Failed to load draft data')
    } finally {
      setLoading(false)
    }
  }

  const draftPlayer = async (playerId: string, playerUsername: string) => {
    if (!isDraftActive || teams.length === 0) return

    const currentTeam = teams[currentPick.teamIndex]
    if (!currentTeam) return

    try {
      // Add player to team
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: currentTeam.id,
          user_id: playerId,
          username: playerUsername,
          position: availablePlayers.find(p => p.user_id === playerId)?.preferred_position || 'Player',
          pick_order: currentPick.pickNumber
        })

      if (memberError) throw memberError

      // Record the draft pick
      const { error: pickError } = await supabase
        .from('draft_picks')
        .insert({
          event_id: eventId,
          team_id: currentTeam.id,
          user_id: playerId,
          username: playerUsername,
          pick_number: currentPick.pickNumber,
          round: currentPick.round
        })

      if (pickError) throw pickError

      toast.success(`${playerUsername} drafted to ${currentTeam.name}!`)
      
      // Refresh data (real-time subscription will handle this)
    } catch (error) {
      console.error('Error drafting player:', error)
      toast.error('Failed to draft player')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  const currentTeam = teams[currentPick.teamIndex]
  const allPlayersDrafted = availablePlayers.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Play className="h-6 w-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Live Draft</h3>
        </div>
        
        <div className="flex items-center space-x-4">
          {!allPlayersDrafted && (
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4 text-blue-400" />
                <span className="text-gray-300">
                  Round {currentPick.round} • Pick #{currentPick.pickNumber}
                </span>
              </div>
              {currentTeam && (
                <p className="text-xs text-gray-400 mt-1">
                  <span style={{ color: currentTeam.color }}>■</span> {currentTeam.name}'s turn
                </p>
              )}
            </div>
          )}
          
          <button
            onClick={() => setIsDraftActive(!isDraftActive)}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              isDraftActive
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isDraftActive ? 'Pause Draft' : 'Start Draft'}
          </button>
        </div>
      </div>

      {allPlayersDrafted && (
        <div className="bg-green-800/20 border border-green-600 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-green-400">
            <Trophy className="h-5 w-5" />
            <p className="font-medium">Draft Complete!</p>
          </div>
          <p className="text-green-300 text-sm mt-1">
            All players have been drafted. You can now generate the tournament bracket.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="font-semibold text-white flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Teams
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team, index) => (
              <div 
                key={team.id} 
                className={`bg-gray-700 rounded-lg p-4 border-2 transition-colors ${
                  index === currentPick.teamIndex && isDraftActive && !allPlayersDrafted
                    ? 'border-yellow-400 bg-gray-600' 
                    : 'border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <h5 className="font-semibold text-white">{team.name}</h5>
                    {index === currentPick.teamIndex && isDraftActive && !allPlayersDrafted && (
                      <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
                        PICKING
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {team.members.length} players
                  </span>
                </div>
                
                <div className="space-y-2">
                  {team.captain && (
                    <div className="flex items-center space-x-2 p-2 bg-gray-600 rounded">
                      <Crown className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm font-medium text-white">{team.captain.username}</span>
                      <span className="text-xs text-gray-400">Captain</span>
                    </div>
                  )}
                  
                  {team.members
                    .sort((a, b) => a.pick_order - b.pick_order)
                    .map((member, memberIndex) => (
                      <div key={memberIndex} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                        <span className="text-sm text-white">{member.username}</span>
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          <span>{member.position}</span>
                          <span>#{member.pick_order}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Available Players */}
        <div className="space-y-4">
          <h4 className="font-semibold text-white flex items-center">
            Available Players ({availablePlayers.length})
          </h4>
          
          {availablePlayers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">All players have been drafted!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availablePlayers.map((player) => (
                <div key={player.id} className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{player.username}</p>
                      <p className="text-sm text-gray-400">{player.preferred_position} • {player.platform}</p>
                    </div>
                    
                    {isDraftActive && currentTeam && (
                      <button
                        onClick={() => draftPlayer(player.user_id, player.username)}
                        className="px-3 py-1 text-sm font-medium rounded text-white hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: currentTeam.color }}
                      >
                        Draft
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}