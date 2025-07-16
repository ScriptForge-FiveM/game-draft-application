import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DiscordAPI, DiscordGuild } from '../../lib/discord'
import { useAuth } from '../../contexts/AuthContext'
import { Shield, ExternalLink, CheckCircle, XCircle, Users, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ServerVerificationProps {
  onVerificationComplete: (isInServer: boolean) => void
}

export function ServerVerification({ onVerificationComplete }: ServerVerificationProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isInServer, setIsInServer] = useState(false)
  const [userGuilds, setUserGuilds] = useState<DiscordGuild[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      checkServerMembership()
    }
  }, [user])

  const checkServerMembership = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)
      console.log('🔍 Checking Discord server membership...')

      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.provider_token) {
        console.error('❌ No Discord token found')
        throw new Error('Token di accesso Discord non trovato')
      }

      console.log('🎮 Fetching Discord guilds...')
      const guilds = await DiscordAPI.getUserGuilds(session.provider_token)
      setUserGuilds(guilds)

      const inTargetServer = DiscordAPI.isUserInTargetServer(guilds)
      console.log('🏠 In target server:', inTargetServer)
      setIsInServer(inTargetServer)
      
      onVerificationComplete(inTargetServer)

      if (inTargetServer) {
        console.log('✅ Server verification successful')
        toast.success('Verifica server completata con successo!')
      } else {
        console.log('❌ User not in target server')
      }
    } catch (error) {
      console.error('Error checking server membership:', error)
      setError('Errore nella verifica dell\'appartenenza al server. Riprova.')
      toast.error('Verifica fallita')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinServer = () => {
    window.open(DiscordAPI.getInviteLink(), '_blank')
    setTimeout(() => {
      checkServerMembership()
    }, 3000)
  }

  if (loading) {
    return (
      <div className="card p-8">
        <div className="flex items-center justify-center space-x-4">
          <div className="loading"></div>
          <span className="text-gray-700 text-lg">Verifica appartenenza al server...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-8 border-red-200 bg-red-50">
        <div className="flex items-center space-x-4 mb-6">
          <XCircle className="h-8 w-8 text-red-500" />
          <h3 className="text-2xl font-bold text-red-800">Verifica Fallita</h3>
        </div>
        <p className="text-red-700 text-lg mb-6">{error}</p>
        <button
          onClick={checkServerMembership}
          className="btn-primary w-full flex items-center justify-center"
        >
          <AlertTriangle className="h-5 w-5 mr-2" />
          Riprova Verifica
        </button>
      </div>
    )
  }

  if (isInServer) {
    return (
      <div className="card p-8 border-green-200 bg-green-50">
        <div className="flex items-center space-x-4 mb-6">
          <CheckCircle className="h-8 w-8 text-green-500" />
          <h3 className="text-2xl font-bold text-green-800">Verifica Completata!</h3>
        </div>
        <p className="text-green-700 text-lg">
          Sei membro del server Discord richiesto. Ora puoi accedere agli eventi!
        </p>
      </div>
    )
  }

  return (
    <div className="card p-8 border-yellow-200 bg-yellow-50">
      <div className="flex items-center space-x-4 mb-6">
        <Shield className="h-8 w-8 text-yellow-600" />
        <h3 className="text-2xl font-bold text-yellow-800">Server Discord Richiesto</h3>
      </div>
      
      <p className="text-yellow-700 text-lg mb-8 leading-relaxed">
        Per accedere a questi tornei, devi essere membro del nostro server Discord. 
        Unisciti alla community per partecipare agli eventi!
      </p>

      <div className="space-y-4">
        <button
          onClick={handleJoinServer}
          className="flex items-center justify-center w-full btn-primary"
        >
          <Shield className="h-5 w-5 mr-2" />
          Unisciti al Server Discord
          <ExternalLink className="h-4 w-4 ml-2" />
        </button>

        <button
          onClick={checkServerMembership}
          className="w-full btn-secondary"
        >
          Mi sono unito - Verifica Ora
        </button>
      </div>

      {userGuilds.length > 0 && (
        <div className="mt-8 pt-6 border-t border-yellow-200">
          <p className="text-lg font-medium text-yellow-700 mb-4">
            I tuoi Server Discord ({userGuilds.length}):
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {userGuilds.slice(0, 10).map((guild) => (
              <div key={guild.id} className="text-sm text-yellow-600 truncate bg-yellow-100 px-3 py-2 rounded-lg">
                {guild.name}
              </div>
            ))}
            {userGuilds.length > 10 && (
              <div className="text-sm text-yellow-500 bg-yellow-100 px-3 py-2 rounded-lg">
              Lil Turbino Events
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}