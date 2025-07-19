import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Gift, Settings, Save, Plus, Minus, Star, Target, DollarSign, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'

interface RewardSettings {
  id: string
  event_id: string
  enabled: boolean
  only_captains: boolean
  base_reward_amount: number
  reward_positions: number
  reduction_per_position: number
  reduction_type: 'percentage' | 'fixed'
  created_at: string
  updated_at: string
}

interface Team {
  id: string
  name: string
  color: string
  captain_id?: string
  members: Array<{
    user_id: string
    username: string
    position: string
  }>
}

interface RewardsManagerProps {
  eventId: string
  isCompleted?: boolean // Manteniamo questa prop per informazione, ma non per il pulsante
}

export function RewardsManager({ eventId, isCompleted = false }: RewardsManagerProps) {
  const { profile } = useAuth()
  const [rewardSettings, setRewardSettings] = useState<RewardSettings | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    enabled: true,
    only_captains: false,
    base_reward_amount: 100,
    reward_positions: 3,
    reduction_per_position: 25,
    reduction_type: 'percentage' as 'percentage' | 'fixed'
  })

  useEffect(() => {
    if (eventId && profile?.is_admin) {
      fetchRewardSettings()
      fetchTeams()
    }
  }, [eventId, profile])

  const fetchRewardSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('event_reward_settings')
        .select('*')
        .eq('event_id', eventId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setRewardSettings(data)
        setFormData({
          enabled: data.enabled,
          only_captains: data.only_captains,
          base_reward_amount: data.base_reward_amount,
          reward_positions: data.reward_positions,
          reduction_per_position: data.reduction_per_position,
          reduction_type: data.reduction_type
        })
      }
    } catch (error) {
      console.error('Error fetching reward settings:', error)
    }
  }

  const fetchTeams = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          *,
          team_members (
            user_id,
            username,
            position
          )
        `)
        .eq('event_id', eventId)
        .order('name')

      if (teamsError) throw teamsError

      const teamsWithMembers = (teamsData || []).map(team => ({
        ...team,
        members: team.team_members || []
      }))

      setTeams(teamsWithMembers)
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveRewardSettings = async () => {
    if (!profile?.is_admin) return

    setSaving(true)
    try {
      const settingsData = {
        event_id: eventId,
        enabled: formData.enabled,
        only_captains: formData.only_captains,
        base_reward_amount: formData.base_reward_amount,
        reward_positions: formData.reward_positions,
        reduction_per_position: formData.reduction_per_position,
        reduction_type: formData.reduction_type
      }

      if (rewardSettings) {
        const { error } = await supabase
          .from('event_reward_settings')
          .update(settingsData)
          .eq('id', rewardSettings.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('event_reward_settings')
          .insert(settingsData)
          .select()
          .single()

        if (error) throw error
        setRewardSettings(data)
      }

      toast.success('Impostazioni premi salvate!')
    } catch (error) {
      console.error('Error saving reward settings:', error)
      toast.error('Errore nel salvataggio delle impostazioni')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-8">
        <Gift className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400">Solo gli amministratori possono gestire i premi</p>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Gift className="h-6 w-6 text-purple-400" />
          <h3 className="text-xl font-bold text-white">Configurazione Sistema Premi</h3>
        </div>
        
        <div>
          <button
            onClick={saveRewardSettings}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salva Impostazioni
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="glass rounded-xl p-6 border border-white/20">
        <h4 className="text-lg font-semibold text-white mb-6 flex items-center">
          <Settings className="h-5 w-5 mr-2 text-blue-400" />
          Configurazione Premi
        </h4>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="enabled" className="text-white font-medium">
                Abilita sistema premi per questo evento
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="only_captains"
                checked={formData.only_captains}
                onChange={(e) => handleChange('only_captains', e.target.checked)}
                disabled={!formData.enabled}
                className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 disabled:opacity-50"
              />
              <label htmlFor="only_captains" className="text-white font-medium">
                Solo i capitani ricevono premi
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Crediti Base (1° posto)
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={formData.base_reward_amount}
                onChange={(e) => handleChange('base_reward_amount', parseInt(e.target.value) || 0)}
                disabled={!formData.enabled}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <Trophy className="h-4 w-4 inline mr-1" />
                Posizioni Premiate
              </label>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleChange('reward_positions', Math.max(1, formData.reward_positions - 1))}
                  disabled={!formData.enabled || formData.reward_positions <= 1}
                  className="w-8 h-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="h-4 w-4 mx-auto" />
                </button>
                <span className="text-2xl font-bold text-white w-12 text-center">{formData.reward_positions}</span>
                <button
                  onClick={() => handleChange('reward_positions', Math.min(teams.length, formData.reward_positions + 1))}
                  disabled={!formData.enabled || formData.reward_positions >= teams.length}
                  className="w-8 h-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4 mx-auto" />
                </button>
              </div>
            </div>
          </div>

          {/* Reduction Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Tipo di Riduzione
              </label>
              <select
                value={formData.reduction_type}
                onChange={(e) => handleChange('reduction_type', e.target.value)}
                disabled={!formData.enabled}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
              >
                <option value="percentage">Percentuale</option>
                <option value="fixed">Valore Fisso</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <Target className="h-4 w-4 inline mr-1" />
                Riduzione per Posizione
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="0"
                  max={formData.reduction_type === 'percentage' ? 100 : formData.base_reward_amount}
                  value={formData.reduction_per_position}
                  onChange={(e) => handleChange('reduction_per_position', parseInt(e.target.value) || 0)}
                  disabled={!formData.enabled}
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
                />
                <span className="text-white font-medium">
                  {formData.reduction_type === 'percentage' ? '%' : 'crediti'}
                </span>
              </div>
            </div>

            {/* Preview Calculation */}
            {formData.enabled && (
              <div className="bg-gray-700 rounded-lg p-4">
                <h5 className="font-medium text-white mb-3">Anteprima Calcolo</h5>
                <div className="space-y-2 text-sm">
                  {Array.from({ length: Math.min(3, formData.reward_positions) }, (_, i) => {
                    const position = i + 1
                    let amount = formData.base_reward_amount
                    if (position > 1) {
                      const reduction = formData.reduction_per_position * (position - 1)
                      if (formData.reduction_type === 'percentage') {
                        amount = Math.round(formData.base_reward_amount * (1 - reduction / 100))
                      } else {
                        amount = Math.max(0, formData.base_reward_amount - reduction)
                      }
                    }
                    
                    return (
                      <div key={position} className="flex items-center justify-between">
                        <span className="text-gray-300">{position}° posto:</span>
                        <span className="text-white font-bold">{amount} crediti</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-800/20 border border-blue-600 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-blue-300 mb-2">
          <Star className="h-5 w-5" />
          <p className="font-medium">Sistema di Finalizzazione Completo</p>
        </div>
        <div className="text-blue-300 text-sm space-y-1">
          <p>• <strong>Calcola statistiche</strong> da tutti i match result submissions approvati</p>
          <p>• <strong>Assegna awards automatici</strong>: MVP, Top Scorer, Top Assists, Best GK, Tournament Winner</p>
          <p>• <strong>Aggiorna user_rankings</strong> con tutte le colonne (drafts_won, captain_count, awards, etc.)</p>
          <p>• <strong>Distribuisce crediti</strong> secondo le impostazioni configurate</p>
          <p>• <strong>Calcola ranking points</strong> con formula completa che include tutto</p>
          <p>• <strong>Finalizzazione automatica</strong> quando tutti i match del torneo sono completati</p>
        </div>
      </div>

      {/* Disabled State */}
      {!formData.enabled && (
        <div className="text-center py-12">
          <Gift className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-300 mb-2">Sistema Premi Disabilitato</h4>
          <p className="text-gray-500">
            Abilita il sistema premi per configurare le ricompense per questo evento.
          </p>
        </div>
      )}
    </div>
  )
}