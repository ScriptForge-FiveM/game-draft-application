import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Footer } from '../Footer'
import { CookieConsent } from '../CookieConsent'
import { Gamepad2, Calendar, Users, Play, LogOut, Clock, Trophy, Target, Shield, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface DraftEvent {
  id: string
  title: string
  description?: string
  organizer_name?: string
  twitch_channel?: string
  team_count: number
  max_participants: number
  status: 'registration' | 'captain_selection' | 'drafting' | 'completed'
  game_type?: string
  scheduled_at?: string
  created_at: string
}

interface Registration {
  id: string
  event_id: string
  user_id: string
  status: 'pending' | 'approved' | 'drafted'
}

export function ProtectedLoginPage() {
  const { user, signOut, signInWithDiscord } = useAuth()
  const [events, setEvents] = useState<DraftEvent[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [userRegistrations, setUserRegistrations] = useState<Registration[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    fetchEvents()
    if (user) {
      fetchUserRegistrations()
    }
  }, [user])

  const fetchEvents = async () => {
    try {
      console.log('🔍 Fetching events...')
      
      // Fetch all events (registration, captain_selection, drafting)
      const { data: eventsData, error: eventsError } = await supabase
        .from('draft_events')
        .select('*')
        .in('status', ['registration', 'captain_selection', 'drafting'])
        .order('created_at', { ascending: false })

      if (eventsError) {
        console.error('❌ Supabase events error:', eventsError)
        throw eventsError
      }
      
      console.log('📊 Events data received:', eventsData)
      
      // Fetch all registrations (no auth required for reading)
      const { data: registrationsData, error: registrationsError } = await supabase
        .from('registrations')
        .select('*')

      if (registrationsError) {
        console.error('❌ Supabase registrations error:', registrationsError)
        throw registrationsError
      }

      console.log('📋 Registrations data received:', registrationsData)
      
      setEvents(eventsData || [])
      setRegistrations(registrationsData || [])
    } catch (error) {
      console.error('💥 Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserRegistrations = async () => {
    if (!user) return
    
    try {
      const { data: userRegsData, error: userRegsError } = await supabase
        .from('registrations')
        .select('*')
        .eq('user_id', user.id)

      if (userRegsError) throw userRegsError
      setUserRegistrations(userRegsData || [])
    } catch (error) {
      console.error('Error fetching user registrations:', error)
    }
  }

  const getRegistrationCount = (eventId: string) => {
    return registrations.filter(reg => reg.event_id === eventId).length
  }

  const getUserRegistrationForEvent = (eventId: string) => {
    return userRegistrations.find(reg => reg.event_id === eventId)
  }

  const handleDiscordLogin = async () => {
    setSigningIn(true)
    try {
      console.log('🎮 Attempting Discord login...')
      await signInWithDiscord()
      toast.success('Reindirizzamento a Discord...')
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Errore durante il login con Discord. Verifica la configurazione.')
    } finally {
      setSigningIn(false)
    }
  }

  const handleEventLogin = (eventId: string) => {
    setSelectedEvent(eventId)
    localStorage.setItem('selectedEvent', eventId)
    handleDiscordLogin()
  }

  const handleSignOut = async () => {
    if (!user) {
      console.log('ℹ️ No user to sign out')
      return
    }
    
    setSigningOut(true)
    try {
      await signOut()
      setSelectedEvent(null)
      localStorage.removeItem('selectedEvent')
      toast.success('Disconnesso con successo!')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Errore durante la disconnessione')
    } finally {
      setSigningOut(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      registration: { 
        class: 'bg-green-500 text-white', 
        label: 'Registrazioni',
        icon: Users
      },
      captain_selection: { 
        class: 'bg-yellow-500 text-white', 
        label: 'Selezione Capitani',
        icon: Shield
      },
      drafting: { 
        class: 'bg-red-500 text-white', 
        label: 'Draft Live',
        icon: Play
      }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig]
    const Icon = config.icon

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.class}`}>
        <Icon className="h-4 w-4 mr-1" />
        <span>{config.label}</span>
      </span>
    )
  }

  const getGameIcon = (gameType?: string) => {
    if (!gameType) return <Gamepad2 className="h-5 w-5 text-orange-500" />
    
    if (gameType.toLowerCase().includes('fifa')) return <Target className="h-5 w-5 text-green-500" />
    if (gameType.toLowerCase().includes('nba')) return <Trophy className="h-5 w-5 text-yellow-500" />
    return <Gamepad2 className="h-5 w-5 text-purple-500" />
  }

  const eventsToShow = events

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 py-6 md:py-12 px-4 sm:px-6 lg:px-8">
      {/* Discord Login/Logout Floating Button */}
      <div className="fixed top-4 left-4 md:top-6 md:left-6 z-50">
        {user ? (
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-3 md:px-6 py-2 md:py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 md:space-x-3 group disabled:opacity-50 text-sm md:text-base"
          >
            {signingOut ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span className="hidden md:inline">Disconnettendo...</span>
              </>
            ) : (
              <>
                <LogOut className="w-6 h-6" />
                <span className="hidden md:inline group-hover:scale-105 transition-transform">Disconnetti</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleDiscordLogin}
            disabled={signingIn}
            className="bg-gradient-to-r from-[#005ee2] to-[#004BB8] hover:from-[#004BB8] hover:to-[#003A8C] text-white px-3 md:px-6 py-2 md:py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 md:space-x-3 group disabled:opacity-50 text-sm md:text-base"
          >
            {signingIn ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span className="hidden md:inline">Connettendo...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/>
                </svg>
                <span className="hidden md:inline group-hover:scale-105 transition-transform">Accedi con Discord</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 md:mb-16">
          <div className="flex flex-col md:flex-row items-center justify-center mb-6 md:mb-8">
            <img 
              src="/image.png" 
              alt="Game Draft Logo" 
              className="h-32 w-32 md:h-48 md:w-48 mb-4 md:mb-0 md:mr-6"
            />
            <div>
              <h1 className="text-3xl md:text-6xl font-bold text-white mb-2">
                Lil Turbino Events
              </h1>
            </div>
          </div>
          
          <h2 className="text-2xl md:text-4xl font-bold primary mb-4 md:mb-6">
            Eventi Draft Live
          </h2>
          <p className="text-base md:text-xl text-white/80 leading-relaxed max-w-4xl mx-auto px-4">
            Partecipa agli eventi draft esclusivi organizzati da Lil Turbino. Registrati, scegli la tua posizione e dimostra le tue abilità!
          </p>
        </div>

   

        {/* Social Floating Buttons - Desktop Only */}
        <div className="hidden md:block fixed right-6 top-1/2 transform -translate-y-1/2 z-50 space-y-4">
          <a
            href="https://www.twitch.tv/lilturbinotv"
            target="_blank"
            rel="noopener noreferrer"
            className="social-button twitch-button group"
            title="Segui su Twitch"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
            </svg>
            <span className="social-tooltip">Twitch</span>
          </a>
          
          <a
            href="https://discord.gg/QMZKJ9ar7t"
            target="_blank"
            rel="noopener noreferrer"
            className="social-button discord-button group"
            title="Unisciti al Discord"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/>
            </svg>
            <span className="social-tooltip">Discord</span>
          </a>
          
          <a
            href="https://www.youtube.com/@lilturbino"
            target="_blank"
            rel="noopener noreferrer"
            className="social-button youtube-button group"
            title="Iscriviti su YouTube"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span className="social-tooltip">YouTube</span>
          </a>
          
          <a
            href="https://www.instagram.com/lilturbino"
            target="_blank"
            rel="noopener noreferrer"
            className="social-button instagram-button group"
            title="Seguici su Instagram"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.40s-.644-1.44-1.439-1.44z"/>
            </svg>
            <span className="social-tooltip">Instagram</span>
          </a>
        </div>

        {/* Events Grid */}
        <div className="mb-8 md:mb-16">
          {loading ? (
            <div className="flex items-center justify-center py-8 md:py-16">
              <div className="loading"></div>
              <span className="ml-4 text-white text-base md:text-lg">Caricamento eventi...</span>
            </div>
          ) : (
            <>
              {eventsToShow.length === 0 ? (
                <div className="text-center py-8 md:py-16">
                  <div className="card-solid p-6 md:p-12 max-w-2xl mx-auto">
                    <div className="text-6xl mb-6">🎮</div>
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-4">Nessun Evento Disponibile</h3>
                    <p className="text-base md:text-lg text-slate-300">
                      Al momento non ci sono eventi aperti per le registrazioni. Torna più tardi per nuovi tornei!
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`grid gap-4 md:gap-6 ${
                  eventsToShow.length === 1 
                    ? 'grid-cols-1 max-w-sm md:max-w-md mx-auto' 
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}>
                  {eventsToShow.map((event, index) => (
                    <div 
                      key={event.id} 
                      className="card-solid p-4 md:p-6 hover-lift fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {/* User Registration Status */}
                      {user && getUserRegistrationForEvent(event.id) && (
                        <div className="mb-3 md:mb-4 p-2 md:p-3 bg-green-600/20 border border-green-400/30 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span className="text-green-300 text-xs md:text-sm font-medium">
                              Già registrato
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-lg md:text-xl font-bold text-white leading-tight flex-1 mr-2">{event.title}</h3>
                        <div className="flex flex-col items-end space-y-1 md:space-y-2 flex-shrink-0">
                          {getStatusBadge(event.status)}
                          {event.twitch_channel && (
                            <a
                              href={`https://www.twitch.tv/${event.twitch_channel}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2 md:px-3 py-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-xs font-medium rounded-full transition-all duration-200 hover:scale-105 hover:shadow-lg"
                            >
                              <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                              </svg>
                              <span className="hidden sm:inline">Guarda su Twitch</span>
                              <span className="sm:hidden">Twitch</span>
                              <svg className="h-2 w-2 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                      
                      {event.description && (
                        <p className="text-slate-300 mb-4 md:mb-6 line-clamp-2 text-sm md:text-base">
                          {event.description}
                        </p>
                      )}
                      
                      <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                        <div className="flex items-center text-slate-300">
                          <Users className="h-5 w-5 mr-3 text-[#005ee2]" />
                          <span className="font-medium text-sm md:text-base">
                            {getRegistrationCount(event.id)} / {event.max_participants} Partecipanti
                          </span>
                        </div>
                        <div className="flex items-center text-slate-300">
                         <Shield className="h-5 w-5 mr-3 text-[#005ee2]" />
                          <span className="font-medium text-sm md:text-base">{event.team_count} Squadre</span>
                        </div>
                        {event.game_type && (
                          <div className="flex items-center text-slate-300">
                            {getGameIcon(event.game_type)}
                            <span className="font-medium ml-3 text-sm md:text-base">{event.game_type}</span>
                          </div>
                        )}
                        {event.organizer_name && (
                          <div className="flex items-center text-slate-300">
                           <Users className="h-5 w-5 mr-3 text-[#005ee2]" />
                            <span className="font-medium text-sm md:text-base">Organizzatore: {event.organizer_name}</span>
                          </div>
                        )}
                        {event.scheduled_at && (
                          <div className="flex items-center text-slate-300">
                           <Clock className="h-5 w-5 mr-3 text-[#005ee2]" />
                            <span className="font-medium text-xs md:text-sm">
                              {new Date(event.scheduled_at).toLocaleString('it-IT', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleEventLogin(event.id)}
                        disabled={signingIn}
                        className={`w-full flex items-center justify-center text-sm md:text-base ${
                          user && getUserRegistrationForEvent(event.id)
                            ? 'btn-secondary'
                            : event.status === 'registration' 
                            ? 'btn-primary' 
                           : 'bg-gray-600 text-white cursor-not-allowed opacity-50 px-4 py-2 rounded-xl'
                        } disabled:opacity-50`}
                      >
                        <Play className="h-5 w-5 mr-2" />
                        {user && getUserRegistrationForEvent(event.id) 
                          ? 'Visualizza Evento' 
                          : event.status === 'registration' 
                          ? 'Unisciti all\'Evento' 
                          : 'Registrazioni Chiuse'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Info Section */}
        <div className="max-w-4xl mx-auto text-center">
          <div className="card-solid p-6 md:p-8">
            <div className="text-4xl mb-6">🎮</div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Pronto per Competere?
            </h3>
            <p className="text-base md:text-lg text-slate-300 mb-6 md:mb-8 leading-relaxed">
              Usa il pulsante "Accedi con Discord" in alto a sinistra per entrare nella piattaforma e unirti agli eventi. 
              Oppure clicca direttamente su un evento per registrarti immediatamente!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="text-center">
                <div className="bg-[#005ee2]/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-[#005ee2]" />
                </div>
                <h4 className="font-bold text-white mb-2">Registrati</h4>
                <p className="text-slate-300 text-sm">Accedi con Discord e scegli il tuo evento</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-8 w-8 text-green-600" />
                </div>
                <h4 className="font-bold text-white mb-2">Partecipa</h4>
                <p className="text-slate-300 text-sm">Entra nel draft e forma la tua squadra</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Play className="h-8 w-8 text-purple-600" />
                </div>
                <h4 className="font-bold text-white mb-2">Competi</h4>
                <p className="text-slate-300 text-sm">Gioca nel torneo e vinci premi</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      
      <Footer />
      <CookieConsent />
    </div>
  )
}