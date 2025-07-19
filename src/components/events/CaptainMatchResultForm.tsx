import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Camera, Trophy, Users, Save, Target, AlertTriangle, CheckCircle, Clock, Plus, Minus, ImageIcon, Upload, X } from 'lucide-react'
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

interface PlayerStats {
  user_id: string
  username: string
  position: string
  goals: number
  assists: number
  clean_sheet: boolean
}

interface MatchResultSubmission {
  id: string
  submitted_by: string
  team_id: string
  team1_score: number
  team2_score: number
  screenshot1_url?: string
  screenshot2_url?: string
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
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [existingSubmissions, setExistingSubmissions] = useState<MatchResultSubmission[]>([])
  const [activeTab, setActiveTab] = useState<'score' | 'stats' | 'screenshots'>('score')
  
  const [uploadingScreenshots, setUploadingScreenshots] = useState<{[key: string]: boolean}>({})
  
  const [formData, setFormData] = useState({
    team1_score: 0,
    team2_score: 0,
    screenshot1_url: '', // Screenshot del risultato
    screenshot2_url: '', // Screenshot delle statistiche
    notes: ''
  })

  const [playerStats, setPlayerStats] = useState<{[key: string]: PlayerStats}>({})
  const [screenshotFiles, setScreenshotFiles] = useState<{[key: string]: File | null}>({})

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
        screenshot1_url: '',
        screenshot2_url: '',
        notes: ''
      })

      // Check if user is captain of one of the teams
      const isTeam1Captain = matchData.team1?.captain_id === user?.id
      const isTeam2Captain = matchData.team2?.captain_id === user?.id

      if (!isTeam1Captain && !isTeam2Captain) {
        throw new Error('You are not a captain of either team in this match')
      }

      const userTeamData = isTeam1Captain ? matchData.team1 : matchData.team2
      const opponentTeamData = isTeam1Captain ? matchData.team2 : matchData.team1
      
      setUserTeam(userTeamData)
      setOpponentTeam(opponentTeamData)

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

      // Initialize player stats for user's team
      const userTeamWithMembers = teamsWithMembers.find(t => t.id === userTeamData.id)
      if (userTeamWithMembers) {
        const initialStats: {[key: string]: PlayerStats} = {}
        userTeamWithMembers.members.forEach(member => {
          initialStats[member.user_id] = {
            user_id: member.user_id,
            username: member.username,
            position: member.position,
            goals: 0,
            assists: 0,
            clean_sheet: false
          }
        })
        setPlayerStats(initialStats)
      }

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

  const updatePlayerStat = (userId: string, field: 'goals' | 'assists', value: number) => {
    setPlayerStats(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: Math.max(0, value)
      }
    }))
  }

  const toggleCleanSheet = (userId: string) => {
    setPlayerStats(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        clean_sheet: !prev[userId].clean_sheet
      }
    }))
  }

  const uploadScreenshot = async (file: File, type: 'result' | 'stats'): Promise<string> => {
    if (!user) throw new Error('User not authenticated')
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}_${type}.${fileExt}`
    
    const { data, error } = await supabase.storage
      .from('match-screenshots')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from('match-screenshots')
      .getPublicUrl(fileName)

    return publicUrl
  }

  const handleFileUpload = async (file: File, type: 'screenshot1' | 'screenshot2') => {
    if (!file) return

    setUploadingScreenshots(prev => ({ ...prev, [type]: true }))
    
    try {
      const screenshotType = type === 'screenshot1' ? 'result' : 'stats'
      const url = await uploadScreenshot(file, screenshotType)
      
      setFormData(prev => ({
        ...prev,
        [`${type}_url`]: url
      }))
      
      setScreenshotFiles(prev => ({ ...prev, [type]: file }))
      toast.success(`Screenshot ${screenshotType === 'result' ? 'del risultato' : 'delle statistiche'} caricato!`)
    } catch (error) {
      console.error('Error uploading screenshot:', error)
      toast.error('Errore nel caricamento dello screenshot')
    } finally {
      setUploadingScreenshots(prev => ({ ...prev, [type]: false }))
    }
  }

  const removeScreenshot = (type: 'screenshot1' | 'screenshot2') => {
    setFormData(prev => ({
      ...prev,
      [`${type}_url`]: ''
    }))
    setScreenshotFiles(prev => ({ ...prev, [type]: null }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!match || !user || !userTeam) return

    // Validation
    if (!formData.screenshot1_url.trim()) {
      toast.error('Screenshot del risultato è obbligatorio')
      return
    }

    if (!formData.screenshot2_url.trim()) {
      toast.error('Screenshot delle statistiche è obbligatorio')
      return
    }

    setSubmitting(true)
    try {
      const submissionData = {
        match_id: matchId || null,
        tournament_match_id: tournamentMatchId || null,
        submitted_by: user.id,
        team_id: userTeam.id,
        team1_score: formData.team1_score,
        team2_score: formData.team2_score,
        screenshot_url: formData.screenshot1_url.trim(), // Use single screenshot_url field
        notes: formData.notes || null,
        status: 'pending'
      }

      const { error } = await supabase
        .from('match_result_submissions')
        .insert(submissionData)

      if (error) throw error

      console.log('✅ Match result submission created successfully')

      // Also save player stats (for future use when submission is approved)
      const statsToSave = Object.values(playerStats).map(stat => ({
        match_id: matchId || null,
        tournament_match_id: tournamentMatchId || null,
        user_id: stat.user_id,
        team_id: userTeam.id,
        username: stat.username,
        goals: stat.goals,
        assists: stat.assists,
        clean_sheet: stat.clean_sheet,
        position: stat.position
      }))

      // Note: We might want to save these stats in a temporary table or as JSON in the submission
      // For now, we'll include them in the notes as JSON
      const submissionWithStats = {
        ...submissionData,
        notes: JSON.stringify({
          notes: formData.notes,
          player_stats: statsToSave
        })
      }

      const { error: updateError } = await supabase
        .from('match_result_submissions')
        .update({ notes: submissionWithStats.notes })
        .eq('submitted_by', user.id)
        .eq(tournamentMatchId ? 'tournament_match_id' : 'match_id', tournamentMatchId || matchId)

      if (updateError) {
        console.error('⚠️ Error updating submission with stats:', updateError)
        // Don't throw error here as the main submission was successful
      }

      toast.success('Risultato inviato con successo! In attesa di approvazione admin.')
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

  const getTotalGoals = () => {
    return Object.values(playerStats).reduce((sum, player) => sum + player.goals, 0)
  }

  const getTotalAssists = () => {
    return Object.values(playerStats).reduce((sum, player) => sum + player.assists, 0)
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
          <h3 className="text-lg font-semibold text-white">Report Risultato Match</h3>
        </div>
        <div className="text-sm text-gray-400">
          Capitano: {userTeam.name}
        </div>
      </div>

      {/* Match Info */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-center space-x-8">
          <div className="text-center">
            <div className="flex items-center space-x-2 mb-2">
              {team1 && (
                <>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team1.color }} />
                  <span className="font-semibold text-white">{team1.name}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-400">VS</div>
          <div className="text-center">
            <div className="flex items-center space-x-2 mb-2">
              {team2 && (
                <>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team2.color }} />
                  <span className="font-semibold text-white">{team2.name}</span>
                </>
              )}
            </div>
          </div>
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
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
            {[
              { id: 'score', label: 'Risultato', icon: Trophy },
              { id: 'stats', label: 'Statistiche Giocatori', icon: Target },
              { id: 'screenshots', label: 'Screenshot', icon: Camera }
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Score Tab */}
            {activeTab === 'score' && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="font-semibold text-white mb-4">Risultato Finale</h4>
                <div className="flex items-center justify-center space-x-8">
                  <div className="text-center">
                    <div className="flex items-center space-x-2 mb-2">
                      {team1 && (
                        <>
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team1.color }} />
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
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team2.color }} />
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
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white">Statistiche Giocatori - {userTeam.name}</h4>
                  <div className="text-sm text-gray-400">
                    Tot: {getTotalGoals()} gol, {getTotalAssists()} assist
                  </div>
                </div>
                
                <div className="space-y-4">
                  {Object.values(playerStats).map((player) => (
                    <div key={player.user_id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h5 className="font-medium text-white">{player.username}</h5>
                          <p className="text-sm text-gray-400">{player.position}</p>
                        </div>
                        
                        {/* Clean Sheet Toggle (for goalkeepers/defenders) */}
                        {(player.position.toLowerCase().includes('por') || 
                          player.position.toLowerCase().includes('dif')) && (
                          <button
                            type="button"
                            onClick={() => toggleCleanSheet(player.user_id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              player.clean_sheet
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                          >
                            Clean Sheet
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Goals */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-2">
                            <Target className="h-3 w-3 inline mr-1" />
                            Goal
                          </label>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => updatePlayerStat(player.user_id, 'goals', player.goals - 1)}
                              className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-colors"
                            >
                              <Minus className="h-4 w-4 mx-auto" />
                            </button>
                            <span className="w-12 text-center font-bold text-white text-lg">
                              {player.goals}
                            </span>
                            <button
                              type="button"
                              onClick={() => updatePlayerStat(player.user_id, 'goals', player.goals + 1)}
                              className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold transition-colors"
                            >
                              <Plus className="h-4 w-4 mx-auto" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Assists */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-2">
                            <Users className="h-3 w-3 inline mr-1" />
                            Assist
                          </label>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => updatePlayerStat(player.user_id, 'assists', player.assists - 1)}
                              className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-colors"
                            >
                              <Minus className="h-4 w-4 mx-auto" />
                            </button>
                            <span className="w-12 text-center font-bold text-white text-lg">
                              {player.assists}
                            </span>
                            <button
                              type="button"
                              onClick={() => updatePlayerStat(player.user_id, 'assists', player.assists + 1)}
                              className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold transition-colors"
                            >
                              <Plus className="h-4 w-4 mx-auto" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Screenshots Tab */}
            {activeTab === 'screenshots' && (
              <div className="space-y-6">
                {/* Screenshot 1 - Risultato */}
                {/* Screenshot 1 - Risultato */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center">
                    <ImageIcon className="h-5 w-5 mr-2 text-blue-400" />
                    Screenshot del Risultato *
                  </h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Screenshot che mostra il risultato finale del match (schermata di fine partita)
                  </p>
                  
                  {!formData.screenshot1_url ? (
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, 'screenshot1')
                        }}
                        className="hidden"
                        id="screenshot1-upload"
                        disabled={uploadingScreenshots.screenshot1}
                      />
                      <label
                        htmlFor="screenshot1-upload"
                        className={`cursor-pointer flex flex-col items-center space-y-2 ${
                          uploadingScreenshots.screenshot1 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {uploadingScreenshots.screenshot1 ? (
                          <>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                            <span className="text-blue-400">Caricamento...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-gray-400" />
                            <span className="text-gray-400">Clicca per caricare screenshot</span>
                            <span className="text-xs text-gray-500">PNG, JPG fino a 10MB</span>
                          </>
                        )}
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <img 
                        src={formData.screenshot1_url} 
                        alt="Screenshot risultato" 
                        className="w-full h-48 object-cover rounded border border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => removeScreenshot('screenshot1')}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Screenshot 2 - Statistiche */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h4 className="font-semibold text-white mb-4 flex items-center">
                    <Target className="h-5 w-5 mr-2 text-green-400" />
                    Screenshot delle Statistiche *
                  </h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Screenshot che mostra chi ha segnato e fatto assist (schermata statistiche dettagliate)
                  </p>
                  
                  {formData.screenshot1_url && (
                    <div className="mt-3">
                      <img 
                        src={formData.screenshot1_url} 
                        alt="Screenshot risultato" 
                        className="max-w-full h-32 object-cover rounded border border-gray-600"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  {!formData.screenshot2_url ? (
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, 'screenshot2')
                        }}
                        className="hidden"
                        id="screenshot2-upload"
                        disabled={uploadingScreenshots.screenshot2}
                      />
                      <label
                        htmlFor="screenshot2-upload"
                        className={`cursor-pointer flex flex-col items-center space-y-2 ${
                          uploadingScreenshots.screenshot2 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {uploadingScreenshots.screenshot2 ? (
                          <>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
                            <span className="text-green-400">Caricamento...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-gray-400" />
                            <span className="text-gray-400">Clicca per caricare screenshot</span>
                            <span className="text-xs text-gray-500">PNG, JPG fino a 10MB</span>
                          </>
                        )}
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <img 
                        src={formData.screenshot2_url} 
                        alt="Screenshot statistiche" 
                        className="w-full h-48 object-cover rounded border border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => removeScreenshot('screenshot2')}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h4 className="font-semibold text-white mb-4">Note Aggiuntive</h4>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Aggiungi note sul match, eventi particolari, etc..."
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-700">
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
                    <span>Invia Report Completo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Already Submitted */}
      {userSubmission && (
        <div className="bg-blue-800/20 border border-blue-600 rounded-lg p-4 text-center">
          <CheckCircle className="h-8 w-8 text-blue-400 mx-auto mb-2" />
          <p className="text-blue-300 font-medium">Hai già inviato il report completo per questo match</p>
          <p className="text-blue-200 text-sm mt-1">
            Stato: {getSubmissionStatus(userSubmission).label}
          </p>
        </div>
      )}
    </div>
  )
}