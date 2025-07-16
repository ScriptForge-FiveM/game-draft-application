import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Users, Trophy, Clock, Activity, Gamepad2, Shield, Play, Crown, Target, Calendar, Settings, Zap, Filter, Search, Eye, UserCheck, Star } from 'lucide-react'
import toast from 'react-hot-toast'

interface DraftEvent {
  id: string
  title: string
  description?: string
  team_count: number
  max_players: number
  status: 'registration' | 'captain_selection' | 'drafting' | 'completed'
  tournament_format?: 'elimination' | 'groups' | null
  game_type?: string
  scheduled_at?: string
  created_at: string
  registrations?: { count: number }[]
  user_registration?: {
    id: string
    status: 'pending' | 'approved' | 'drafted'
    preferred_position: string
  }
  is_captain?: boolean
}

export function Dashboard() {
  const { user, profile, isAdminViewActive } = useAuth()
  const [events, setEvents] = useState<DraftEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'my_events' | 'registered' | 'completed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [userRegistrations, setUserRegistrations] = useState<Map<string, any>>(new Map())

  useEffect(() => {
    if (user) {
      fetchEvents()
    }
  }, [user])

  const fetchEvents = async () => {
    try {
      // Fetch all events
      const { data: eventsData, error: eventsError } = await supabase
        .from('draft_events')
        .select(`
          *,
          registrations(count)
        `)
        .order('created_at', { ascending: false })

      if (eventsError) throw eventsError

      // Fetch user's registrations
      const { data: userRegistrations, error: regError } = await supabase
        .from('registrations')
        .select('event_id, id, status, preferred_position, specific_position')
        .eq('user_id', user?.id)

      if (regError) throw regError

      // Fetch teams where user is captain
      const { data: captainTeams, error: captainError } = await supabase
        .from('teams')
        .select('event_id')
        .eq('captain_id', user?.id)

      if (captainError) throw captainError

      // Create maps for quick lookup
      const registrationMap = new Map(userRegistrations?.map(reg => [reg.event_id, reg]) || [])
      const captainEventIds = new Set(captainTeams?.map(team => team.event_id) || [])
      
      // Store user registrations for status checking
      setUserRegistrations(registrationMap)

      // Combine data
      const eventsWithUserData = (eventsData || []).map(event => ({
        ...event,
        user_registration: registrationMap.get(event.id),
        is_captain: captainEventIds.has(event.id)
      }))

      setEvents(eventsWithUserData)
    } catch (error) {
      console.error('Error fetching events:', error)
      toast.error('Errore nel caricamento degli eventi')
    } finally {
      setLoading(false)
    }
  }

  const getFilteredEvents = () => {
    let filtered = events

    // Apply status filter
    if (filter === 'my_events' && profile?.is_admin) {
      filtered = filtered.filter(event => event.admin_id === user?.id)
    } else if (filter === 'registered') {
      filtered = filtered.filter(event => event.user_registration || event.is_captain)
    } else if (filter === 'completed') {
      filtered = filtered.filter(event => event.status === 'completed')
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.game_type?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }

  const getEventProgress = (event: DraftEvent) => {
    const statuses = ['registration', 'captain_selection', 'drafting', 'completed']
    const currentIndex = statuses.indexOf(event.status)
    return ((currentIndex + 1) / statuses.length) * 100
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      registration: { 
        class: 'badge-registration', 
        label: 'Registrazioni',
        icon: Users
      },
      captain_selection: { 
        class: 'badge-captain', 
        label: 'Selezione Capitani',
        icon: Shield
      },
      drafting: { 
        class: 'badge-drafting', 
        label: 'Draft Live',
        icon: Activity
      },
      completed: { 
        class: 'badge-completed', 
        label: 'Completato',
        icon: Trophy
      }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig]
    const Icon = config.icon

    return (
      <span className={`badge ${config.class}`}>
        <Icon className="h-4 w-4" />
        <span>{config.label}</span>
      </span>
    )
  }

  const getUserStatusBadge = (event: DraftEvent) => {
    if (event.is_captain) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-600 text-white">
          <Crown className="h-3 w-3 mr-1" />
          Capitano
        </span>
      )
    }
    
    if (event.user_registration) {
      const statusConfig = {
        pending: { class: 'bg-yellow-600', label: 'In Attesa' },
        approved: { class: 'bg-green-600', label: 'Approvato' },
        drafted: { class: 'bg-purple-600', label: 'Draftato' }
      }
      
      const config = statusConfig[event.user_registration.status]
      
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${config.class}`}>
          <UserCheck className="h-3 w-3 mr-1" />
          {config.label}
        </span>
      )
    }
    
    return null
  }

  const getEventLink = (event: DraftEvent) => {
    // Admin can access full management (only in admin view)
    if (profile?.is_admin && isAdminViewActive && event.admin_id === user?.id) {
      return `/event/${event.id}`
    }
    
    // Captain can access captain view
    if (event.is_captain) {
      return `/event/${event.id}/captain`
    }
    
    // Regular users can join if registration is open, or view if already registered
    if (event.status === 'registration' && !event.user_registration) {
      return `/event/${event.id}/join`
    }
    
    // If user is registered or event is past registration, show public view
    return `/event/${event.id}/view`
  }

  const getGameIcon = (gameType?: string) => {
    if (!gameType) return <Gamepad2 className="h-5 w-5 text-green-500" />
    
    if (gameType.toLowerCase().includes('fifa')) return <Target className="h-5 w-5 text-green-500" />
    if (gameType.toLowerCase().includes('nba')) return <Trophy className="h-5 w-5 text-yellow-500" />
    return <Gamepad2 className="h-5 w-5 text-purple-500" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading"></div>
        <span className="ml-4 text-white text-lg">Caricamento eventi...</span>
      </div>
    )
  }

  const filteredEvents = getFilteredEvents()

  return (
    <div className="space-y-8">
      {/* Header with Search and Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Dashboard
            {profile?.is_admin && (
              <span className={`ml-4 text-lg font-medium ${
                isAdminViewActive ? 'text-orange-400' : 'text-blue-400'
              }`}>
                ({isAdminViewActive ? 'Vista Admin' : 'Vista Utente'})
              </span>
            )}
          </h1>
          <p className="text-xl text-white/80">
        
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca eventi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>
          
          {/* Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
            >
              <option value="all">Tutti gli Eventi</option>
              {profile?.is_admin && isAdminViewActive && <option value="my_events">I Miei Eventi</option>}
              <option value="registered">Eventi Registrati</option>
              <option value="completed">Eventi Completati</option>
            </select>
          </div>
        </div>
      </div>

      {/* Create Event Button for Admins */}
      {profile?.is_admin && isAdminViewActive && (
        <div className="flex items-center justify-end">
          <Link
            to="/create-event"
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Crea Evento</span>
          </Link>
        </div>
      )}
      
      {/* Events Grid */}
      <div className="space-y-6">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <div className="card p-12 max-w-2xl mx-auto">
              <div className="text-6xl mb-6">🎮</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                {filter === 'all' ? 'Nessun Evento Disponibile' : 
                 filter === 'my_events' ? 'Nessun Evento Creato' :
                 filter === 'registered' ? 'Nessun Evento Registrato' :
                 'Nessun Evento Completato'}
              </h3>
              <p className="text-lg text-gray-600">
                {filter === 'all' ? 'Al momento non ci sono eventi disponibili.' :
                 filter === 'my_events' ? 'Crea il tuo primo evento per iniziare!' :
                 filter === 'registered' ? 'Registrati a un evento per vederlo qui.' :
                 'Non ci sono eventi completati da mostrare.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid-auto-fit">
            {filteredEvents.map((event, index) => {
              const progress = getEventProgress(event)
              const userStatus = getUserStatusBadge(event)
              const isMyEvent = profile?.is_admin && isAdminViewActive && event.admin_id === user?.id
              
              return (
                <Link key={event.id} to={getEventLink(event)}>
                  <div 
                    className={`card p-6 cursor-pointer hover-lift fade-in ${
                      isMyEvent ? 'border-l-4 border-purple-400' :
                      event.is_captain ? 'border-l-4 border-yellow-400' :
                      event.user_registration ? 'border-l-4 border-green-400' : ''
                    }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-800 leading-tight">
                        {event.title}
                      </h3>
                      <div className="flex flex-col items-end space-y-2">
                        {getStatusBadge(event.status)}
                        {userStatus}
                        {isMyEvent && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-600 text-white">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Progresso Evento</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isMyEvent ? 'bg-gradient-to-r from-purple-400 to-purple-500' :
                            event.is_captain ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                            'bg-gradient-to-r from-blue-400 to-purple-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    
                    {event.description && (
                      <p className="text-gray-600 mb-6 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                    
                    {event.user_registration && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>La tua posizione:</strong> {event.user_registration.specific_position || event.user_registration.preferred_position}
                        </p>
                      </div>
                    )}
                    
                    {event.scheduled_at && (
                      <div className="flex items-center text-gray-700 mb-3">
                        <Calendar className="h-4 w-4 mr-2 text-purple-500" />
                        <span className="text-sm">{new Date(event.scheduled_at).toLocaleString('it-IT')}</span>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="flex items-center text-gray-700">
                        <Users className="h-5 w-5 mr-3 text-blue-500" />
                        <span className="font-medium">
                          {event.registrations?.[0]?.count || 0} / {event.max_players} Giocatori
                        </span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <Shield className="h-5 w-5 mr-3 text-purple-500" />
                        <span className="font-medium">{event.team_count} Squadre</span>
                      </div>
                      {event.game_type && (
                        <div className="flex items-center text-gray-700">
                          {getGameIcon(event.game_type)}
                          <span className="font-medium ml-3">{event.game_type}</span>
                        </div>
                      )}
                      <div className="flex items-center text-gray-700">
                        <Clock className="h-5 w-5 mr-3 text-orange-500" />
                        <span className="font-medium">
                          Creato il {new Date(event.created_at).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </div>

                    {/* Action indicator */}
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {isMyEvent ? 'Gestisci evento' :
                           event.is_captain ? 'Vista capitano' :
                           event.user_registration ? 'Visualizza dettagli' :
                           event.status === 'registration' ? 'Registrati' : 'Visualizza'}
                        </span>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}