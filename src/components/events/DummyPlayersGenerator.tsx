import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Plus, Trash2, Shuffle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface DummyPlayersGeneratorProps {
  eventId: string
  onPlayersGenerated: () => void
}

const DUMMY_PLAYERS = [
  // Portieri
  { username: 'GK_Buffon', position: 'Portiere', platform: 'PC', wants_captain: false },
  { username: 'GK_Donnarumma', position: 'Portiere', platform: 'PlayStation', wants_captain: false },
  { username: 'GK_Handanovic', position: 'Portiere', platform: 'Xbox', wants_captain: false },
  
  // Difensori
  { username: 'DF_Chiellini', position: 'Difensore Centrale', platform: 'PC', wants_captain: true },
  { username: 'DF_Bonucci', position: 'Difensore Centrale', platform: 'PlayStation', wants_captain: true },
  { username: 'DF_Spinazzola', position: 'Terzino Sinistro', platform: 'Xbox', wants_captain: false },
  { username: 'DF_DiLorenzo', position: 'Terzino Destro', platform: 'PC', wants_captain: false },
  { username: 'DF_Bastoni', position: 'Difensore Centrale', platform: 'PlayStation', wants_captain: false },
  { username: 'DF_Calabria', position: 'Terzino Destro', platform: 'Xbox', wants_captain: false },
  { username: 'DF_Acerbi', position: 'Difensore Centrale', platform: 'PC', wants_captain: false },
  
  // Centrocampisti
  { username: 'MC_Verratti', position: 'Centrocampista Centrale', platform: 'PlayStation', wants_captain: true },
  { username: 'MC_Barella', position: 'Centrocampista Centrale', platform: 'Xbox', wants_captain: true },
  { username: 'MC_Jorginho', position: 'Regista', platform: 'PC', wants_captain: true },
  { username: 'MC_Pellegrini', position: 'Trequartista', platform: 'PlayStation', wants_captain: false },
  { username: 'MC_Tonali', position: 'Centrocampista Centrale', platform: 'Xbox', wants_captain: false },
  { username: 'MC_Locatelli', position: 'Centrocampista Centrale', platform: 'PC', wants_captain: false },
  { username: 'MC_Chiesa', position: 'Ala Destra', platform: 'PlayStation', wants_captain: false },
  { username: 'MC_Insigne', position: 'Ala Sinistra', platform: 'Xbox', wants_captain: false },
  
  // Attaccanti
  { username: 'FW_Immobile', position: 'Centravanti', platform: 'PC', wants_captain: true },
  { username: 'FW_Belotti', position: 'Centravanti', platform: 'PlayStation', wants_captain: false },
  { username: 'FW_Bernardeschi', position: 'Seconda Punta', platform: 'Xbox', wants_captain: false },
  { username: 'FW_Kean', position: 'Centravanti', platform: 'PC', wants_captain: false },
  { username: 'FW_Zaniolo', position: 'Trequartista', platform: 'PlayStation', wants_captain: false },
  { username: 'FW_Raspadori', position: 'Seconda Punta', platform: 'Xbox', wants_captain: false },
  { username: 'FW_Scamacca', position: 'Centravanti', platform: 'PC', wants_captain: false },
  { username: 'FW_Politano', position: 'Ala Destra', platform: 'PlayStation', wants_captain: false },
  { username: 'FW_Lautaro', position: 'Centravanti', platform: 'Xbox', wants_captain: true },
  { username: 'FW_Osimhen', position: 'Centravanti', platform: 'PC', wants_captain: false },
]

export function DummyPlayersGenerator({ eventId, onPlayersGenerated }: DummyPlayersGeneratorProps) {
  const [generating, setGenerating] = useState(false)
  const [clearing, setClearning] = useState(false)
  const [count, setCount] = useState(16)
  const [error, setError] = useState<string | null>(null)

  const generateDummyPlayers = async () => {
    setGenerating(true)
    setError(null)
    
    try {
      console.log('🎮 Generating dummy players...', { eventId, count })
      
      // Check if user is admin first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Devi essere autenticato per generare giocatori dummy')
      }

      // Verify admin status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.is_admin) {
        throw new Error('Solo gli amministratori possono generare giocatori dummy')
      }

      // Shuffle and take the requested number of players
      const shuffledPlayers = [...DUMMY_PLAYERS].sort(() => Math.random() - 0.5)
      const selectedPlayers = shuffledPlayers.slice(0, count)
      
      console.log('👥 Selected players:', selectedPlayers)
      
      // Create dummy registrations using the current admin user as base
      // This is a workaround since we can't create auth users programmatically
      const playersToInsert = selectedPlayers.map((player) => {
        return {
          event_id: eventId,
          user_id: user.id, // Use admin's user_id as placeholder
          username: player.username,
          preferred_position: player.position,
          platform: player.platform,
          status: 'approved' as const,
          wants_captain: player.wants_captain,
          notes: `Giocatore di test generato automaticamente - ${player.username}`,
          game_name: player.username,
          real_team: 'Team Test'
        }
      })

      console.log('📝 Data to insert:', playersToInsert)

      // Insert players one by one to handle duplicates
      const insertedPlayers = []
      for (const playerData of playersToInsert) {
        try {
          // Check if a registration with this username already exists for this event  
          const { data: existing } = await supabase
            .from('registrations')
            .select('id')
            .eq('event_id', eventId)
            .eq('username', playerData.username)
            .single()

          if (existing) {
            console.log(`⚠️ Player ${playerData.username} already exists, skipping`)
            continue
          }

          const { data: inserted, error: insertError } = await supabase
            .from('registrations')
            .insert(playerData)
            .select()
            .single()

          if (insertError) {
            console.error(`❌ Error inserting ${playerData.username}:`, insertError)
            continue
          }

          insertedPlayers.push(inserted)
          console.log(`✅ Successfully inserted: ${playerData.username}`)
        } catch (error) {
          console.error(`💥 Error processing ${playerData.username}:`, error)
        }
      }

      if (insertedPlayers.length === 0) {
        // Check if all players already exist
        const existingCount = selectedPlayers.length - insertedPlayers.length
        if (existingCount === selectedPlayers.length) {
          throw new Error(`Tutti i ${selectedPlayers.length} giocatori selezionati esistono già. Prova a rimuovere i dummy esistenti prima.`)
        } else {
          throw new Error('Nessun nuovo giocatore è stato creato')
        }
      }

      console.log('✅ Successfully inserted players:', insertedPlayers.length)
      toast.success(`${insertedPlayers.length} giocatori dummy generati con successo!`)
      onPlayersGenerated()

    } catch (error) {
      console.error('💥 Error generating dummy players:', error)
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
      setError(errorMessage)
      toast.error(`Errore nella generazione: ${errorMessage}`)
    } finally {
      setGenerating(false)
    }
  }

  const clearDummyPlayers = async () => {
    setClearning(true)
    setError(null)
    
    try {
      console.log('🧹 Clearing dummy players for event:', eventId)
      
      // Check admin permissions
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Devi essere autenticato per rimuovere giocatori dummy')
      }

      // Delete dummy players by checking the notes field and username patterns
      const { error, count: deletedCount } = await supabase
        .from('registrations')
        .delete({ count: 'exact' })
        .eq('event_id', eventId)
        .like('notes', '%Giocatore di test generato automaticamente%')

      if (error) throw error

      console.log('🗑️ Deleted players count:', deletedCount)
      
      toast.success(`${deletedCount || 0} giocatori dummy rimossi con successo!`)
      onPlayersGenerated()
    } catch (error) {
      console.error('💥 Error clearing dummy players:', error)
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
      setError(errorMessage)
      toast.error(`Errore nella rimozione: ${errorMessage}`)
    } finally {
      setClearning(false)
    }
  }

  return (
    <div className="glass rounded-xl p-6 border border-yellow-400/30 bg-yellow-900/10">
      <div className="flex items-center space-x-3 text-yellow-300 mb-4">
        <Users className="h-6 w-6" />
        <h4 className="font-bold text-xl">Generatore Giocatori Test</h4>
      </div>
      
      <p className="text-yellow-200 mb-6 leading-relaxed">
        Genera giocatori dummy per testare il sistema di draft e tornei. Questi giocatori verranno automaticamente approvati.
      </p>
      
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 text-red-300">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Errore:</span>
          </div>
          <p className="text-red-200 text-sm mt-1">{error}</p>
        </div>
      )}
      
      <div className="flex items-center space-x-6 mb-6">
        <div className="flex items-center space-x-3">
          <label className="text-yellow-200 font-medium">Numero giocatori:</label>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCount(Math.max(4, count - 1))}
              className="w-8 h-8 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full font-bold transition-colors"
              disabled={generating || clearing}
            >
              -
            </button>
            <span className="w-12 text-center font-bold text-yellow-100 text-lg">{count}</span>
            <button
              onClick={() => setCount(Math.min(DUMMY_PLAYERS.length, count + 1))}
              className="w-8 h-8 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full font-bold transition-colors"
              disabled={generating || clearing}
            >
              +
            </button>
          </div>
          <span className="text-yellow-300 text-sm">
            (max {DUMMY_PLAYERS.length})
          </span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <button
          onClick={generateDummyPlayers}
          disabled={generating || clearing}
          className="flex items-center px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Generando...
            </>
          ) : (
            <>
              <Plus className="h-5 w-5 mr-2" />
              Genera {count} Giocatori
            </>
          )}
        </button>
        
        <button
          onClick={clearDummyPlayers}
          disabled={generating || clearing}
          className="flex items-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
        >
          {clearing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Rimuovendo...
            </>
          ) : (
            <>
              <Trash2 className="h-5 w-5 mr-2" />
              Rimuovi Dummy
            </>
          )}
        </button>
        
        <button
          onClick={() => {
            const shuffled = [...DUMMY_PLAYERS].sort(() => Math.random() - 0.5)
            console.log('🎲 Shuffled players preview:', shuffled.slice(0, 5))
            toast.success('Lista giocatori rimescolata!')
          }}
          disabled={generating || clearing}
          className="flex items-center px-4 py-3 glass border border-white/20 hover:border-white/30 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
        >
          <Shuffle className="h-5 w-5 mr-2" />
          Rimescola
        </button>
      </div>
      
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <h5 className="font-medium text-blue-200 mb-2">Giocatori Disponibili:</h5>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
          {DUMMY_PLAYERS.slice(0, 12).map((player, index) => (
            <div key={index} className="flex items-center space-x-2 text-blue-100">
              <span className={`w-2 h-2 rounded-full ${
                player.wants_captain ? 'bg-yellow-400' : 'bg-blue-400'
              }`}></span>
              <span className="truncate">{player.username}</span>
            </div>
          ))}
          {DUMMY_PLAYERS.length > 12 && (
            <div className="text-blue-300 text-xs">
              +{DUMMY_PLAYERS.length - 12} altri...
            </div>
          )}
        </div>
        <p className="text-blue-300 text-xs mt-2">
          <span className="inline-flex items-center">
            <span className="w-2 h-2 bg-yellow-400 rounded-full mr-1"></span>
            Vuole fare il capitano
          </span>
          <span className="inline-flex items-center ml-4">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
            Giocatore normale
          </span>
        </p>
      </div>
    </div>
  )
}