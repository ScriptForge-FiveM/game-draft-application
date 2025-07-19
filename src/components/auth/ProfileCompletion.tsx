import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { User, Save, Gamepad2, CheckCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export function ProfileCompletion() {
  const { user, profile, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefreshCount, setAutoRefreshCount] = useState(0)
  const [formData, setFormData] = useState({
    username: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  })

  // Auto-refresh profile every 2 seconds for up to 10 attempts
  useEffect(() => {
    if (!profile && autoRefreshCount < 10) {
      const timer = setTimeout(() => {
        console.log(`🔄 Auto-refreshing profile attempt ${autoRefreshCount + 1}/10`)
        refreshProfile()
        setAutoRefreshCount(prev => prev + 1)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [profile, autoRefreshCount, refreshProfile])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshProfile()
      toast.success('Profilo aggiornato!')
    } catch (error) {
      console.error('Error refreshing profile:', error)
      toast.error('Errore nell\'aggiornamento del profilo')
    } finally {
      setRefreshing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.username.trim()) {
      toast.error('Il nome utente è obbligatorio')
      return
    }

    setLoading(true)
    try {
      // Try to update existing profile, or create if it doesn't exist
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user?.id)
        .single()
      
      let error
      
      if (existingProfile) {
        // Update existing profile
        const updateResult = await supabase
          .from('profiles')
          .update({
            username: formData.username.trim()
          })
          .eq('id', user?.id)
        error = updateResult.error
      } else {
        // Create new profile
        const insertResult = await supabase
          .from('profiles')
          .insert({
            id: user?.id,
            username: formData.username.trim(),
            discord_id: user?.user_metadata?.provider_id,
            avatar_url: user?.user_metadata?.avatar_url,
            is_admin: false
          })
        error = insertResult.error
      }

      if (error) throw error
      
      toast.success('Profilo aggiornato con successo!')
      await refreshProfile()
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Errore nell\'aggiornamento del profilo')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // If profile exists, redirect will happen automatically
  if (profile) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Profilo Completato!</h2>
          <p className="text-white/70">Reindirizzamento alla dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <img 
              src="/image.png" 
              alt="Lil Turbino Events Logo" 
              className="h-20 w-20 rounded-full border-4 border-white shadow-lg"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Completa il tuo Profilo
          </h1>
          <p className="text-xl text-white/80">Il tuo profilo è in fase di creazione...</p>
        </div>

        <div className="glass rounded-xl p-8 border border-white/20">
          {user?.user_metadata && (
            <div className="mb-6 p-4 bg-blue-600/20 border border-blue-400/30 rounded-lg">
              <div className="flex items-center space-x-3 mb-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-white font-medium">Connesso a Discord</span>
              </div>
              <div className="flex items-center space-x-3">
                {user.user_metadata.avatar_url && (
                  <img 
                    src={user.user_metadata.avatar_url}
                    alt="Discord Avatar"
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="text-white font-medium">{user.user_metadata.full_name || user.email}</p>
                  <p className="text-blue-300 text-sm">Account Discord</p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 p-4 bg-yellow-600/20 border border-yellow-400/30 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
              <p className="text-yellow-200 text-sm font-medium">
                Creazione profilo in corso... ({autoRefreshCount}/10)
              </p>
            </div>
            <p className="text-yellow-100 text-xs">
              Il tuo profilo viene creato automaticamente. Questo processo richiede alcuni secondi.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-4 mb-6">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {refreshing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Aggiornando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Ricarica Profilo
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-bold text-white mb-3">
                Nome Utente (Opzionale)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Il tuo nome utente"
                  maxLength={50}
                />
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Puoi aggiornare il nome utente se necessario
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !formData.username.trim()}
              className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Aggiornando...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Aggiorna Profilo
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <p className="text-white/60 text-sm">
            Il profilo viene creato automaticamente al primo accesso Discord
          </p>
        </div>
      </div>
    </div>
  )
}