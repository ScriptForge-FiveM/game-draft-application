import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Check, X, Filter, UserX } from 'lucide-react'
import { DummyPlayersGenerator } from './DummyPlayersGenerator'
import toast from 'react-hot-toast'

interface Registration {
  id: string
  user_id: string
  username: string
  preferred_position: string
  platform: string
  notes?: string
  status: 'pending' | 'approved' | 'drafted'
  created_at: string
}

interface RegistrationListProps {
  eventId: string
  showDummyGenerator?: boolean
}

export function RegistrationList({ eventId, showDummyGenerator = false }: RegistrationListProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')

  useEffect(() => {
    fetchRegistrations()

    // Set up real-time subscription
    const subscription = supabase
      .channel(`registrations-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventId}` },
        () => fetchRegistrations()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [eventId])

  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRegistrations(data || [])
    } catch (error) {
      console.error('Error fetching registrations:', error)
      toast.error('Failed to load registrations')
    } finally {
      setLoading(false)
    }
  }

  const updateRegistrationStatus = async (registrationId: string, status: 'approved' | 'pending') => {
    try {
      const { error } = await supabase
        .from('registrations')
        .update({ status })
        .eq('id', registrationId)

      if (error) throw error
      
      setRegistrations(prev =>
        prev.map(reg => reg.id === registrationId ? { ...reg, status } : reg)
      )
      
      toast.success(`Registration ${status}`)
    } catch (error) {
      console.error('Error updating registration:', error)
      toast.error('Failed to update registration')
    }
  }

  const deleteRegistration = async (registrationId: string) => {
    try {
      const { error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', registrationId)

      if (error) throw error
      
      setRegistrations(prev => prev.filter(reg => reg.id !== registrationId))
      toast.success('Registrazione eliminata')
    } catch (error) {
      console.error('Error deleting registration:', error)
      toast.error('Errore nell\'eliminazione della registrazione')
    }
  }

  const filteredRegistrations = registrations.filter(reg => {
    if (filter === 'all') return true
    return reg.status === filter
  })

  const counts = {
    total: registrations.length,
    pending: registrations.filter(r => r.status === 'pending').length,
    approved: registrations.filter(r => r.status === 'approved').length
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
          <Users className="h-6 w-6 text-orange-400" />
          <h3 className="text-xl font-bold text-white">Registrazioni Giocatori</h3>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-white/70 font-medium">Totale: {counts.total}</span>
            <span className="text-yellow-400 font-medium">In Attesa: {counts.pending}</span>
            <span className="text-green-400 font-medium">Approvati: {counts.approved}</span>
          </div>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 glass border border-white/20 rounded-lg text-white text-sm font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-all"
          >
            <option value="all">Tutti</option>
            <option value="pending">In Attesa</option>
            <option value="approved">Approvati</option>
          </select>
        </div>
      </div>

      {filteredRegistrations.length === 0 ? (
        <div className="text-center py-8">
          <div className="glass rounded-xl p-12 border border-white/20">
            <Users className="h-16 w-16 text-orange-400 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-white mb-2">
              {filter === 'all' ? 'Nessuna Registrazione' : `Nessuna registrazione ${filter === 'pending' ? 'in attesa' : 'approvata'}`}
            </h3>
            <p className="text-white/70">
              {filter === 'all' 
                ? 'Condividi il link dell\'evento per iniziare a ricevere registrazioni'
                : `Nessun giocatore con stato ${filter === 'pending' ? 'in attesa' : 'approvato'} trovato`
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRegistrations.map((registration) => (
            <div key={registration.id} className="glass rounded-xl p-6 border border-white/20 hover:border-white/30 transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-bold text-white">{registration.username}</h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  registration.status === 'approved' 
                    ? 'bg-green-600 text-white' 
                    : registration.status === 'pending'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-600 text-white'
                }`}>
                  {registration.status === 'approved' ? 'APPROVATO' : registration.status === 'pending' ? 'IN ATTESA' : 'DRAFTATO'}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-white/80 mb-4">
                <p><span className="text-white/60 font-medium">Posizione:</span> {registration.preferred_position}</p>
                <p><span className="text-white/60 font-medium">Piattaforma:</span> {registration.platform}</p>
                {registration.notes && (
                  <p><span className="text-white/60 font-medium">Note:</span> {registration.notes}</p>
                )}
                <p className="text-xs text-white/50">
                  Registrato il {new Date(registration.created_at).toLocaleDateString('it-IT')}
                </p>
              </div>
              
              {registration.status === 'pending' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateRegistrationStatus(registration.id, 'approved')}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-bold rounded-lg transition-all duration-200 hover:scale-105"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approva
                  </button>
                </div>
              )}
              
              {registration.status === 'approved' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateRegistrationStatus(registration.id, 'pending')}
                    className="flex-1 flex items-center justify-center px-3 py-2 glass border border-white/20 hover:border-white/30 text-white text-sm font-bold rounded-lg transition-all duration-200"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Disapprova
                  </button>
                  <button
                    onClick={() => deleteRegistration(registration.id)}
                    className="flex items-center justify-center px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-bold rounded-lg transition-all duration-200 hover:scale-105"
                    title="Elimina registrazione"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}