import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Users, Trophy, Settings, Play, UserCheck, Clock, Target, Calendar, Gamepad2, Shield, Crown, Zap, CheckCircle, Circle, ArrowRight } from 'lucide-react'
import { RegistrationList } from './RegistrationList'
import { CaptainSelection } from './CaptainSelection'
import { LiveDraft } from './LiveDraft'
import { TournamentFormatSelector } from './TournamentFormatSelector'
import { EliminationBracket } from './EliminationBracket'
import { GroupsBracket } from './GroupsBracket'
import { TournamentManager } from './TournamentManager'
import { AdminMatchApproval } from './AdminMatchApproval'
import toast from 'react-hot-toast'

interface DraftEvent {
  id: string
  title: string
  description?: string
  admin_id: string
  team_count: number
  max_players_per_team: number
  max_participants: number
  status: 'registration' | 'captain_selection' | 'drafting' | 'completed'
  tournament_format?: 'elimination' | 'groups' | null
  tournament_bracket?: {
    id: string
    format: string
    status: string
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

export function EventManagement() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user } = useAuth()
  const [event, setEvent] = useState<DraftEvent | null>(null)
  const [stats, setStats] = useState<EventStats>({
    totalRegistrations: 0,
    approvedRegistrations: 0,
    teamsWithCaptains: 0,
    draftedPlayers: 0
  })
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

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
      color: 'from-purple-500 to-indigo-500',
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
      setCurrentStep(stepIndex >= 0 ? stepIndex : 0)
    }
  }, [event])

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
      const { error } = await supabase
        .from('draft_events')
        .update({ status: newStatus })
        .eq('id', event.id)

      if (error) throw error
      
      setEvent({ ...event, status: newStatus })
      toast.success(`Evento spostato alla fase: ${getStatusLabel(newStatus)}`)
      
      // Update current step
      const stepIndex = steps.findIndex(step => step.status === newStatus)
      if (stepIndex >= 0) {
        setCurrentStep(stepIndex)
      }
    } catch (error) {
      console.error('Error updating event status:', error)
      toast.error('Errore nell\'aggiornamento dello stato evento')
    }
  }

  const getStatusLabel = (status: string) => {
    const labels = {
      registration: 'Registrazioni',
      captain_selection: 'Selezione Capitani',
      drafting: 'Draft Live',
      completed: 'Torneo'
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

  const renderStepContent = () => {
    if (!event) return null

    const step = steps[currentStep]
    
    switch (step.id) {
      case 'registrations':
        return <RegistrationList eventId={event.id} showDummyGenerator={true} />
      
      case 'captains':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Crown className="h-8 w-8 text-yellow-400" />
                <h4 className="font-bold text-white text-2xl">Selezione Capitani</h4>
              </div>
            </div>
            
            <CaptainSelection eventId={event.id} teamCount={event.team_count} />
          </div>
        )
      
      case 'draft':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Play className="h-8 w-8 text-red-400" />
                <h4 className="font-bold text-white text-2xl">Draft Live</h4>
              </div>
            </div>
            
            <LiveDraft eventId={event.id} />
          </div>
        )
      
      case 'tournament':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-4 mb-6">
              <Trophy className="h-8 w-8 text-purple-400" />
              <h4 className="font-bold text-white text-2xl">Gestione Torneo</h4>
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
              <div className="space-y-8">
                <TournamentManager 
                  eventId={event.id}
                  bracket={event.tournament_bracket}
                />
                
                <AdminMatchApproval eventId={event.id} />
              </div>
            )}
          </div>
        )
      
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
                const isActive = index === currentStep
                const isCompleted = index < currentStep
                const isAccessible = index <= currentStep
                
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => isAccessible && setCurrentStep(index)}
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
                        index < currentStep ? 'bg-green-500' : 'bg-gray-600'
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

        {/* Step Content */}
        <div className="glass rounded-2xl border border-white/20 overflow-hidden">
          <div className="p-8 bg-gray-900/30 backdrop-blur-sm min-h-[600px]">
            {renderStepContent()}
          </div>
        </div>
      </div>
    </div>
  )
}