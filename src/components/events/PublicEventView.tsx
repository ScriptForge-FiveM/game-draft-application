import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ChatManager } from '../chat/ChatManager'
import { ArrowLeft, Users, Trophy, Calendar, Clock, Gamepad2, UserPlus, ChevronDown, Save, RotateCcw, Bookmark } from 'lucide-react'
import toast from 'react-hot-toast'

interface DraftEvent {
  id: string
  title: string
  description?: string
  team_count: number
  max_players_per_team: number
  max_participants: number
  status: 'registration' | 'captain_selection' | 'drafting' | 'completed'
  game_type?: string
  scheduled_at?: string
  created_at: string
}

interface GamePosition {
  id: string
  position_code: string
  position_name: string
  position_type: 'general' | 'specific'
}

interface Registration {
  id: string
  user_id: string
  username: string
  preferred_position: string
  platform: string
  notes?: string
  status: 'pending' | 'approved' | 'drafted'
  specific_position?: string
}

interface UserDraftProfile {
  id: string
  preferred_position: string
  specific_position?: string
  platform: string
  game_name?: string
  real_team?: string
  wants_captain: boolean
  notes?: string
  is_default: boolean
}

export function PublicEventView() {
  const { eventId } = useParams<{ eventId: string }>()
  const { user, profile } = useAuth()
  const [event, setEvent] = useState<DraftEvent | null>(null)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [gamePositions, setGamePositions] = useState<GamePosition[]>([])
  const [userProfiles, setUserProfiles] = useState<UserDraftProfile[]>([])
  const [selectedProfile, setSelectedProfile] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [formData, setFormData] = useState({
    preferred_position: '',
    specific_position: '',
    platform: '',
    notes: '',
    game_name: '',
    real_team: '',
    wants_captain: false,
    save_as_profile: false,
    profile_name: ''
  })

  useEffect(() => {
    if (eventId && user) {
      fetchEventAndRegistration()
      fetchGamePositions()
      fetchUserProfiles()
    }
  }, [eventId, user])

  const fetchGamePositions = async () => {
    try {
      const { data, error } = await supabase
        .from('game_positions')
        .select('*')
        .eq('game_name', 'EA FC')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      setGamePositions(data || [])
    } catch (error) {
      console.error('Error fetching game positions:', error)
    }
  }

  const fetchUserProfiles = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('user_draft_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setUserProfiles(data || [])
      
      // Auto-select default profile if exists
      const defaultProfile = data?.find(p => p.is_default)
      if (defaultProfile) {
        setSelectedProfile(defaultProfile.id)
        loadProfileData(defaultProfile)
      }
    } catch (error) {
      console.error('Error fetching user profiles:', error)
    }
  }

  const fetchEventAndRegistration = async () => {
    try {
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('draft_events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError
      setEvent(eventData)

      // Check if user is already registered
      const { data: regData, error: regError } = await supabase
        .from('registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user?.id)
        .single()

      if (regError && regError.code !== 'PGRST116') throw regError
      setRegistration(regData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Errore nel caricamento dell\'evento')
    } finally {
      setLoading(false)
    }
  }

  const loadProfileData = (profile: UserDraftProfile) => {
    setFormData(prev => ({
      ...prev,
      preferred_position: profile.preferred_position,
      specific_position: profile.specific_position || '',
      platform: profile.platform,
      game_name: profile.game_name || '',
      real_team: profile.real_team || '',
      wants_captain: profile.wants_captain,
      notes: profile.notes || ''
    }))
  }

  const handleProfileChange = (profileId: string) => {
    setSelectedProfile(profileId)
    if (profileId) {
      const profile = userProfiles.find(p => p.id === profileId)
      if (profile) {
        loadProfileData(profile)
      }
    } else {
      // Reset form
      setFormData(prev => ({
        ...prev,
        preferred_position: '',
        specific_position: '',
        platform: '',
        game_name: '',
        real_team: '',
        wants_captain: false,
        notes: ''
      }))
    }
  }

  const saveAsProfile = async () => {
    if (!user || !formData.preferred_position || !formData.platform) {
      toast.error('Compila almeno posizione e piattaforma per salvare il profilo')
      return
    }

    setSavingProfile(true)
    try {
      // If this is the first profile, make it default
      const isFirstProfile = userProfiles.length === 0
      
      const { error } = await supabase
        .from('user_draft_profiles')
        .insert({
          user_id: user.id,
          preferred_position: formData.preferred_position,
          specific_position: formData.specific_position || null,
          platform: formData.platform,
          game_name: formData.game_name || null,
          real_team: formData.real_team || null,
          wants_captain: formData.wants_captain,
          notes: formData.notes || null,
          is_default: isFirstProfile
        })

      if (error) throw error
      
      toast.success('Profilo salvato! Potrai riutilizzarlo in futuri draft.')
      fetchUserProfiles()
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Errore nel salvataggio del profilo')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !event) return

    setRegistering(true)
    try {
      // Save as profile if requested
      if (formData.save_as_profile) {
        await saveAsProfile()
      }
      
      const { data, error } = await supabase
        .from('registrations')
        .insert({
          event_id: event.id,
          user_id: user.id,
          username: profile?.username || user.email?.split('@')[0] || 'Sconosciuto',
          preferred_position: formData.preferred_position,
          platform: formData.platform,
          specific_position: formData.specific_position || null,
          notes: formData.notes || null,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error
      
      setRegistration(data)
      toast.success('Registrazione inviata! In attesa di approvazione.')
    } catch (error) {
      console.error('Error registering:', error)
      toast.error('Errore nella registrazione all\'evento')
    } finally {
      setRegistering(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      registration: 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white',
      captain_selection: 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white',
      drafting: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white',
      completed: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
    }
    
    const labels = {
      registration: 'Registrazioni Aperte',
      captain_selection: 'Selezione Capitani',
      drafting: 'Draft Live',
      completed: 'Completato'
    }

    return (
      <span className={`inline-flex items-center px-4 py-2 text-sm font-bold rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const getRegistrationStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-600 text-white',
      approved: 'bg-green-600 text-white',
      drafted: 'bg-purple-600 text-white'
    }

    const labels = {
      pending: 'IN ATTESA',
      approved: 'APPROVATO',
      drafted: 'DRAFTATO'
    }

    return (
      <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const getGeneralPositions = () => {
    return gamePositions.filter(pos => pos.position_type === 'general')
  }

  const getSpecificPositions = (parentPositionCode?: string) => {
    if (!parentPositionCode) {
      return gamePositions.filter(pos => pos.position_type === 'specific')
    }
    return gamePositions.filter(pos => 
      pos.position_type === 'specific' && 
      pos.parent_position_code === parentPositionCode
    )
  }

  const getPositionName = (positionCode: string, isSpecific: boolean = false) => {
    const position = gamePositions.find(pos => 
      pos.position_code === positionCode && 
      pos.position_type === (isSpecific ? 'specific' : 'general')
    )
    return position?.position_name || positionCode
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-2">Evento Non Trovato</h2>
        <p className="text-gray-400 mb-4">L'evento che stai cercando non esiste.</p>
        <Link to="/" className="text-orange-400 hover:text-orange-300">
          Torna alla Home
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 py-4 md:py-8">
      <div className="flex items-center mb-8">
        <Link
          to="/"
          className="flex items-center text-white hover:text-blue-300 mr-6 transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl md:text-4xl font-bold text-white">
              {event.title}
            </h1>
            {getStatusBadge(event.status)}
          </div>
          {event.description && (
            <p className="text-white/80 text-base md:text-lg">{event.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Event Details */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="card-solid rounded-xl p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-bold text-white mb-4">Dettagli Evento</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
              <div className="solid-bg rounded-lg p-3 md:p-4 border border-[#005ee2]/30">
                <div className="flex items-center space-x-3">
                  <Users className="h-6 w-6 text-[#005ee2]" />
                  <div>
                    <p className="text-xs md:text-sm text-[#4A90E2] font-medium">Max Partecipanti</p>
                    <p className="text-lg md:text-xl font-bold text-white">{event.max_participants}</p>
                  </div>
                </div>
              </div>
              
              <div className="solid-bg rounded-lg p-3 md:p-4 border border-green-400/30">
                <div className="flex items-center space-x-3">
                  <Trophy className="h-6 w-6 text-green-400" />
                  <div>
                    <p className="text-xs md:text-sm text-green-300 font-medium">Giocatori per Squadra</p>
                    <p className="text-lg md:text-xl font-bold text-white">{event.max_players_per_team}</p>
                  </div>
                </div>
              </div>
              
              <div className="solid-bg rounded-lg p-3 md:p-4 border border-yellow-400/30">
                <div className="flex items-center space-x-3">
                  <Users className="h-6 w-6 text-yellow-400" />
                  <div>
                    <p className="text-xs md:text-sm text-yellow-300 font-medium">Squadre</p>
                    <p className="text-lg md:text-xl font-bold text-white">{event.team_count}</p>
                  </div>
                </div>
              </div>
            </div>

            {event.game_type && (
              <div className="flex items-center space-x-3 mb-4 text-white">
                <Gamepad2 className="h-5 w-5 text-green-400" />
                <span className="text-green-300 font-medium">{event.game_type}</span>
              </div>
            )}

            {event.scheduled_at && (
              <div className="flex items-center space-x-3 mb-4 text-white">
                <Calendar className="h-5 w-5 text-purple-400" />
                <span className="text-purple-300 font-medium">
                  {new Date(event.scheduled_at).toLocaleString('it-IT')}
                </span>
              </div>
            )}

            <div className="flex items-center space-x-3 text-white">
              <Clock className="h-5 w-5 text-orange-400" />
              <span className="text-orange-300 font-medium">
                Creato il {new Date(event.created_at).toLocaleDateString('it-IT')}
              </span>
            </div>
          </div>
        </div>

        {/* Registration Section */}
        <div className="space-y-4 md:space-y-6">
          {registration ? (
            <div className="card-solid rounded-xl p-4 md:p-6 border border-green-400/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg md:text-xl font-bold text-white">La Tua Registrazione</h3>
                {getRegistrationStatusBadge(registration.status)}
              </div>
              
              <div className="space-y-2 md:space-y-3 text-sm">
                <div>
                  <span className="text-white/70 font-medium">Posizione:</span>
                  <span className="text-white ml-2">{registration.preferred_position}</span>
                </div>
                <div>
                  <span className="text-white/70 font-medium">Piattaforma:</span>
                  <span className="text-white ml-2">{registration.platform}</span>
                </div>
                {registration.notes && (
                  <div>
                    <span className="text-white/70 font-medium">Note:</span>
                    <p className="text-white mt-1">{registration.notes}</p>
                  </div>
                )}
              </div>

              {registration.status === 'pending' && (
                <div className="mt-3 md:mt-4 p-3 bg-yellow-600/20 border border-yellow-400/30 rounded-lg">
                  <p className="text-yellow-200 text-sm">
                    La tua registrazione è in attesa di approvazione dall'organizzatore dell'evento.
                  </p>
                </div>
              )}

              {registration.status === 'approved' && (
                <div className="mt-3 md:mt-4 p-3 bg-green-600/20 border border-green-400/30 rounded-lg">
                  <p className="text-green-200 text-sm">
                    La tua registrazione è stata approvata! Sarai avvisato quando inizierà il draft.
                  </p>
                </div>
              )}
            </div>
          ) : event.status === 'registration' ? (
            <div className="card-solid rounded-xl p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center">
                <UserPlus className="h-5 w-5 mr-2" />
                Registrati all'Evento
              </h3>
              
              {/* Profile Selection */}
              {userProfiles.length > 0 && (
                <div className="mb-4 md:mb-6 p-3 md:p-4 bg-blue-600/20 border border-blue-400/30 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-white flex items-center text-sm md:text-base">
                      <Bookmark className="h-4 w-4 mr-2" />
                      Usa Profilo Salvato
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleProfileChange('')}
                      className="text-xs text-blue-300 hover:text-blue-200 flex items-center"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </button>
                  </div>
                  <select
                    value={selectedProfile}
                    onChange={(e) => handleProfileChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border-2 border-[#005ee2]/30 rounded-xl text-white focus:border-[#005ee2] focus:ring-2 focus:ring-[#005ee2]/20 transition-all"
                  >
                    <option value="">Compila manualmente</option>
                    {userProfiles.map(profile => (
                      <option key={profile.id} value={profile.id}>
                        {getPositionName(profile.preferred_position)} - {profile.platform}
                        {profile.is_default ? ' (Predefinito)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <form onSubmit={handleRegistration} className="space-y-3 md:space-y-4">
                <div>
                  <label htmlFor="preferred_position" className="block text-sm font-bold text-white mb-1 md:mb-2">
                    Posizione Generale *
                  </label>
                  <select
                    id="preferred_position"
                    name="preferred_position"
                    required
                    value={formData.preferred_position}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-slate-700 border-2 border-[#005ee2]/30 rounded-xl text-white focus:border-[#005ee2] focus:ring-2 focus:ring-[#005ee2]/20 transition-all"
                  >
                    <option value="">Seleziona Posizione</option>
                    {getGeneralPositions().map(position => (
                      <option key={position.id} value={position.position_code}>{position.position_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="specific_position" className="block text-sm font-bold text-white mb-1 md:mb-2">
                    Posizione Specifica *
                  </label>
                  <select
                    id="specific_position"
                    name="specific_position"
                    required
                    value={formData.specific_position}
                    onChange={handleChange}
                    disabled={!formData.preferred_position}
                    className="w-full px-3 py-2 bg-slate-700 border-2 border-[#005ee2]/30 rounded-xl text-white focus:border-[#005ee2] focus:ring-2 focus:ring-[#005ee2]/20 transition-all disabled:opacity-50"
                  >
                    <option value="">
                      {formData.preferred_position ? 'Seleziona Posizione Specifica' : 'Prima seleziona posizione generale'}
                    </option>
                    {getSpecificPositions(formData.preferred_position).map(position => (
                      <option key={position.id} value={position.position_code}>{position.position_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="platform" className="block text-sm font-bold text-white mb-1 md:mb-2">
                    Piattaforma *
                  </label>
                  <select
                    id="platform"
                    name="platform"
                    required
                    value={formData.platform}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-slate-700 border-2 border-[#005ee2]/30 rounded-xl text-white focus:border-[#005ee2] focus:ring-2 focus:ring-[#005ee2]/20 transition-all"
                  >
                    <option value="">Seleziona Piattaforma</option>
                    <option value="PC">PC</option>
                    <option value="PlayStation">PlayStation</option>
                    <option value="Xbox">Xbox</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="game_name" className="block text-sm font-bold text-white mb-1 md:mb-2">
                    Nome in Gioco
                  </label>
                  <input
                    type="text"
                    id="game_name"
                    name="game_name"
                    value={formData.game_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-slate-700 border-2 border-[#005ee2]/30 rounded-xl text-white placeholder-slate-400 focus:border-[#005ee2] focus:ring-2 focus:ring-[#005ee2]/20 transition-all"
                    placeholder="Il tuo nome nel gioco..."
                  />
                </div>

                <div>
                  <label htmlFor="real_team" className="block text-sm font-bold text-white mb-1 md:mb-2">
                    Team di Appartenenza Reale
                  </label>
                  <input
                    type="text"
                    id="real_team"
                    name="real_team"
                    value={formData.real_team}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-slate-700 border-2 border-[#005ee2]/30 rounded-xl text-white placeholder-slate-400 focus:border-[#005ee2] focus:ring-2 focus:ring-[#005ee2]/20 transition-all"
                    placeholder="Es. Juventus, Real Madrid..."
                  />
                </div>

                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="wants_captain"
                    name="wants_captain"
                    checked={formData.wants_captain}
                    onChange={(e) => setFormData(prev => ({ ...prev, wants_captain: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 mt-1"
                  />
                  <label htmlFor="wants_captain" className="text-sm font-bold text-white">
                    Sono disponibile a fare il capitano
                  </label>
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-bold text-white mb-1 md:mb-2">
                    Note Aggiuntive
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-slate-700 border-2 border-[#005ee2]/30 rounded-xl text-white placeholder-slate-400 focus:border-[#005ee2] focus:ring-2 focus:ring-[#005ee2]/20 transition-all resize-none"
                    placeholder="Informazioni aggiuntive..."
                  />
                </div>

                {/* Save Profile Option */}
                <div className="border-t border-slate-600 pt-3 md:pt-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <input
                      type="checkbox"
                      id="save_as_profile"
                      name="save_as_profile"
                      checked={formData.save_as_profile}
                      onChange={(e) => setFormData(prev => ({ ...prev, save_as_profile: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="save_as_profile" className="text-sm font-bold text-white">
                      Salva queste informazioni per futuri draft
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">
                    Potrai riutilizzare rapidamente questi dati in eventi futuri
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={registering}
                  className="w-full btn-primary px-4 md:px-6 py-3 rounded-xl font-bold disabled:opacity-50 text-sm md:text-base"
                >
                  {registering ? (
                    <>
                      <div className="loading w-4 h-4 mr-2 inline-block"></div>
                      Registrazione...
                    </>
                  ) : (
                    'Registrati all\'Evento'
                  )}
                </button>
                
                {/* Quick Save Profile Button */}
                {!formData.save_as_profile && formData.preferred_position && formData.platform && (
                  <button
                    type="button"
                    onClick={saveAsProfile}
                    disabled={savingProfile}
                    className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 text-sm md:text-base"
                  >
                    {savingProfile ? (
                      <>
                        <div className="loading w-4 h-4"></div>
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Salva come Profilo</span>
                      </>
                    )}
                  </button>
                )}
              </form>
            </div>
          ) : (
            <div className="card-solid rounded-xl p-4 md:p-6 border border-yellow-400/30">
              <h3 className="text-lg md:text-xl font-bold text-white mb-4">Registrazioni Chiuse</h3>
              <p className="text-yellow-200">
                Le registrazioni per questo evento non sono più disponibili. L'evento è attualmente nella fase {event.status.replace('_', ' ')}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Public Event Chat - Show for registered users */}
      {registration && (
        <div className="mt-8">
          <ChatManager 
            eventId={event.id} 
            isAdmin={false}
            defaultTab="event"
          />
        </div>
      )}
    </div>
  )
}