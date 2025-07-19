import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Users, Trophy, Calendar, Clock, Gamepad2, Shield, Crown, Target, Play, Eye, Star, Search, CheckCircle, MessageCircle  } from 'lucide-react'
import { EliminationBracket } from './EliminationBracket'
import { GroupsBracket } from './GroupsBracket'
import { PlayerOverview } from './PlayerOverview'
import { CaptainMatchResultForm } from './CaptainMatchResultForm'
import { ChatManager } from '../chat/ChatManager'
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
  organizer_name?: string
  twitch_channel?: string
  scheduled_at?: string
  rules?: string
  created_at: string
}

interface Team {
  id: string
  name: string
  color: string
  captain_id?: string
  captain?: {
    username: string
  }
  members: Array<{
    username: string
    position: string
    pick_order: number
  }>
}

interface Registration {
  id: string
  user_id: string
  username: string
  preferred_position: string
  platform: string
  status: 'pending' | 'approved' | 'drafted'
  wants_captain: boolean
  game_name?: string
  real_team?: string
}

interface TournamentMatch {
  id: string
  round: number
  match_number: number
  team1_id?: string
  team2_id?: string
  winner_id?: string
  team1_score: number
  team2_score: number
  status: 'pending' | 'completed' | 'cancelled'
  completed_at?: string
  team1?: Team
  team2?: Team
  winner?: Team
}

export function PublicEventDetails() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user, profile } = useAuth()
  const [event, setEvent] = useState<DraftEvent | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'bracket' | 'teams' | 'matches' | 'players' | 'chat'>('overview')
  const [selectedMatch, setSelectedMatch] = useState<{ matchId?: string, tournamentMatchId?: string } | null>(null)
  const [userRegistration, setUserRegistration] = useState<Registration | null>(null)
  const [isUserCaptain, setIsUserCaptain] = useState(false)
  const [userCaptainTeamId, setUserCaptainTeamId] = useState<string | null>(null)

  useEffect(() => {
    if (eventId) {
      fetchEventData()
    }
  }, [eventId, user])

  const fetchEventData = async () => {
    try {
      // Fetch event with tournament bracket
      const { data: eventData, error: eventError } = await supabase
        .from('draft_events')
        .select(`
          *,
          tournament_brackets (
            id,
            format,
            stage,
            status,
            settings
          )
        `)
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError

      const processedEvent = {
        ...eventData,
        tournament_bracket: eventData.tournament_brackets?.[0] || null
      }
      delete processedEvent.tournament_brackets
      setEvent(processedEvent)

      // Fetch teams with members and captains
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

      // Fetch captain info for each team
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
            members: (team.team_members || []).sort((a, b) => a.pick_order - b.pick_order)
          }
        })
      )

      setTeams(teamsWithCaptains)

      // Check if user is captain
      if (user) {
        const userIsCaptain = teamsWithCaptains.some(team => team.captain_id === user.id)
        const captainTeam = teamsWithCaptains.find(team => team.captain_id === user.id)
        setIsUserCaptain(userIsCaptain)
        setUserCaptainTeamId(captainTeam?.id || null)
      }

      // Fetch registrations
      const { data: registrationsData, error: registrationsError } = await supabase
        .from('registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .order('username')

      if (registrationsError) throw registrationsError
      setRegistrations(registrationsData || [])

      // Check user registration
      if (user) {
        const userReg = registrationsData?.find(reg => reg.user_id === user.id)
        setUserRegistration(userReg || null)
      }

      // Fetch tournament matches if bracket exists
      if (processedEvent.tournament_bracket) {
        const { data: matchesData, error: matchesError } = await supabase
          .from('tournament_matches')
          .select(`
            *,
            team1:team1_id (id, name, color),
            team2:team2_id (id, name, color),
            winner:winner_id (id, name, color)
          `)
          .eq('bracket_id', processedEvent.tournament_bracket.id)
          .order('round')
          .order('match_number')

        if (matchesError) throw matchesError
        setMatches(matchesData || [])
      }

    } catch (error) {
      console.error('Error fetching event data:', error)
      toast.error('Errore nel caricamento dell\'evento')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      registration: { 
        class: 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white', 
        label: 'Registrazioni Aperte'
      },
      captain_selection: { 
        class: 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white', 
        label: 'Selezione Capitani'
      },
      drafting: { 
        class: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white', 
        label: 'Draft Live'
      },
      completed: { 
        class: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white', 
        label: 'Completato'
      }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig]
    
    return (
      <span className={`inline-flex items-center px-4 py-2 text-sm font-bold rounded-full ${config.class}`}>
        {config.label}
      </span>
    )
  }

  const getCompletedMatches = () => {
    return matches.filter(match => match.status === 'completed')
  }

  const getPendingMatches = () => {
    return matches.filter(match => match.status === 'pending')
  }

  const getPlayersByPosition = () => {
    const positions = {
      'Portieri': registrations.filter(r => r.preferred_position.toLowerCase().includes('por')),
      'Difensori': registrations.filter(r => 
        r.preferred_position.toLowerCase().includes('dif') || 
        r.preferred_position.toLowerCase().includes('dc') ||
        r.preferred_position.toLowerCase().includes('dd') ||
        r.preferred_position.toLowerCase().includes('ds')
      ),
      'Centrocampisti': registrations.filter(r => 
        r.preferred_position.toLowerCase().includes('centro') ||
        r.preferred_position.toLowerCase().includes('cc') ||
        r.preferred_position.toLowerCase().includes('cd') ||
        r.preferred_position.toLowerCase().includes('cs')
      ),
      'Attaccanti': registrations.filter(r => 
        r.preferred_position.toLowerCase().includes('att') ||
        r.preferred_position.toLowerCase().includes('cf') ||
        r.preferred_position.toLowerCase().includes('st')
      )
    }
    
    // Add remaining players to "Altri"
    const categorized = Object.values(positions).flat()
    const others = registrations.filter(r => !categorized.includes(r))
    if (others.length > 0) {
      positions['Altri'] = others
    }
    
    return positions
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
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {event.title}
                </h1>
                {getStatusBadge(event.status)}
              </div>
              {event.description && (
                <p className="text-white/80 text-lg mb-4">{event.description}</p>
              )}
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
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-purple-400" />
                  <span className="font-medium">{registrations.length} Giocatori</span>
                </div>
                {event.scheduled_at && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-orange-400" />
                    <span className="font-medium">
                      {new Date(event.scheduled_at).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Status */}
          {userRegistration && (
            <div className="glass rounded-xl p-4 border border-green-400/30 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-white font-medium">Sei registrato come: {userRegistration.preferred_position}</span>
                  {isUserCaptain && (
                    <span className="inline-flex items-center px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded-full">
                      <Crown className="h-3 w-3 mr-1" />
                      Capitano
                    </span>
                  )}
                </div>
                <span className="text-green-300 text-sm">Piattaforma: {userRegistration.platform}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
            {[
              { id: 'overview', label: 'Panoramica', icon: Eye },
              { id: 'bracket', label: 'Bracket', icon: Trophy, disabled: !event.tournament_bracket },
              { id: 'teams', label: 'Squadre', icon: Users, disabled: teams.length === 0 },
              { id: 'matches', label: 'Partite', icon: Play, disabled: matches.length === 0 },
              { id: 'players', label: 'Giocatori', icon: Users },
              { id: 'chat', label: 'Chat', icon: MessageCircle },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id as any)}
                  disabled={tab.disabled}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : tab.disabled
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white'
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
        <div className="glass rounded-xl border border-white/20 overflow-hidden">
          <div className="p-8 bg-gray-900/30 backdrop-blur-sm min-h-[600px]">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Event Progress */}
                <div className="glass rounded-xl p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-6">Progresso Evento</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className={`text-center p-4 rounded-lg border-2 ${
                      event.status === 'registration' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-700/50'
                    }`}>
                      <Users className={`h-8 w-8 mx-auto mb-2 ${
                        event.status === 'registration' ? 'text-blue-400' : 'text-gray-400'
                      }`} />
                      <p className="font-bold text-white">Registrazioni</p>
                      <p className="text-sm text-gray-400">
                        {event.status === 'registration' ? 'In Corso' : 'Completate'}
                      </p>
                    </div>
                    
                    <div className={`text-center p-4 rounded-lg border-2 ${
                      event.status === 'captain_selection' ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-600 bg-gray-700/50'
                    }`}>
                      <Crown className={`h-8 w-8 mx-auto mb-2 ${
                        event.status === 'captain_selection' ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                      <p className="font-bold text-white">Capitani</p>
                      <p className="text-sm text-gray-400">
                        {event.status === 'captain_selection' ? 'In Corso' : 
                         ['drafting', 'completed'].includes(event.status) ? 'Completata' : 'In Attesa'}
                      </p>
                    </div>
                    
                    <div className={`text-center p-4 rounded-lg border-2 ${
                      event.status === 'drafting' ? 'border-green-500 bg-green-500/10' : 'border-gray-600 bg-gray-700/50'
                    }`}>
                      <Target className={`h-8 w-8 mx-auto mb-2 ${
                        event.status === 'drafting' ? 'text-green-400' : 'text-gray-400'
                      }`} />
                      <p className="font-bold text-white">Draft</p>
                      <p className="text-sm text-gray-400">
                        {event.status === 'drafting' ? 'In Corso' : 
                         event.status === 'completed' ? 'Completato' : 'In Attesa'}
                      </p>
                    </div>
                    
                    <div className={`text-center p-4 rounded-lg border-2 ${
                      event.status === 'completed' ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 bg-gray-700/50'
                    }`}>
                      <Trophy className={`h-8 w-8 mx-auto mb-2 ${
                        event.status === 'completed' ? 'text-purple-400' : 'text-gray-400'
                      }`} />
                      <p className="font-bold text-white">Torneo</p>
                      <p className="text-sm text-gray-400">
                        {event.status === 'completed' ? 'In Corso' : 'In Attesa'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tournament Rules */}
                {event.rules && (
                  <div className="glass rounded-xl p-6 border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                      <Shield className="h-6 w-6 mr-2 text-orange-400" />
                      Regole del Torneo
                    </h3>
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <pre className="text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                        {event.rules}
                      </pre>
                    </div>
                  </div>
                )} 

                {/* Event Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="glass rounded-xl p-6 border border-blue-400/30">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-blue-300 font-medium">Giocatori Registrati</p>
                        <p className="text-2xl font-bold text-white">{registrations.length}</p>
                        <p className="text-xs text-blue-200">di {event.max_participants} max</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="glass rounded-xl p-6 border border-green-400/30">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-green-300 font-medium">Squadre Formate</p>
                        <p className="text-2xl font-bold text-white">{teams.length}</p>
                        <p className="text-xs text-green-200">di {event.team_count} totali</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="glass rounded-xl p-6 border border-yellow-400/30">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-yellow-300 font-medium">Partite Completate</p>
                        <p className="text-2xl font-bold text-white">{getCompletedMatches().length}</p>
                        <p className="text-xs text-yellow-200">
                          {matches.length > 0 ? `di ${matches.length} totali` : 'Nessuna partita'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="glass rounded-xl p-6 border border-purple-400/30">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                        <Play className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-purple-300 font-medium">Partite Rimanenti</p>
                        <p className="text-2xl font-bold text-white">{getPendingMatches().length}</p>
                        <p className="text-xs text-purple-200">
                          {matches.length > 0 ? 'da giocare' : 'Non ancora generate'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Event Info */}
                  <div className="glass rounded-xl p-6 border border-white/20">
                    <h4 className="text-lg font-bold text-white mb-4 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-orange-400" />
                      Informazioni Evento
                    </h4>
                    <div className="space-y-3">
                      {event.organizer_name && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Organizzatore:</span>
                          <span className="text-white font-medium">{event.organizer_name}</span>
                        </div>
                      )}
                      {event.game_type && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Gioco:</span>
                          <span className="text-white font-medium">{event.game_type}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Formato:</span>
                        <span className="text-white font-medium">
                          {event.tournament_bracket?.format === 'elimination' ? 'Eliminazione Diretta' :
                           event.tournament_bracket?.format === 'groups' ? 'Fase a Gironi' :
                           'Da Definire'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Giocatori per Squadra:</span>
                        <span className="text-white font-medium">{event.max_players_per_team}</span>
                      </div>
                      {event.scheduled_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Data:</span>
                          <span className="text-white font-medium">
                            {new Date(event.scheduled_at).toLocaleDateString('it-IT')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Registration Stats */}
                  <div className="glass rounded-xl p-6 border border-white/20">
                    <h4 className="text-lg font-bold text-white mb-4 flex items-center">
                      <Users className="h-5 w-5 mr-2 text-blue-400" />
                      Statistiche Registrazioni
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Totale Registrati:</span>
                        <span className="text-white font-medium">{registrations.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Posti Disponibili:</span>
                        <span className="text-white font-medium">{event.max_participants - registrations.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Capitani Disponibili:</span>
                        <span className="text-white font-medium">
                          {registrations.filter(r => r.wants_captain).length}
                        </span>
                      </div>
                      {registrations.length > 0 && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Piattaforma Più Popolare:</span>
                            <span className="text-white font-medium">
                              {Object.entries(
                                registrations.reduce((acc, reg) => {
                                  acc[reg.platform] = (acc[reg.platform] || 0) + 1
                                  return acc
                                }, {} as Record<string, number>)
                              ).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-gray-600">
                            <div className="text-xs text-gray-400 mb-2">Distribuzione Piattaforme:</div>
                            <div className="flex space-x-2">
                              {['PC', 'PlayStation', 'Xbox'].map(platform => {
                                const count = registrations.filter(r => r.platform === platform).length
                                const percentage = registrations.length > 0 ? Math.round((count / registrations.length) * 100) : 0
                                return (
                                  <div key={platform} className="text-center">
                                    <div className="text-xs font-medium text-white">{count}</div>
                                    <div className="text-xs text-gray-400">{platform}</div>
                                    <div className="text-xs text-blue-300">{percentage}%</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'teams' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-white">Squadre del Torneo</h3>
                  <span className="text-sm text-gray-400">
                    {teams.length} di {event.team_count} squadre
                  </span>
                </div>
                
                {teams.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                    <h4 className="text-xl font-semibold text-gray-300 mb-2">Nessuna Squadra Formata</h4>
                    <p className="text-gray-500">
                      Le squadre verranno create durante la fase di selezione capitani.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map((team) => (
                      <div key={team.id} className="glass rounded-xl p-6 border border-white/20 hover:border-white/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-6 h-6 rounded-full border-2 border-white"
                              style={{ backgroundColor: team.color }}
                            />
                            <h4 className="text-xl font-bold text-white">{team.name}</h4>
                          </div>
                          <span className="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded-full">
                            {team.members.length} giocatori
                          </span>
                        </div>
                        
                        {/* Captain */}
                        {team.captain ? (
                          <div className="mb-4 p-3 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-600/30 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <Crown className="h-5 w-5 text-yellow-400" />
                              <div>
                                <p className="font-bold text-white">{team.captain.username}</p>
                                <p className="text-xs text-yellow-300">Capitano</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-4 p-3 bg-gray-700/50 border border-gray-600 rounded-lg">
                            <div className="flex items-center space-x-2 text-gray-400">
                              <Crown className="h-5 w-5" />
                              <p className="text-sm">Capitano non assegnato</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Team Members */}
                        <div className="space-y-2">
                          <h5 className="font-semibold text-white text-sm">Rosa Squadra:</h5>
                          {team.members.length === 0 ? (
                            <p className="text-gray-400 text-sm italic">Nessun giocatore draftato</p>
                          ) : (
                            <div className="space-y-2">
                              {team.members.map((member, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                                  <div>
                                    <p className="text-white font-medium text-sm">{member.username}</p>
                                    <p className="text-gray-400 text-xs">{member.position}</p>
                                  </div>
                                  <span className="text-xs text-gray-500 bg-gray-600 px-2 py-1 rounded">
                                    #{member.pick_order}
                                  </span>
                                </div>
                              ))}
                              
                              {/* Team Stats */}
                              <div className="mt-3 pt-3 border-t border-gray-600">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="text-center">
                                    <p className="text-gray-400">Giocatori</p>
                                    <p className="font-bold text-white">{team.members.length}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-gray-400">Pick Medio</p>
                                    <p className="font-bold text-white">
                                      {team.members.length > 0 
                                        ? Math.round(team.members.reduce((sum, m) => sum + m.pick_order, 0) / team.members.length)
                                        : 0
                                      }
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Teams Summary */}
                {teams.length > 0 && (
                  <div className="glass rounded-xl p-6 border border-white/20">
                    <h4 className="text-lg font-bold text-white mb-4">Riepilogo Squadre</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-400">
                          {teams.filter(t => t.captain).length}
                        </p>
                        <p className="text-sm text-gray-400">Con Capitano</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-400">
                          {teams.reduce((sum, team) => sum + team.members.length, 0)}
                        </p>
                        <p className="text-sm text-gray-400">Giocatori Draftati</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-400">
                          {teams.length > 0 
                            ? Math.round(teams.reduce((sum, team) => sum + team.members.length, 0) / teams.length)
                            : 0
                          }
                        </p>
                        <p className="text-sm text-gray-400">Media Giocatori</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-400">
                          {teams.filter(t => t.members.length === Math.max(...teams.map(team => team.members.length))).length}
                        </p>
                        <p className="text-sm text-gray-400">Squadre Complete</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bracket' && event.tournament_bracket && (
              <div>
                <h3 className="text-2xl font-bold text-white mb-6">
                  {event.tournament_bracket.format === 'elimination' ? 'Bracket Eliminazione Diretta' : 'Gironi del Torneo'}
                </h3>
                {event.tournament_bracket.format === 'elimination' ? (
                  <EliminationBracket eventId={event.id} matches={matches} teams={teams} />
                ) : (
                  <GroupsBracket eventId={event.id} matches={matches} teams={teams} />
                )}
              </div>
            )}

            {activeTab === 'matches' && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white mb-6">
                  Calendario Partite
                </h3>
                
                {matches.length === 0 ? (
                  <div className="text-center py-12">
                    <Play className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                    <h4 className="text-xl font-semibold text-gray-300 mb-2">Nessuna Partita</h4>
                    <p className="text-gray-500">Le partite del torneo non sono ancora state generate.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getCompletedMatches().length > 0 && (
                      <div className="glass rounded-xl p-6 border border-green-400/30">
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <CheckCircle className="h-5 w-5 mr-2 text-green-400" />
                          Partite Completate
                        </h4>
                        <div className="space-y-3">
                          {getCompletedMatches().map((match) => (
                            <div 
                              key={match.id} 
                              className={`bg-gray-700 rounded-lg p-4 border ${
                                (userCaptainTeamId && (match.team1_id === userCaptainTeamId || match.team2_id === userCaptainTeamId)) 
                                  ? 'border-yellow-500 shadow-md shadow-yellow-500/20' 
                                  : 'border-gray-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <span className="text-sm text-gray-400">Round {match.round} - Match {match.match_number}</span>
                                  {match.scheduled_at && (
                                    <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">
                                      {new Date(match.scheduled_at).toLocaleTimeString('it-IT', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                  <div className="flex items-center space-x-2">
                                    {match.team1 && (
                                      <>
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team1.color }} />
                                        <span className="text-white">{match.team1.name}</span>
                                      </>
                                    )}
                                    <span className="text-white font-bold mx-2">{match.team1_score} - {match.team2_score}</span>
                                    {match.team2 && (
                                      <>
                                        <span className="text-white">{match.team2.name}</span>
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team2.color }} />
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                {match.winner && (
                                  <div className="flex items-center space-x-2 text-yellow-400">
                                    <Crown className="h-4 w-4" />
                                    <span className="text-sm font-medium">Vincitore: {match.winner.name}</span>
                                  </div>
                                )}
                              </div>
                              
                              {match.completed_at && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Completata il {new Date(match.completed_at).toLocaleString('it-IT')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {getPendingMatches().length > 0 && (
                      <div className="glass rounded-xl p-6 border border-blue-400/30">
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <Calendar className="h-5 w-5 mr-2 text-blue-400" />
                          Prossime Partite
                        </h4>
                        
                        {/* Filtro per le tue partite */}
                        {userCaptainTeamId && (
                          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                            <div className="flex items-center space-x-2 text-blue-300 mb-2">
                              <Crown className="h-4 w-4" />
                              <span className="font-medium">Le tue partite come capitano</span>
                            </div>
                            <div className="space-y-3">
                              {getPendingMatches()
                                .filter(match => match.team1_id === userCaptainTeamId || match.team2_id === userCaptainTeamId)
                                .map((match) => (
                                  <div key={match.id} className="bg-blue-900/30 rounded-lg p-4 border border-blue-500/50">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-4">
                                        <span className="text-sm text-blue-300">Round {match.round} - Match {match.match_number}</span>
                                        {match.scheduled_at && (
                                          <span className="text-xs text-white bg-blue-600 px-2 py-1 rounded font-bold">
                                            {new Date(match.scheduled_at).toLocaleTimeString('it-IT', {
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </span>
                                        )}
                                        <div className="flex items-center space-x-2">
                                          {match.team1 && (
                                            <>
                                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team1.color }} />
                                              <span className={`text-white ${match.team1_id === userCaptainTeamId ? 'font-bold' : ''}`}>
                                                {match.team1.name}
                                              </span>
                                            </>
                                          )}
                                          <span className="text-gray-400 mx-2">VS</span>
                                          {match.team2 && (
                                            <>
                                              <span className={`text-white ${match.team2_id === userCaptainTeamId ? 'font-bold' : ''}`}>
                                                {match.team2.name}
                                              </span>
                                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team2.color }} />
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() => setSelectedMatch({ tournamentMatchId: match.id })}
                                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                                        >
                                          Invia Risultato
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                        
     
                     
                       
                        </div>
                 
                    )}
                  </div>
                )}
                
                {/* Calendario Completo */}
                {matches.length > 0 && (
                  <div className="glass rounded-xl p-6 border border-white/20 mt-8">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-purple-400" />
                      Calendario Completo
                    </h4>
                    
                    <div className="space-y-6">
                      {/* Raggruppa i match per data/ora */}
                      {Object.entries(
                        matches.reduce((acc, match) => {
                          if (!match.scheduled_at) return acc;
                          
                          const timeKey = new Date(match.scheduled_at).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                          
                          if (!acc[timeKey]) acc[timeKey] = [];
                          acc[timeKey].push(match);
                          return acc;
                        }, {} as Record<string, TournamentMatch[]>)
                      )
                      .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
                      .map(([time, timeMatches]) => (
                        <div key={time} className="space-y-2">
                          <h5 className="font-medium text-white flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-blue-400" />
                            Orario: {time}
                          </h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {timeMatches.map(match => (
                              <div 
                                key={match.id} 
                                className={`p-3 rounded-lg ${
                                  match.status === 'completed' 
                                    ? 'bg-green-900/20 border border-green-600/30' 
                                    : 'bg-gray-700 border border-gray-600'
                                } ${
                                  (userCaptainTeamId && (match.team1_id === userCaptainTeamId || match.team2_id === userCaptainTeamId))
                                    ? 'border-yellow-500/50'
                                    : ''
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-400">
                                    Round {match.round} - Match {match.match_number}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    match.status === 'completed' 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-yellow-600 text-white'
                                  }`}>
                                    {match.status === 'completed' ? 'Completata' : 'In Attesa'}
                                  </span>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {match.team1 && (
                                      <>
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: match.team1.color }} />
                                        <span className={`text-sm ${match.team1_id === userCaptainTeamId ? 'font-bold text-white' : 'text-gray-300'}`}>
                                          {match.team1.name}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  
                                  {match.status === 'completed' ? (
                                    <span className="text-sm font-bold text-white">
                                      {match.team1_score} - {match.team2_score}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">VS</span>
                                  )}
                                  
                                  <div className="flex items-center space-x-2">
                                    {match.team2 && (
                                      <>
                                        <span className={`text-sm ${match.team2_id === userCaptainTeamId ? 'font-bold text-white' : 'text-gray-300'}`}>
                                          {match.team2.name}
                                        </span>
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: match.team2.color }} />
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'players' && (
              <PlayerOverview eventId={event.id} />
            )}

             {activeTab === 'chat' && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-white mb-4">Chat dell’Evento</h3>
                  <ChatManager
                     eventId={event.id}
                    isAdmin={profile?.is_admin}
                    defaultTab="event"
                   />
                 </div>
               )}
          </div>
        </div>
      </div>

      {/* Captain Match Result Modal */}
      {selectedMatch && isUserCaptain && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CaptainMatchResultForm
              matchId={selectedMatch.matchId}
              tournamentMatchId={selectedMatch.tournamentMatchId}
              onClose={() => setSelectedMatch(null)}
              onSubmitted={() => {
                setSelectedMatch(null)
                fetchEventData() // Refresh data
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}