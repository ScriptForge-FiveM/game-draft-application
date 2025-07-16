import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { CheckCircle, XCircle, AlertTriangle, Clock, Trophy, Users, Camera, MessageSquare } from 'lucide-react'
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
  }
  tournament_match?: {
    tournament_brackets: {
      event_id: string
    }
    team1?: { name: string, color: string }
    team2?: { name: string, color: string }
  }
}

interface AdminMatchApprovalProps {
  eventId?: string
}

export function AdminMatchApproval({ eventId }: AdminMatchApprovalProps) {
  const { profile } = useAuth()
  const [submissions, setSubmissions] = useState<MatchResultSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'conflicted'>('pending')
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (profile?.is_admin) {
      fetchSubmissions()
    }
  }, [profile, eventId])

  const fetchSubmissions = async () => {
    try {
      let query = supabase
        .from('match_result_submissions')
        .select(`
          *,
          submitter:submitted_by (
            username:profiles(username)
          ),
          team:team_id (name, color),
          match:match_id (
            event_id,
            team1:team1_id (name, color),
            team2:team2_id (name, color)
          ),
          tournament_match:tournament_match_id (
            tournament_brackets!inner (event_id),
            team1:team1_id (name, color),
            team2:team2_id (name, color)
          )
        `)
        .order('created_at', { ascending: false })

      if (eventId) {
        // Filter by event - need to handle both regular matches and tournament matches
        query = query.or(`match.event_id.eq.${eventId},tournament_match.tournament_brackets.event_id.eq.${eventId}`)
      }

      const { data, error } = await query

      if (error) throw error

      // Group submissions by match to detect conflicts
      const submissionGroups = new Map()
      
      data?.forEach(submission => {
        const matchKey = submission.match_id || submission.tournament_match_id
        if (!submissionGroups.has(matchKey)) {
          submissionGroups.set(matchKey, [])
        }
        submissionGroups.get(matchKey).push(submission)
      })

      // Mark conflicted submissions
      const processedSubmissions = data?.map(submission => {
        const matchKey = submission.match_id || submission.tournament_match_id
        const matchSubmissions = submissionGroups.get(matchKey)
        
        if (matchSubmissions.length > 1 && submission.status === 'pending') {
          // Check if there are different scores
          const scores = matchSubmissions.map(s => `${s.team1_score}-${s.team2_score}`)
          const uniqueScores = new Set(scores)
          
          if (uniqueScores.size > 1) {
            return { ...submission, status: 'conflicted' as const }
          }
        }
        
        return submission
      }) || []

      setSubmissions(processedSubmissions)
    } catch (error) {
      console.error('Error fetching submissions:', error)
      toast.error('Errore nel caricamento delle submission')
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (submissionId: string, action: 'approve' | 'reject') => {
    setProcessing(true)
    try {
      const submission = submissions.find(s => s.id === submissionId)
      if (!submission) throw new Error('Submission not found')

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
        // Update the actual match with the approved result
        const winnerId = submission.team1_score > submission.team2_score 
          ? (submission.match?.team1 || submission.tournament_match?.team1)
          : submission.team1_score < submission.team2_score 
          ? (submission.match?.team2 || submission.tournament_match?.team2)
          : null

        if (submission.match_id) {
          // Update regular match
          const { error: matchError } = await supabase
            .from('matches')
            .update({
              team1_score: submission.team1_score,
              team2_score: submission.team2_score,
              winner_team_id: winnerId?.id || null,
              status: 'completed'
            })
            .eq('id', submission.match_id)

          if (matchError) throw matchError
        } else if (submission.tournament_match_id) {
          // Update tournament match
          const { error: tournamentMatchError } = await supabase
            .from('tournament_matches')
            .update({
              team1_score: submission.team1_score,
              team2_score: submission.team2_score,
              winner_id: winnerId?.id || null,
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', submission.tournament_match_id)

          if (tournamentMatchError) throw tournamentMatchError
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

  const getFilteredSubmissions = () => {
    switch (filter) {
      case 'pending':
        return submissions.filter(s => s.status === 'pending')
      case 'conflicted':
        return submissions.filter(s => s.status === 'conflicted')
      default:
        return submissions
    }
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
          <h3 className="text-xl font-bold text-white">Approvazione Risultati Match</h3>
        </div>
        
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
            const match = submission.match || submission.tournament_match
            
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

                  {/* Notes and Screenshot */}
                  {(submission.notes || submission.screenshot_url) && (
                    <div className="mb-3 space-y-2">
                      {submission.notes && (
                        <div className="flex items-start space-x-2">
                          <MessageSquare className="h-4 w-4 text-blue-400 mt-0.5" />
                          <p className="text-sm text-gray-300">{submission.notes}</p>
                        </div>
                      )}
                      {submission.screenshot_url && (
                        <div className="flex items-center space-x-2">
                          <Camera className="h-4 w-4 text-green-400" />
                          <a 
                            href={submission.screenshot_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300"
                          >
                            Visualizza Screenshot
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Actions */}
                  {submission.status === 'pending' || submission.status === 'conflicted' ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => setSelectedSubmission(isSelected ? null : submission.id)}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        {isSelected ? 'Nascondi azioni' : 'Mostra azioni admin'}
                      </button>
                      
                      {isSelected && (
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
                  ) : (
                    submission.admin_notes && (
                      <div className="bg-gray-700 rounded-lg p-3">
                        <p className="text-sm text-gray-300">
                          <strong>Note Admin:</strong> {submission.admin_notes}
                        </p>
                      </div>
                    )
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