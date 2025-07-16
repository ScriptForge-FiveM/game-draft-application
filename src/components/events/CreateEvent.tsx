import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Calendar, Users, Trophy, ArrowLeft, Zap, Settings, Shield, Gamepad2, Twitch } from 'lucide-react'
import toast from 'react-hot-toast'

interface Game {
  id: string
  name: string
  category: string
}

export function CreateEvent() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    organizer_name: '',
    twitch_channel: '',
    team_count: 4,
    max_players_per_team: 5,
    max_participants: 20,
    game_id: '',
    discord_server_id: '',
    scheduled_at: ''
  })

  useEffect(() => {
    fetchGames()
  }, [])

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      setGames(data || [])
    } catch (error) {
      console.error('Error fetching games:', error)
      toast.error('Errore nel caricamento dei giochi')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      // Get selected game name
      const selectedGame = games.find(g => g.id === formData.game_id)
      
      // Convert scheduled_at to UTC if provided
      let scheduledAtUTC = null
      if (formData.scheduled_at) {
        // Create a Date object from the datetime-local input (interpreted as local time)
        const localDate = new Date(formData.scheduled_at)
        // Convert to UTC ISO string
        scheduledAtUTC = localDate.toISOString()
      }
      
      const { data, error } = await supabase
        .from('draft_events')
        .insert({
          title: formData.title,
          description: formData.description || null,
          organizer_name: formData.organizer_name || null,
          twitch_channel: formData.twitch_channel || null,
          admin_id: user.id,
          team_count: formData.team_count,
          max_players_per_team: formData.max_players_per_team,
          max_players: formData.max_participants,
          max_participants: formData.max_participants,
          game_type: selectedGame?.name || null,
          discord_server_id: formData.discord_server_id || null,
          scheduled_at: scheduledAtUTC,
          status: 'registration'
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Evento creato con successo!')
      navigate(`/event/${data.id}`)
    } catch (error) {
      console.error('Error creating event:', error)
      toast.error('Errore nella creazione dell\'evento')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'team_count' || name === 'max_players_per_team' || name === 'max_participants' ? parseInt(value) : value
    }))
  }

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  // Check if user is admin
  if (!profile?.is_admin) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 text-center">
          <div className="flex items-center justify-center mb-6">
            <Shield className="h-16 w-16 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Accesso Negato</h2>
          <p className="text-red-300 text-lg mb-8">
            Solo gli amministratori possono creare eventi draft. Contatta un amministratore se hai bisogno di accesso.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary inline-flex items-center px-6 py-3 rounded-lg font-bold"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna alla Dashboard
          </button>
        </div>
      </div>
    )
  }

  const gamesByCategory = games.reduce((acc, game) => {
    if (!acc[game.category]) {
      acc[game.category] = []
    }
    acc[game.category].push(game)
    return acc
  }, {} as Record<string, Game[]>)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-orange-400 hover:text-orange-300 mr-6 transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Crea Evento Draft
          </h1>
          <p className="text-white/80 text-lg mt-2">Configura un nuovo draft live per la tua community</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-bold text-white mb-3">
                Titolo Evento *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                placeholder="Friday Night FIFA Draft"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-bold text-white mb-3">
                Descrizione
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all resize-none"
                placeholder="Evento draft settimanale per Pro Clubs..."
              />
            </div>

            <div>
              <label htmlFor="organizer_name" className="block text-sm font-bold text-white mb-3">
                Nome Organizzatore
              </label>
              <input
                type="text"
                id="organizer_name"
                name="organizer_name"
                value={formData.organizer_name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                placeholder="Lil Turbino"
              />
            </div>

            <div>
              <label htmlFor="twitch_channel" className="block text-sm font-bold text-white mb-3">
                <Twitch className="h-4 w-4 inline mr-2" />
                Canale Twitch
              </label>
              <input
                type="text"
                id="twitch_channel"
                name="twitch_channel"
                value={formData.twitch_channel}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                placeholder="lilturbino"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div>
              <label htmlFor="game_id" className="block text-sm font-bold text-white mb-3">
                <Gamepad2 className="h-4 w-4 inline mr-2" />
                Gioco *
              </label>
              <select
                id="game_id"
                name="game_id"
                required
                value={formData.game_id}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              >
                <option value="">Seleziona un gioco</option>
                {Object.entries(gamesByCategory).map(([category, categoryGames]) => (
                  <optgroup key={category} label={category}>
                    {categoryGames.map(game => (
                      <option key={game.id} value={game.id}>{game.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="team_count" className="block text-sm font-bold text-white mb-3">
                  <Trophy className="h-4 w-4 inline mr-2" />
                  Numero Squadre *
                </label>
                <select
                  id="team_count"
                  name="team_count"
                  required
                  value={formData.team_count}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map(num => (
                    <option key={num} value={num}>{num} Squadre</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="max_players_per_team" className="block text-sm font-bold text-white mb-3">
                  <Users className="h-4 w-4 inline mr-2" />
                  Giocatori per Squadra *
                </label>
                <input
                  type="number"
                  id="max_players_per_team"
                  name="max_players_per_team"
                  required
                  min={3}
                  max={11}
                  value={formData.max_players_per_team}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="max_participants" className="block text-sm font-bold text-white mb-3">
                <Users className="h-4 w-4 inline mr-2" />
                Max Partecipanti Totali *
              </label>
              <input
                type="number" 
                id="max_participants"
                name="max_participants"
                required
                min={formData.team_count}
                max={100}
                value={formData.max_participants}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

            <div>
              <label htmlFor="discord_server_id" className="block text-sm font-bold text-white mb-3">
                <Settings className="h-4 w-4 inline mr-2" />
                Discord Server ID
              </label>
              <input
                type="text"
                id="discord_server_id"
                name="discord_server_id"
                value={formData.discord_server_id}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                placeholder="Opzionale: Limita ai membri del server Discord"
              />
            </div>

            <div>
              <label htmlFor="scheduled_at" className="block text-sm font-bold text-white mb-3">
                <Calendar className="h-4 w-4 inline mr-2" />
                Data/Ora Programmata
              </label>
              <input
                type="datetime-local"
                id="scheduled_at"
                name="scheduled_at"
                value={formData.scheduled_at}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-6 pt-6 border-t border-gray-700">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-8 py-3 rounded-lg font-bold disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creando...
              </>
            ) : (
              'Crea Evento'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}