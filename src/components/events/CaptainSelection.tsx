import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Crown, Users, Star } from 'lucide-react'
import toast from 'react-hot-toast'

interface Registration {
  id: string
  user_id: string
  username: string
  preferred_position: string
  platform: string
}

interface Team {
  id: string
  name: string
  captain_id?: string
  color: string
}

interface CaptainSelectionProps {
  eventId: string
  teamCount: number
  onCaptainsChange?: (count: number) => void
}



const TEAM_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
]

export function CaptainSelection({ eventId, teamCount, onCaptainsChange }: CaptainSelectionProps) {

  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCaptains, setSelectedCaptains] = useState<Set<string>>(new Set())
const [canStartDraft, setCanStartDraft] = useState(false)

  useEffect(() => {
    fetchData()
  }, [eventId])

  useEffect(() => {
  setCanStartDraft(selectedCaptains.size === teamCount)
}, [selectedCaptains, teamCount])

useEffect(() => {
  onCaptainsChange?.(selectedCaptains.size)
}, [selectedCaptains, onCaptainsChange])


  const fetchData = async () => {
    try {
      // Fetch approved registrations
// Fetch approved registrations that want to be captain
const { data: regsData, error: regsError } = await supabase
  .from('registrations')
  .select('*')
  .eq('event_id', eventId)
  .eq('status', 'approved')
  .eq('wants_captain', true) // ✅ filtro aggiunto


      if (regsError) throw regsError

      // Fetch existing teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('event_id', eventId)
        .order('name')

      if (teamsError) throw teamsError

      setRegistrations(regsData || [])
      
      if (teamsData && teamsData.length > 0) {
        setTeams(teamsData)
        setSelectedCaptains(new Set(teamsData.filter(t => t.captain_id).map(t => t.captain_id!)))
      } else {
        // Create initial teams if they don't exist
        await createInitialTeams()
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

const confirmCaptains = async () => {
  try {
    const captainData = teams
      .filter(t => t.captain_id)
      .map(team => {
        const reg = registrations.find(r => r.user_id === team.captain_id)
        if (!reg) return null

        return {
          team_id: team.id,
          user_id: reg.user_id,
          username: reg.username,
          position: reg.preferred_position,
          pick_order: 0,
        }
      })
      .filter(Boolean)

    if (captainData.length !== teamCount) {
      toast.error('Manca almeno un capitano')
      return
    }

    const { error } = await supabase
      .from('team_members')
      .insert(captainData)

    if (error) throw error

    toast.success('Capitani aggiunti ai team!')
  } catch (err) {
    console.error('Errore inserimento capitani:', err)
    toast.error('Errore durante la conferma')
  }
}

  
  const createInitialTeams = async () => {
    try {
      const teamsToCreate = Array.from({ length: teamCount }, (_, i) => ({
        event_id: eventId,
        name: `Team ${String.fromCharCode(65 + i)}`,
        color: TEAM_COLORS[i % TEAM_COLORS.length]
      }))

      const { data, error } = await supabase
        .from('teams')
        .insert(teamsToCreate)
        .select()

      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error('Error creating teams:', error)
      toast.error('Failed to create teams')
    }
  }

  const assignCaptain = async (teamId: string, captainId: string) => {
    try {
      const { error } = await supabase
        .from('teams')
        .update({ captain_id: captainId })
        .eq('id', teamId)

      if (error) throw error

      setTeams(prev => prev.map(team => 
        team.id === teamId ? { ...team, captain_id: captainId } : team
      ))
      
      setSelectedCaptains(prev => new Set([...prev, captainId]))
      toast.success('Captain assigned!')
    } catch (error) {
      console.error('Error assigning captain:', error)
      toast.error('Failed to assign captain')
    }
  }

  const removeCaptain = async (teamId: string) => {
    try {
      const team = teams.find(t => t.id === teamId)
      if (!team?.captain_id) return

      const { error } = await supabase
        .from('teams')
        .update({ captain_id: null })
        .eq('id', teamId)

      if (error) throw error

      setSelectedCaptains(prev => {
        const newSet = new Set(prev)
        newSet.delete(team.captain_id!)
        return newSet
      })

      setTeams(prev => prev.map(t => 
        t.id === teamId ? { ...t, captain_id: undefined } : t
      ))
      
      toast.success('Captain removed!')
    } catch (error) {
      console.error('Error removing captain:', error)
      toast.error('Failed to remove captain')
    }
  }

  const availablePlayers = registrations.filter(reg => !selectedCaptains.has(reg.user_id))

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
        <div className="text-sm text-gray-400">
          {selectedCaptains.size} / {teamCount} capitani selezionati
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Teams */}
        <div className="space-y-4">
          <h4 className="font-semibold text-white flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Teams
          </h4>
          
          <div className="space-y-3">
            {teams.map((team) => {
              const captain = team.captain_id 
                ? registrations.find(r => r.user_id === team.captain_id)
                : null

              return (
                <div key={team.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <h5 className="font-semibold text-white">{team.name}</h5>
                    </div>
                    {captain && (
                      <button
                        onClick={() => removeCaptain(team.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  {captain ? (
                    <div className="flex items-center space-x-2 p-3 bg-gray-600 rounded">
                      <Crown className="h-4 w-4 text-yellow-400" />
                      <div>
                        <p className="font-medium text-white">{captain.username}</p>
                        <p className="text-sm text-gray-400">{captain.preferred_position}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border-2 border-dashed border-gray-600 rounded text-center">
                      <p className="text-gray-400 text-sm">No captain assigned</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Available Players */}
        <div className="space-y-4">
          <h4 className="font-semibold text-white flex items-center">
            <Star className="h-5 w-5 mr-2" />
            Giocatori Disponibili
          </h4>
          
          {availablePlayers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Nessun capitano disponibile</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availablePlayers.map((player) => (
                <div key={player.id} className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{player.username}</p>
                      <p className="text-sm text-gray-400">{player.preferred_position} • {player.platform}</p>
                    </div>
                    
                    <div className="flex space-x-1">
                      {teams.filter(t => !t.captain_id).map((team) => (
                        <button
                          key={team.id}
                          onClick={() => assignCaptain(team.id, player.user_id)}
                          className="px-2 py-1 text-xs font-medium rounded text-white hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: team.color }}
                          title={`Assign to ${team.name}`}
                        >
                          {team.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedCaptains.size === teamCount && (
        <div className="bg-green-800/20 border border-green-600 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-green-400">
            <Crown className="h-5 w-5" />
            <p className="font-medium">All captains selected!</p>
          </div>
          <p className="text-green-300 text-sm mt-1">
            You can now proceed to the live draft phase.
          </p>
        </div>
      )}
    </div>
  )
}