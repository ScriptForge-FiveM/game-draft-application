import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Trophy, Users, Zap, Target, Crown, Shield, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

interface TournamentFormatSelectorProps {
  eventId: string
  teamCount: number
  onFormatSelected: (bracket: { id: string, format: string, status: string, settings: any }) => void
}

export function TournamentFormatSelector({ eventId, teamCount, onFormatSelected }: TournamentFormatSelectorProps) {
  const [selectedFormat, setSelectedFormat] = useState<'elimination' | 'groups' | null>(null)
  const [groupsCount, setGroupsCount] = useState(Math.ceil(teamCount / 4))
  const [loading, setLoading] = useState(false)

  const handleFormatSelection = async (format: 'elimination' | 'groups') => {
    setLoading(true)
    try {
      // Create tournament bracket
      const settings = format === 'groups' ? { groupsCount } : {}
      
      const { data: bracketData, error: bracketError } = await supabase
        .from('tournament_brackets')
        .insert({
          event_id: eventId,
          format,
          settings,
          status: 'pending'
        })
        .select()
        .single()

      if (bracketError) throw bracketError

      // Update event with tournament format
      const { error: eventError } = await supabase
        .from('draft_events')
        .update({ tournament_format: format })
        .eq('id', eventId)

      if (eventError) throw eventError

      setSelectedFormat(format)
      onFormatSelected(bracketData)
      toast.success(`Formato torneo salvato: ${format === 'elimination' ? 'Eliminazione Diretta' : 'Gironi'}`)
    } catch (error) {
      console.error('Error setting tournament format:', error)
      toast.error('Errore nel salvataggio del formato torneo')
    } finally {
      setLoading(false)
    }
  }

  const getEliminationRounds = () => {
    if (teamCount <= 2) return 1
    if (teamCount <= 4) return 2
    if (teamCount <= 8) return 3
    return 4
  }

  const getMaxGroups = () => {
    return Math.floor(teamCount / 2) // Minimo 2 squadre per girone
  }

  const getTeamsPerGroup = () => {
    return Math.ceil(teamCount / groupsCount)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full mb-6">
          <Trophy className="h-10 w-10 text-white" />
        </div>
        <h3 className="text-3xl font-bold text-white mb-4">Scegli il Formato del Torneo</h3>
        <p className="text-white/70 text-lg">
          Seleziona come si svolgerà il torneo con <span className="text-orange-400 font-bold">{teamCount} squadre</span>
        </p>
      </div>

      {/* Format Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Eliminazione Diretta */}
        <div 
          className={`glass rounded-2xl p-8 cursor-pointer transition-all duration-300 border-2 hover:scale-105 ${
            selectedFormat === 'elimination' 
              ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20' 
              : 'border-white/20 hover:border-red-400/50'
          }`}
          onClick={() => !loading && handleFormatSelection('elimination')}
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full mb-6">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h4 className="text-2xl font-bold text-white mb-4">Eliminazione Diretta</h4>
            <p className="text-white/70 mb-6 text-lg">
              Torneo a eliminazione diretta. Chi perde è eliminato!
            </p>
            
            <div className="space-y-4">
              <div className="glass rounded-xl p-4 border border-red-400/30">
                <div className="flex items-center justify-center space-x-3 mb-2">
                  <Target className="h-5 w-5 text-red-400" />
                  <span className="font-bold text-white">Turni di Eliminazione</span>
                </div>
                <p className="text-3xl font-bold text-red-400">{getEliminationRounds()}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-lg p-3 border border-yellow-400/30">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <Crown className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-medium text-white">Vincitore</span>
                  </div>
                  <p className="text-xl font-bold text-yellow-400">1</p>
                </div>
                
                <div className="glass rounded-lg p-3 border border-orange-400/30">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <Zap className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-medium text-white">Velocità</span>
                  </div>
                  <p className="text-xl font-bold text-orange-400">Alta</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gironi */}
        <div 
          className={`glass rounded-2xl p-8 cursor-pointer transition-all duration-300 border-2 hover:scale-105 ${
            selectedFormat === 'groups' 
              ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
              : 'border-white/20 hover:border-blue-400/50'
          }`}
          onClick={() => !loading && handleFormatSelection('groups')}
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full mb-6">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h4 className="text-2xl font-bold text-white mb-4">Fase a Gironi</h4>
            <p className="text-white/70 mb-6 text-lg">
              Fase a gironi seguita da eliminazione diretta
            </p>
            
            <div className="space-y-4">
              {/* Groups Count Selector */}
              <div className="glass rounded-xl p-4 border border-blue-400/30">
                <div className="flex items-center justify-center space-x-3 mb-3">
                  <Settings className="h-5 w-5 text-blue-400" />
                  <span className="font-bold text-white">Numero Gironi</span>
                </div>
                <div className="flex items-center justify-center space-x-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (groupsCount > 2) {
                        setGroupsCount(groupsCount - 1)
                      }
                    }}
                    className="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={groupsCount <= 2}
                  >
                    -
                  </button>
                  <span className="text-3xl font-bold text-blue-400 w-12 text-center">{groupsCount}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (groupsCount < getMaxGroups()) {
                        setGroupsCount(groupsCount + 1)
                      }
                    }}
                    className="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={groupsCount >= getMaxGroups()}
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-white/60 mt-2">
                  {getTeamsPerGroup()} squadre per girone
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-lg p-3 border border-green-400/30">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <Trophy className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-white">Partite</span>
                  </div>
                  <p className="text-xl font-bold text-green-400">Più</p>
                </div>
                
                <div className="glass rounded-lg p-3 border border-purple-400/30">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <Shield className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-white">Equilibrio</span>
                  </div>
                  <p className="text-xl font-bold text-purple-400">Alto</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-white/70 text-lg">Impostazione formato torneo...</p>
        </div>
      )}

      {/* Format Comparison */}
      <div className="glass rounded-2xl p-8 border border-white/20">
        <h4 className="text-xl font-bold text-white mb-6 text-center">Confronto Formati</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h5 className="font-bold text-red-400 flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Eliminazione Diretta
            </h5>
            <ul className="space-y-2 text-white/70">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                Veloce e intenso
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                Meno partite totali
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                Una sconfitta = eliminazione
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                Meno opportunità di recupero
              </li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <h5 className="font-bold text-blue-400 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Fase a Gironi
            </h5>
            <ul className="space-y-2 text-white/70">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                Più partite per squadra
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                Più equilibrato
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                Possibilità di recupero
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-red-400 rounded-full mr-3"></span>
                Durata maggiore
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}