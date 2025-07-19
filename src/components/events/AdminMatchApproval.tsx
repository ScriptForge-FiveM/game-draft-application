import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { CheckCircle, XCircle, AlertTriangle, Clock, Trophy, Users, Camera, MessageSquare, Edit3, Gavel, Eye, EyeOff, Target, Save, X, Filter, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface MatchResultSubmission {
  id: string
  match_id?: string
  tournament_match_id?: string
  submitted_by: string
  team_id: string
  team1_score: number
  team2_score: number
  screenshot_url?: string
  notes?: string
  status: 'pending' | 'approved' | 'rejected' | 'conflicted'
  admin_notes?: string
  approved_by?: string
  created_at: string
  submitter?: {
    username: string
  }
  team?: {
    name: string
    color: string
  }
  match?: {
    event_id: string
    team1?: { name: string, color: string }
    team2?: { name: string, color: string }
    scheduled_at?: string
  }
  tournament_match?: {
    tournament_brackets: {
      event_id: string
    }
    team1?: { name: string, color: string }
    team2?: { name: string, color: string }
    scheduled_at?: string
  }
}

interface PlayerStats {
  user_id: string
  username: string
  position: string
  goals: number
  assists: number
  clean_sheet: boolean
}

interface AdminMatchApprovalProps {
  eventId?: string
}

export function AdminMatchApproval({ eventId }: AdminMatchApprovalProps) {
  const { profile } = useAuth()
  const [submissions, setSubmissions] = useState<MatchResultSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'conflicted'>('all')
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [editingMatch, setEditingMatch] = useState<string | null>(null)
  const [editedScores, setEditedScores] = useState({ team1_score: 0, team2_score: 0 })
  const [showTableAssignment, setShowTableAssignment] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (profile?.is_admin) {
      fetchSubmissions()
    }
  }, [profile, eventId])

  const fetchSubmissions = async () => {
    try {
      console.log('🔍 Fetching submissions for event:', eventId)
      
      // Try the optimized query first
const { data, error } = await supabase
  .from('match_result_submissions')
  .select(`
    *,
    team:team_id (
      name,
      color
    ),
    match:match_id (
      event_id,
      scheduled_at,
      team1:team1_id (
        id,
        name,
        color
      ),
      team2:team2_id (
        id,
        name,
        color
      )
    ),
    tournament_match:tournament_match_id (
      scheduled_at,
      tournament_brackets (event_id),
      team1:team1_id (
        id,
        name,
        color
      ),
      team2:team2_id (
        id,
        name,
        color
      )
    )
  `)
  .order('created_at', { ascending: false })


      if (error) {
        console.error('❌ Error with optimized query, using fallback:', error)
        // Fallback to simple query
        const { data: simpleData, error: simpleError } = await supabase
          .from('match_result_submissions')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (simpleError) throw simpleError
        
        // Manually fetch related data
        const submissionsWithData = await Promise.all(
          (simpleData || []).map(async (submission) => {
            // Get submitter profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', submission.submitted_by)
              .single()
            
            // Get team data
            const { data: team } = await supabase
              .from('teams')
             .select('id, name, color')
              .eq('id', submission.team_id)
              .single()
            
            // Get match data
            let match = null
            let tournament_match = null
            
            if (submission.match_id) {
              const { data: matchData } = await supabase
                .from('matches')
                .select(`
                  event_id,
                  scheduled_at,
                 team1:team1_id (id, name, color),
                 team2:team2_id (id, name, color)
                `)
                .eq('id', submission.match_id)
                .single()
              match = matchData
            }
            
            if (submission.tournament_match_id) {
              const { data: tournamentMatchData } = await supabase
                .from('tournament_matches')
                .select(`
                  scheduled_at,
                  tournament_brackets (event_id),
                 team1:team1_id (id, name, color),
                 team2:team2_id (id, name, color)
                `)
                .eq('id', submission.tournament_match_id)
                .single()
              tournament_match = tournamentMatchData
            }
            
            return {
              ...submission,
              submitter: profile,
              team,
              match,
              tournament_match
            }
          })
        )
        
        setSubmissions(submissionsWithData)
        return
      }

      console.log('📋 Raw submissions data:', data)

      // Filter by event ID
      let filteredData = data || []
      if (eventId) {
        filteredData = filteredData.filter(submission => {
          if (submission.match && submission.match.event_id === eventId) return true
          if (submission.tournament_match && 
              submission.tournament_match.tournament_brackets && 
              submission.tournament_match.tournament_brackets.event_id === eventId) return true
          return false
        })
      }

      // Mark conflicted submissions
      const submissionGroups = new Map()
      filteredData.forEach(submission => {
        const matchKey = submission.match_id || submission.tournament_match_id
        if (!submissionGroups.has(matchKey)) {
          submissionGroups.set(matchKey, [])
        }
        submissionGroups.get(matchKey).push(submission)
      })

      const processedSubmissions = filteredData.map(submission => {
        const matchKey = submission.match_id || submission.tournament_match_id
        const matchSubmissions = submissionGroups.get(matchKey)
        
        if (matchSubmissions.length > 1 && submission.status === 'pending') {
          const scores = matchSubmissions.map(s => `${s.team1_score}-${s.team2_score}`)
          const uniqueScores = new Set(scores)
          
          if (uniqueScores.size > 1) {
            return { ...submission, status: 'conflicted' as const }
          }
        }
        
        return submission
      })

      setSubmissions(processedSubmissions)
    } catch (error) {
      console.error('Error fetching submissions:', error)
      toast.error('Errore nel caricamento delle submission')
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPlayerStats = async (submissionId: string) => {
    try {
      const submission = submissions.find(s => s.id === submissionId)
      if (!submission) return

      if (submission.notes) {
        try {
          const parsedNotes = JSON.parse(submission.notes)
          if (parsedNotes.player_stats) {
            setPlayerStats(parsedNotes.player_stats)
            return
          }
        } catch (e) {
          console.log('Notes are not JSON, treating as regular text')
        }
      }

      setPlayerStats([])
    } catch (error) {
      console.error('Error fetching player stats:', error)
      setPlayerStats([])
    }
  }

  const handleApproval = async (submissionId: string, action: 'approve' | 'reject') => {
    setProcessing(true)
    try {
      const submission = submissions.find(s => s.id === submissionId)
      if (!submission) throw new Error('Submission not found')

      // Debug logs at the beginning of handleApproval
      console.log('Debug: Inizio handleApproval per submission:', submission.id);
      console.log('Debug: submission.match:', submission.match);
      console.log('Debug: submission.tournament_match:', submission.tournament_match);

      // Update submission status
      const { error: updateError } = await supabase
        .from('match_result_submissions')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          admin_notes: adminNotes || null,
          approved_by: action === 'approve' ? (await supabase.auth.getUser()).data.user?.id : null
        })
        .eq('id', submissionId)

      if (updateError) throw updateError

      if (action === 'approve') {
         
        // Update the actual match
        let winnerId = null
        console.log('Debug: Scores from submission:', submission.team1_score, submission.team2_score);
        console.log('Debug: Match Team1 ID:', submission.match?.team1?.id || submission.tournament_match?.team1?.id);
        console.log('Debug: Match Team2 ID:', submission.match?.team2?.id || submission.tournament_match?.team2?.id);
  if (submission.notes) {
    try {
      const { player_stats } = JSON.parse(submission.notes)
      if (Array.isArray(player_stats) && player_stats.length > 0) {
        // mappa i dati in insertable rows
        const rowsToInsert = player_stats.map((ps: any) => ({
          match_id: submission.match_id || submission.tournament_match_id!,
          user_id: ps.user_id,
          team_id: ps.team_id,
          username: ps.username,
          goals: ps.goals || 0,
          assists: ps.assists || 0,
          clean_sheet: Boolean(ps.clean_sheet),
          position: ps.position
        }))

        const { error: statsError } = await supabase
          .from('player_match_stats')
          .insert(rowsToInsert)

        if (statsError) {
          console.error('Errore inserendo player_match_stats:', statsError)
          throw statsError
        }
      }
    } catch (e) {
      console.warn('Non ho potuto parsare submission.notes per player_stats:', e)
    }
  } 
        if (submission.team1_score > submission.team2_score) {
          // Team 1 wins
          winnerId = submission.match?.team1?.id || submission.tournament_match?.team1?.id || null
          console.log('Debug: winnerId set to team1_id:', winnerId);
        } else if (submission.team2_score > submission.team1_score) {
          // Team 2 wins  
          winnerId = submission.match?.team2?.id || submission.tournament_match?.team2?.id || null
          console.log('Debug: winnerId set to team2_id:', winnerId);
        } else {
          console.log('Debug: Scores are equal, winnerId remains null.');
        }
        console.log('Debug: Final winnerId before DB update:', winnerId);
        
        if (submission.match_id) {
          const { error: matchError } = await supabase
            .from('matches')
            .update({
              team1_score: submission.team1_score,
              team2_score: submission.team2_score,
              winner_team_id: winnerId,
              status: 'completed'
            })
            .eq('id', submission.match_id)

          if (matchError) throw matchError
        } else if (submission.tournament_match_id) {
          const { error: tournamentMatchError } = await supabase
            .from('tournament_matches')
            .update({
              team1_score: submission.team1_score,
              team2_score: submission.team2_score,
              winner_id: winnerId,
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', submission.tournament_match_id)

          if (tournamentMatchError) {
            console.error('❌ Errore nell\'aggiornamento di tournament_matches:', tournamentMatchError);
            throw tournamentMatchError;
          }
          console.log('✅ Tournament match updated successfully with winner_id:', winnerId);
        }

        // Reject other pending submissions for the same match
        const matchKey = submission.match_id || submission.tournament_match_id
        const otherSubmissions = submissions.filter(s => 
          s.id !== submissionId && 
          (s.match_id === matchKey || s.tournament_match_id === matchKey) &&
          s.status === 'pending'
        )

        if (otherSubmissions.length > 0) {
          const { error: rejectError } = await supabase
            .from('match_result_submissions')
            .update({ 
              status: 'rejected',
              admin_notes: 'Automatically rejected - another submission was approved'
            })
            .in('id', otherSubmissions.map(s => s.id))

          if (rejectError) throw rejectError
        }
      }

      toast.success(`Submission ${action === 'approve' ? 'approvata' : 'rifiutata'}!`)
      setSelectedSubmission(null)
      setAdminNotes('')
      fetchSubmissions()
    } catch (error) {
      console.error('Error processing submission:', error)
      toast.error('Errore nel processare la submission')
    } finally {
      setProcessing(false)
    }
  }

  const handleEditMatch = async (submissionId: string) => {
    setProcessing(true)
    try {
      const submission = submissions.find(s => s.id === submissionId)
      if (!submission) throw new Error('Submission not found')

      // Update submission
      const { error: updateError } = await supabase
        .from('match_result_submissions')
        .update({
          team1_score: editedScores.team1_score,
          team2_score: editedScores.team2_score,
          admin_notes: `Risultato modificato dall'admin: ${editedScores.team1_score}-${editedScores.team2_score}`
        })
        .eq('id', submissionId)

      if (updateError) throw updateError

      // Update actual match
      let winnerId = null
      if (editedScores.team1_score > editedScores.team2_score) {
        // Team 1 wins
        winnerId = submission.match?.team1?.id || submission.tournament_match?.team1?.id || null
      } else if (editedScores.team2_score > editedScores.team1_score) {
        // Team 2 wins
        winnerId = submission.match?.team2?.id || submission.tournament_match?.team2?.id || null
      }
      // If scores are equal, winnerId remains null (draw)
      
      console.log('Debug EditMatch - Scores:', editedScores.team1_score, '-', editedScores.team2_score);
      console.log('Debug EditMatch - Winner ID:', winnerId);

      if (submission.match_id) {
        const { error: matchError } = await supabase
          .from('matches')
          .update({
            team1_score: editedScores.team1_score,
            team2_score: editedScores.team2_score,
            winner_team_id: winnerId,
            status: 'completed'
          })
          .eq('id', submission.match_id)

        if (matchError) throw matchError
      } else if (submission.tournament_match_id) {
        const { error: tournamentMatchError } = await supabase
          .from('tournament_matches')
          .update({
            team1_score: editedScores.team1_score,
            team2_score: editedScores.team2_score,
            winner_id: winnerId,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', submission.tournament_match_id)

        if (tournamentMatchError) throw tournamentMatchError
      }

      toast.success('Risultato modificato con successo!')
      setEditingMatch(null)
      fetchSubmissions()
    } catch (error) {
      console.error('Error editing match:', error)
      toast.error('Errore nella modifica del risultato')
    } finally {
      setProcessing(false)
    }
  }

  const handleTableAssignment = async (submissionId: string, winnerTeam: 'team1' | 'team2') => {
    setProcessing(true)
    try {
      const submission = submissions.find(s => s.id === submissionId)
      if (!submission) throw new Error('Submission not found')

      const newScores = winnerTeam === 'team1' 
        ? { team1_score: 3, team2_score: 0 }
        : { team1_score: 0, team2_score: 3 }

      const winnerName = winnerTeam === 'team1' 
        ? submission.match?.team1?.name || submission.tournament_match?.team1?.name
        : submission.match?.team2?.name || submission.tournament_match?.team2?.name
      
      const winnerId = winnerTeam === 'team1'
        ? submission.match?.team1?.id || submission.tournament_match?.team1?.id
        : submission.match?.team2?.id || submission.tournament_match?.team2?.id
      
      console.log('Debug TableAssignment - Winner Team:', winnerTeam);
      console.log('Debug TableAssignment - Winner ID:', winnerId);

      // Update submission
      const { error: updateError } = await supabase
        .from('match_result_submissions')
        .update({
          team1_score: newScores.team1_score,
          team2_score: newScores.team2_score,
          status: 'approved',
          admin_notes: `Partita assegnata a tavolino a ${winnerName} (3-0)`
        })
        .eq('id', submissionId)

      if (updateError) throw updateError

      // Update the actual match
      if (submission.match_id) {
        const { error: matchError } = await supabase
          .from('matches')
          .update({
            team1_score: newScores.team1_score,
            team2_score: newScores.team2_score,
            winner_team_id: winnerId,
            status: 'completed'
          })
          .eq('id', submission.match_id)

        if (matchError) throw matchError
      } else if (submission.tournament_match_id) {
        const { error: tournamentMatchError } = await supabase
          .from('tournament_matches')
          .update({
            team1_score: newScores.team1_score,
            team2_score: newScores.team2_score,
            winner_id: winnerId,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', submission.tournament_match_id)

        if (tournamentMatchError) throw tournamentMatchError
      }

      toast.success('Partita assegnata a tavolino!')
      setShowTableAssignment(null)
      fetchSubmissions()
    } catch (error) {
      console.error('Error assigning table match:', error)
      toast.error('Errore nell\'assegnazione a tavolino')
    } finally {
      setProcessing(false)
    }
  }

  const getFilteredSubmissions = () => {
    let filtered = submissions
    
    switch (filter) {
      case 'pending':
        filtered = filtered.filter(s => s.status === 'pending')
        break
      case 'conflicted':
        filtered = filtered.filter(s => s.status === 'conflicted')
        break
      default:
        break
    }

    if (searchTerm) {
      filtered = filtered.filter(submission => 
        submission.submitter?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.team?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.match?.team1?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.match?.team2?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.tournament_match?.team1?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.tournament_match?.team2?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'conflicted':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return null
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'In Attesa'
      case 'approved':
        return 'Approvato'
      case 'rejected':
        return 'Rifiutato'
      case 'conflicted':
        return 'Conflitto'
      default:
        return status
    }
  }

  const parseScreenshots = (submission: MatchResultSubmission) => {
    // Try to parse notes for multiple screenshots
    let screenshots = {
      result: submission.screenshot_url || '',
      stats: ''
    }

    if (submission.notes) {
      try {
        const parsedNotes = JSON.parse(submission.notes)
        if (parsedNotes.screenshots) {
          screenshots = {
            result: parsedNotes.screenshots.result || submission.screenshot_url || '',
            stats: parsedNotes.screenshots.stats || ''
          }
        }
      } catch (e) {
        // If notes are not JSON, use the single screenshot
        screenshots.result = submission.screenshot_url || ''
      }
    }

    return screenshots
  }

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-400">Solo gli amministratori possono accedere a questa sezione</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  const filteredSubmissions = getFilteredSubmissions()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Trophy className="h-6 w-6 text-orange-400" />
          <h3 className="text-xl font-bold text-white">Gestione Match</h3>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>
          
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
          >
            <option value="all">Tutti</option>
            <option value="pending">In Attesa</option>
            <option value="conflicted">Conflitti</option>
          </select>
        </div>
      </div>

      {filteredSubmissions.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-300 mb-2">Nessuna Submission</h4>
          <p className="text-gray-500">
            {filter === 'pending' ? 'Non ci sono risultati in attesa di approvazione' :
             filter === 'conflicted' ? 'Non ci sono conflitti da risolvere' :
             'Non ci sono submission da mostrare'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((submission) => {
            const isSelected = selectedSubmission === submission.id
            const isExpanded = expandedSubmission === submission.id
            const isEditing = editingMatch === submission.id
            const showingTableAssignment = showTableAssignment === submission.id
            const match = submission.match || submission.tournament_match
            const screenshots = parseScreenshots(submission)
            
            return (
              <div key={submission.id} className="bg-gray-800 rounded-lg border border-gray-700">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(submission.status)}
                      <span className="font-medium text-white">
                        {submission.submitter?.username || 'Sconosciuto'}
                      </span>
                      <span className="text-sm text-gray-400">
                        da {submission.team?.name}
                      </span>
                      {match?.scheduled_at && (
                        <span className="text-xs text-blue-400">
                          {new Date(match.scheduled_at).toLocaleString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className="text-lg font-bold text-white">
                        {submission.team1_score} - {submission.team2_score}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        submission.status === 'pending' ? 'bg-yellow-600 text-white' :
                        submission.status === 'approved' ? 'bg-green-600 text-white' :
                        submission.status === 'rejected' ? 'bg-red-600 text-white' :
                        'bg-orange-600 text-white'
                      }`}>
                        {getStatusLabel(submission.status)}
                      </span>
                      
                      <button
                        onClick={() => {
                          setExpandedSubmission(isExpanded ? null : submission.id)
                          if (!isExpanded) {
                            fetchPlayerStats(submission.id)
                          }
                        }}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Match Info */}
                  <div className="flex items-center space-x-4 mb-3 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      {match?.team1 && (
                        <>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team1.color }} />
                          <span>{match.team1.name}</span>
                        </>
                      )}
                      <span>VS</span>
                      {match?.team2 && (
                        <>
                          <span>{match.team2.name}</span>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team2.color }} />
                        </>
                      )}
                    </div>
                    <span>•</span>
                    <span>{new Date(submission.created_at).toLocaleString('it-IT')}</span>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="bg-gray-700 rounded-lg p-4 mb-4 space-y-4">
                      {/* Screenshots */}
                      <div>
                        <h5 className="font-medium text-white mb-3 flex items-center">
                          <Camera className="h-4 w-4 mr-2 text-green-400" />
                          Screenshots
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Screenshot Risultato */}
                          {screenshots.result && (
                            <div>
                              <p className="text-sm text-gray-300 mb-2">Screenshot Risultato:</p>
                              <img 
                                src={screenshots.result} 
                                alt="Screenshot risultato" 
                                className="max-w-full h-48 object-cover rounded border border-gray-600 cursor-pointer"
                                onClick={() => window.open(screenshots.result, '_blank')}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
                          
                          {/* Screenshot Statistiche */}
                          {screenshots.stats && (
                            <div>
                              <p className="text-sm text-gray-300 mb-2">Screenshot Statistiche:</p>
                              <img 
                                src={screenshots.stats} 
                                alt="Screenshot statistiche" 
                                className="max-w-full h-48 object-cover rounded border border-gray-600 cursor-pointer"
                                onClick={() => window.open(screenshots.stats, '_blank')}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Player Stats */}
                      {playerStats.length > 0 && (
                        <div>
                          <h5 className="font-medium text-white mb-2 flex items-center">
                            <Target className="h-4 w-4 mr-2 text-blue-400" />
                            Statistiche Giocatori
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {playerStats.map((player, index) => (
                              <div key={index} className="bg-gray-600 rounded p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-white">{player.username}</span>
                                  <span className="text-xs text-gray-400">{player.position}</span>
                                </div>
                                <div className="flex items-center space-x-4 text-sm">
                                  <span className="text-green-400">{player.goals} Goal</span>
                                  <span className="text-blue-400">{player.assists} Assist</span>
                                  {player.clean_sheet && (
                                    <span className="text-purple-400">Clean Sheet</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {submission.notes && (
                        <div>
                          <h5 className="font-medium text-white mb-2 flex items-center">
                            <MessageSquare className="h-4 w-4 mr-2 text-blue-400" />
                            Note
                          </h5>
                          <p className="text-sm text-gray-300 bg-gray-600 rounded p-3">
                            {typeof submission.notes === 'string' && submission.notes.startsWith('{') 
                              ? JSON.parse(submission.notes).notes || 'Nessuna nota'
                              : submission.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Actions - Always show for all submissions */}
                  <div className="space-y-3">
                    {/* Edit Match Score */}
                    {isEditing ? (
                      <div className="bg-blue-800/20 border border-blue-600 rounded-lg p-4">
                        <h5 className="font-medium text-white mb-3 flex items-center">
                          <Edit3 className="h-4 w-4 mr-2" />
                          Modifica Risultato
                        </h5>
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="text-center">
                            <label className="block text-sm text-gray-300 mb-1">
                              {match?.team1?.name}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={editedScores.team1_score}
                              onChange={(e) => setEditedScores(prev => ({ 
                                ...prev, 
                                team1_score: parseInt(e.target.value) || 0 
                              }))}
                              className="w-16 h-12 text-xl font-bold text-center bg-gray-600 border border-gray-500 rounded text-white"
                            />
                          </div>
                          <span className="text-white font-bold">VS</span>
                          <div className="text-center">
                            <label className="block text-sm text-gray-300 mb-1">
                              {match?.team2?.name}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={editedScores.team2_score}
                              onChange={(e) => setEditedScores(prev => ({ 
                                ...prev, 
                                team2_score: parseInt(e.target.value) || 0 
                              }))}
                              className="w-16 h-12 text-xl font-bold text-center bg-gray-600 border border-gray-500 rounded text-white"
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleEditMatch(submission.id)}
                            disabled={processing}
                            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Salva Modifica
                          </button>
                          <button
                            onClick={() => setEditingMatch(null)}
                            className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : showingTableAssignment ? (
                      <div className="bg-orange-800/20 border border-orange-600 rounded-lg p-4">
                        <h5 className="font-medium text-white mb-3 flex items-center">
                          <Gavel className="h-4 w-4 mr-2" />
                          Assegna a Tavolino (3-0)
                        </h5>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleTableAssignment(submission.id, 'team1')}
                            disabled={processing}
                            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            style={{ backgroundColor: match?.team1?.color }}
                          >
                            Vince {match?.team1?.name}
                          </button>
                          <button
                            onClick={() => handleTableAssignment(submission.id, 'team2')}
                            disabled={processing}
                            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            style={{ backgroundColor: match?.team2?.color }}
                          >
                            Vince {match?.team2?.name}
                          </button>
                          <button
                            onClick={() => setShowTableAssignment(null)}
                            className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {/* Show approval actions only for pending/conflicted */}
                        {(submission.status === 'pending' || submission.status === 'conflicted') && (
                          <button
                            onClick={() => setSelectedSubmission(isSelected ? null : submission.id)}
                            className="text-sm text-blue-400 hover:text-blue-300"
                          >
                            {isSelected ? 'Nascondi azioni' : 'Mostra azioni admin'}
                          </button>
                        )}
                        
                        {/* Always show edit and table assignment buttons */}
                        <button
                          onClick={() => {
                            setEditingMatch(submission.id)
                            setEditedScores({
                              team1_score: submission.team1_score,
                              team2_score: submission.team2_score
                            })
                          }}
                          className="flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Modifica
                        </button>
                        
                        <button
                          onClick={() => setShowTableAssignment(submission.id)}
                          className="flex items-center px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded transition-colors"
                        >
                          <Gavel className="h-3 w-3 mr-1" />
                          Tavolino
                        </button>
                      </div>
                    )}
                    
                    {/* Approval actions for pending/conflicted submissions */}
                    {isSelected && (submission.status === 'pending' || submission.status === 'conflicted') && !isEditing && !showingTableAssignment && (
                      <div className="bg-gray-700 rounded-lg p-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">
                            Note Admin (Opzionale)
                          </label>
                          <textarea
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Aggiungi note per la decisione..."
                            rows={3}
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 resize-none"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleApproval(submission.id, 'approve')}
                            disabled={processing}
                            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approva
                          </button>
                          
                          <button
                            onClick={() => handleApproval(submission.id, 'reject')}
                            disabled={processing}
                            className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Rifiuta
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Admin Notes Display */}
                  {submission.admin_notes && (
                    <div className="bg-gray-700 rounded-lg p-3 mt-3">
                      <p className="text-sm text-gray-300">
                        <strong>Note Admin:</strong> {submission.admin_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}