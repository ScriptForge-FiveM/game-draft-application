import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Camera, Trophy, Users, Upload, Save, Target } from 'lucide-react'
import toast from 'react-hot-toast'

interface Team {
  id: string
  name: string
  color: string
  members: Array<{
    user_id: string
    username: string
    position: string
  }>
}

interface Match {
  id: string
  event_id: string
  team1_id: string
  team2_id: string
  team1_score: number
  team2_score: number
  status: 'pending' | 'completed' | 'cancelled'
  screenshot1_url?: string
  screenshot2_url?: string
}

interface MatchResultFormProps {
  eventId: string
  matchId?: string
  onClose: () => void
  onResult?: (team1Score: number, team2Score: number, winnerId?: string) => void
}

export function MatchResultForm({ eventId, matchId, onClose, onResult }: MatchResultFormProps) {
  const { user } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    team1_score: 0,
    team2_score: 0,
    screenshot1_url: '',
    screenshot2_url: ''
  })
  const [playerStats, setPlayerStats] = useState<{[key: string]: { goals: number, assists: number }}>({})

  useEffect(() => {
    if (matchId) {
      fetchMatchData()
    } else {
      fetchTeams()
    }
  }, [eventId, matchId])

  const fetchMatchData = async () => {
    try {
      // Try tournament matches first, then regular matches
      let matchData = null
      let matchError = null
      
      const { data: tournamentMatch, error: tournamentError } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          team1:team1_id (id, name, color),
          team2:team2_id (id, name, color)
        `)
        .eq('id', matchId)
        .single()
      
      if (tournamentMatch) {
        matchData = {
          id: tournamentMatch.id,
          event_id: eventId,
          team1_id: tournamentMatch.team1_id,
          team2_id: tournamentMatch.team2_id,
          team1_score: tournamentMatch.team1_score,
          team2_score: tournamentMatch.team2_score,
          status: tournamentMatch.status
        }
      } else {
        const { data: regularMatch, error: regularError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single()
        
        matchData = regularMatch
        matchError = regularError
      }

      if (matchError) throw matchError

      setMatch(matchData)
      setFormData({
        team1_score: matchData.team1_score,
        team2_score: matchData.team2_score,
        screenshot1_url: matchData.screenshot1_url || '',
        screenshot2_url: matchData.screenshot2_url || ''
      })

      // Fetch teams for this match
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
        .in('id', [matchData.team1_id, matchData.team2_id])

      if (teamsError) throw teamsError

      const teamsWithMembers = (teamsData || []).map(team => ({
        ...team,
        members: team.team_members || []
      }))

      setTeams(teamsWithMembers)

      // Fetch existing player match stats
      const { data: existingStats, error: statsError } = await supabase
        .from('player_match_stats')
        .select('*')
        .eq('match_id', matchId)

      if (statsError) throw statsError

      const statsMap: {[key: string]: { goals: number, assists: number }} = {}
      existingStats?.forEach(stat => {
        statsMap[stat.user_id] = {
          goals: stat.goals,
          assists: stat.assists
        }
      })
      setPlayerStats(statsMap)

    } catch (error) {
      console.error('Error fetching match data:', error)
      toast.error('Errore nel caricamento dei dati del match')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async () => {
    try {
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
        .eq('event_id', eventId)

      if (teamsError) throw teamsError

      const teamsWithMembers = (teamsData || []).map(team => ({
        ...team,
        members: team.team_members || []
      }))

      setTeams(teamsWithMembers)
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast.error('Errore nel caricamento delle squadre')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayerStatChange = (userId: string, field: 'goals' | 'assists', value: number) => {
    setPlayerStats(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: Math.max(0, value)
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!match || !user) return

    setSubmitting(true)
    try {
      // Determine winner
      let winnerId = null
      if (formData.team1_score > formData.team2_score) {
        winnerId = match.team1_id
      } else if (formData.team2_score > formData.team1_score) {
        winnerId = match.team2_id
      }

      // Call the onResult callback if provided (for tournament matches)
      if (onResult) {
        onResult(formData.team1_score, formData.team2_score, winnerId)
      } else {
        // Update regular match
        const { error: matchError } = await supabase
          .from('matches')
          .update({
            team1_score: formData.team1_score,
            team2_score: formData.team2_score,
            winner_team_id: winnerId,
            status: 'completed',
            screenshot1_url: formData.screenshot1_url || null,
            screenshot2_url: formData.screenshot2_url || null,
            submitted_by: user.id
          })
          .eq('id', match.id)

        if (matchError) throw matchError
      }
      // Delete existing player match stats
      await supabase
        .from('player_match_stats')
        .delete()
        .eq('match_id', match.id)

      // Insert new player match stats
      const statsToInsert = []
      for (const team of teams) {
        for (const member of team.members) {
          const stats = playerStats[member.user_id] || { goals: 0, assists: 0 }
          statsToInsert.push({
            match_id: match.id,
            user_id: member.user_id,
            team_id: team.id,
            username: member.username,
            goals: stats.goals,
            assists: stats.assists,
            position: member.position,
            clean_sheet: false // Will be set by trigger
          })
        }
      }

      if (statsToInsert.length > 0) {
        const { error: statsError } = await supabase
          .from('player_match_stats')
          .insert(statsToInsert)

        if (statsError) throw statsError
      }

      toast.success('Risultato del match salvato con successo!')
      onClose()
    } catch (error) {
      console.error('Error submitting match result:', error)
      toast.error('Errore nel salvataggio del risultato')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Match non trovato</p>
      </div>
    )
  }

  const team1 = teams.find(t => t.id === match.team1_id)
  const team2 = teams.find(t => t.id === match.team2_id)

  if (!team1 || !team2) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Squadre non trovate</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Trophy className="h-6 w-6 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Risultato Match</h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Score Input */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="font-semibold text-white mb-4">Risultato Finale</h4>
          <div className="flex items-center justify-center space-x-8">
            <div className="text-center">
              <div className="flex items-center space-x-2 mb-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: team1.color }}
                />
                <span className="font-semibold text-white">{team1.name}</span>
              </div>
              <input
                type="number"
                min="0"
                max="20"
                value={formData.team1_score}
                onChange={(e) => setFormData(prev => ({ ...prev, team1_score: parseInt(e.target.value) || 0 }))}
                className="w-20 h-16 text-3xl font-bold text-center bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
            
            <div className="text-2xl font-bold text-gray-400">VS</div>
            
            <div className="text-center">
              <div className="flex items-center space-x-2 mb-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: team2.color }}
                />
                <span className="font-semibold text-white">{team2.name}</span>
              </div>
              <input
                type="number"
                min="0"
                max="20"
                value={formData.team2_score}
                onChange={(e) => setFormData(prev => ({ ...prev, team2_score: parseInt(e.target.value) || 0 }))}
                className="w-20 h-16 text-3xl font-bold text-center bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
          </div>
        </div>

        {/* Screenshots */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="font-semibold text-white mb-4 flex items-center">
            <Camera className="h-5 w-5 mr-2" />
            Screenshot del Risultato
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Screenshot 1</label>
              <input
                type="url"
                value={formData.screenshot1_url}
                onChange={(e) => setFormData(prev => ({ ...prev, screenshot1_url: e.target.value }))}
                placeholder="URL dello screenshot..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Screenshot 2</label>
              <input
                type="url"
                value={formData.screenshot2_url}
                onChange={(e) => setFormData(prev => ({ ...prev, screenshot2_url: e.target.value }))}
                placeholder="URL dello screenshot..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
          </div>
        </div>

        {/* Player Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[team1, team2].map((team) => (
            <div key={team.id} className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                <h4 className="font-semibold text-white">{team.name}</h4>
              </div>
              
              <div className="space-y-3">
                {team.members.map((member) => {
                  const stats = playerStats[member.user_id] || { goals: 0, assists: 0 }
                  
                  return (
                    <div key={member.user_id} className="bg-gray-700 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-white">{member.username}</p>
                          <p className="text-sm text-gray-400">{member.position}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            <Target className="h-3 w-3 inline mr-1" />
                            Goal
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={stats.goals}
                            onChange={(e) => handlePlayerStatChange(member.user_id, 'goals', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">
                            <Users className="h-3 w-3 inline mr-1" />
                            Assist
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={stats.assists}
                            onChange={(e) => handlePlayerStatChange(member.user_id, 'assists', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm bg-gray-600 border border-gray-500 rounded text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Salva Risultato</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}