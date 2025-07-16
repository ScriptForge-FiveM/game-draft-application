import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Camera, Trophy, Users, Upload, Save, Target, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
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

interface Match {
  id: string
  event_id: string
  team1_id: string
  team2_id: string
  team1_score: number
  team2_score: number
  status: 'pending' | 'completed' | 'cancelled'
  team1?: Team
  team2?: Team
}

interface TournamentMatch {
  id: string
  bracket_id: string
  team1_id: string
  team2_id: string
  team1_score: number
  team2_score: number
  status: 'pending' | 'completed' | 'cancelled'
  team1?: Team
  team2?: Team
}

interface MatchResultSubmission {
  id: string
  submitted_by: string
  team_id: string
  team1_score: number
  team2_score: number
  screenshot_url?: string
  notes?: string
  status: 'pending' | 'approved' | 'rejected' | 'conflicted'
  created_at: string
  submitter?: {
    username: string
  }
}

interface CaptainMatchResultFormProps {
  matchId?: string
  tournamentMatchId?: string
  onClose: () => void
  onSubmitted?: () => void
}

export function CaptainMatchResultForm({ matchId, tournamentMatchId, onClose, onSubmitted }: CaptainMatchResultFormProps) {
  const { user } = useAuth()
  const [match, setMatch] = useState<Match | TournamentMatch | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [userTeam, setUserTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [existingSubmissions, setExistingSubmissions] = useState<MatchResultSubmission[]>([])
  const [formData, setFormData] = useState({
    team1_score: 0,
    team2_score: 0,
    screenshot_url: '',
    notes: ''
  })

  useEffect(() => {
    if ((matchId || tournamentMatchId) && user) {
      fetchMatchData()
    }
  }, [matchId, tournamentMatchId, user])

  const fetchMatchData = async () => {
    try {
      setLoading(true)
      let matchData = null
      let eventId = null

      if (tournamentMatchId) {
        // Fetch tournament match
        const { data: tournamentMatch, error: tournamentError } = await supabase
          .from('tournament_matches')
          .select(`
            *,
            team1:team1_id (id, name, color, captain_id),
            team2:team2_id (id, name, color, captain_id),
            tournament_brackets!inner (event_id)
          `)
          .eq('id', tournamentMatchId)
          .single()

        if (tournamentError) throw tournamentError
        matchData = tournamentMatch
        eventId = tournamentMatch.tournament_brackets.event_id
      } else if (matchId) {
        // Fetch regular match
        const { data: regularMatch, error: regularError } = await supabase
          .from('matches')
          .select(`
            *,
            team1:team1_id (id, name, color, captain_id),
            team2:team2_id (id, name, color, captain_id)
          `)
          .eq('id', matchId)
          .single()

        if (regularError) throw regularError
        matchData = regularMatch
        eventId = regularMatch.event_id
      }

      if (!matchData) throw new Error('Match not found')

      setMatch(matchData)
      setFormData({
        team1_score: matchData.team1_score || 0,
        team2_score: matchData.team2_score || 0,
        screenshot_url: '',
        notes: ''
      })

      // Check if user is captain of one of the teams
      const isTeam1Captain = matchData.team1?.captain_id === user?.id
      const isTeam2Captain = matchData.team2?.captain_id === user?.id

      if (!isTeam1Captain && !isTeam2Captain) {
        throw new Error('You are not a captain of either team in this match')
      }

      setUserTeam(isTeam1Captain ? matchData.team1 : matchData.team2)

      // Fetch team members
      const teamIds = [matchData.team1_id, matchData.team2_id].filter(Boolean)
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
        .in('id', teamIds)

      if (teamsError) throw teamsError

      const teamsWithMembers = (teamsData || []).map(team => ({
        ...team,
        members: team.team_members || []
      }))

      setTeams(teamsWithMembers)

      // Fetch existing submissions for this match
      const { data: submissions, error: submissionsError } = await supabase
        .from('match_result_submissions')
        .select(`
          *,
          submitter:submitted_by (
            username:profiles(username)
          )
        `)
        .eq(tournamentMatchId ? 'tournament_match_id' : 'match_id', tournamentMatchId || matchId)
        .order('created_at', { ascending: false })

      if (submissionsError) throw submissionsError

      setExistingSubmissions(submissions || [])

    } catch (error) {
      console.error('Error fetching match data:', error)
      toast.error('Errore nel caricamento dei dati del match')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!match || !user || !userTeam) return

    setSubmitting(true)
    try {
      const submissionData = {
        ...(tournamentMatchId ? { tournament_match_id: tournamentMatchId } : { match_id: matchId }),
        submitted_by: user.id,
        team_id: userTeam.id,
        team1_score: formData.team1_score,
        team2_score: formData.team2_score,
        screenshot_url: formData.screenshot_url || null,
        notes: formData.notes || null,
        status: 'pending'
      }

      const { error } = await supabase
        .from('match_result_submissions')
        .insert(submissionData)

      if (error) throw error

      toast.success('Risultato inviato! In attesa di approvazione admin.')
      onSubmitted?.()
      onClose()
    } catch (error) {
      console.error('Error submitting match result:', error)
      toast.error('Errore nell\'invio del risultato')
    } finally {
      setSubmitting(false)
    }
  }

  const getSubmissionStatus = (submission: MatchResultSubmission) => {
    switch (submission.status) {
      case 'pending':
        return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'In Attesa' }
      case 'approved':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: 'Approvato' }
      case 'rejected':
        return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100', label: 'Rifiutato' }
      case 'conflicted':
        return { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100', label: 'Conflitto' }
      default:
        return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Sconosciuto' }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!match || !userTeam) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-400">Non sei autorizzato a inviare risultati per questo match</p>
      </div>
    )
  }

  const team1 = teams.find(t => t.id === match.team1_id)
  const team2 = teams.find(t => t.id === match.team2_id)
  const userSubmission = existingSubmissions.find(s => s.submitted_by === user?.id)
  const otherSubmissions = existingSubmissions.filter(s => s.submitted_by !== user?.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Trophy className="h-6 w-6 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Invia Risultato Match</h3>
        </div>
        <div className="text-sm text-gray-400">
          Capitano: {userTeam.name}
        </div>
      </div>

      {/* Existing Submissions */}
      {existingSubmissions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-3">Risultati Inviati</h4>
          <div className="space-y-3">
            {existingSubmissions.map((submission) => {
              const status = getSubmissionStatus(submission)
              const StatusIcon = status.icon
              const isUserSubmission = submission.submitted_by === user?.id
              
              return (
                <div key={submission.id} className={`p-3 rounded border ${
                  isUserSubmission ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600 bg-gray-700'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">
                        {isUserSubmission ? 'Il tuo risultato' : `Risultato di ${submission.submitter?.username || 'Altro capitano'}`}
                      </span>
                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${status.bg}`}>
                        <StatusIcon className={`h-3 w-3 ${status.color}`} />
                        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                      </div>
                    </div>
                    <span className="text-white font-bold">
                      {submission.team1_score} - {submission.team2_score}
                    </span>
                  </div>
                  {submission.notes && (
                    <p className="text-sm text-gray-300">{submission.notes}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(submission.created_at).toLocaleString('it-IT')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Conflict Warning */}
      {otherSubmissions.length > 0 && !userSubmission && (
        <div className="bg-orange-800/20 border border-orange-600 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-orange-300">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-medium">Attenzione: L'altro capitano ha già inviato un risultato</p>
          </div>
          <p className="text-orange-200 text-sm mt-1">
            Se il tuo risultato è diverso, verrà creato un conflitto che dovrà essere risolto da un admin.
          </p>
        </div>
      )}

      {/* Form */}
      {!userSubmission && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Score Input */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h4 className="font-semibold text-white mb-4">Risultato Finale</h4>
            <div className="flex items-center justify-center space-x-8">
              <div className="text-center">
                <div className="flex items-center space-x-2 mb-2">
                  {team1 && (
                    <>
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: team1.color }}
                      />
                      <span className="font-semibold text-white">{team1.name}</span>
                    </>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.team1_score}
                  onChange={(e) => setFormData(prev => ({ ...prev, team1_score: parseInt(e.target.value) || 0 }))}
                  className="w-20 h-16 text-3xl font-bold text-center bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                />
              </div>
              
              <div className="text-2xl font-bold text-gray-400">VS</div>
              
              <div className="text-center">
                <div className="flex items-center space-x-2 mb-2">
                  {team2 && (
                    <>
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: team2.color }}
                      />
                      <span className="font-semibold text-white">{team2.name}</span>
                    </>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.team2_score}
                  onChange={(e) => setFormData(prev => ({ ...prev, team2_score: parseInt(e.target.value) || 0 }))}
                  className="w-20 h-16 text-3xl font-bold text-center bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Screenshot */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center">
              <Camera className="h-5 w-5 mr-2" />
              Screenshot del Risultato (Opzionale)
            </h4>
            <input
              type="url"
              value={formData.screenshot_url}
              onChange={(e) => setFormData(prev => ({ ...prev, screenshot_url: e.target.value }))}
              placeholder="URL dello screenshot..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
            />
          </div>

          {/* Notes */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h4 className="font-semibold text-white mb-4">Note Aggiuntive (Opzionale)</h4>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Aggiungi note sul match..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 resize-none"
            />
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
                  <span>Inviando...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Invia Risultato</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Already Submitted */}
      {userSubmission && (
        <div className="bg-blue-800/20 border border-blue-600 rounded-lg p-4 text-center">
          <CheckCircle className="h-8 w-8 text-blue-400 mx-auto mb-2" />
          <p className="text-blue-300 font-medium">Hai già inviato il risultato per questo match</p>
          <p className="text-blue-200 text-sm mt-1">
            Stato: {getSubmissionStatus(userSubmission).label}
          </p>
        </div>
      )}
    </div>
  )
}