import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { MessageSquare, Send, Crown, Shield, Clock, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface ChatMessage {
  id: string
  sender_id: string
  recipient_id: string
  message_text: string
  created_at: string
  sender?: {
    username: string
    avatar_url?: string
    is_admin: boolean
  }
  recipient?: {
    username: string
    avatar_url?: string
    is_admin: boolean
  }
}

interface Captain {
  id: string
  username: string
  avatar_url?: string
  team_name: string
  team_color: string
}

interface PrivateChatProps {
  eventId: string
  isAdmin?: boolean
}

export function PrivateChat({ eventId, isAdmin = false }: PrivateChatProps) {
  const { user, profile } = useAuth()
  const [captains, setCaptains] = useState<Captain[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isUserCaptain, setIsUserCaptain] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  useEffect(() => {
    if (eventId && user) {
      fetchCaptains()
      checkIfUserIsCaptain()
    }
  }, [eventId, user])

  useEffect(() => {
    if (selectedRecipient) {
      fetchMessages()
      const cleanup = subscribeToMessages()
      return cleanup
    }
  }, [selectedRecipient])

  useEffect(() => {
    if (autoScroll && isAtBottom) {
      scrollToBottom()
    }
  }, [messages, autoScroll, isAtBottom])

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50
      setIsAtBottom(isNearBottom)
      setAutoScroll(isNearBottom)
    }
  }

  const checkIfUserIsCaptain = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id')
        .eq('event_id', eventId)
        .eq('captain_id', user?.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setIsUserCaptain(!!data)
    } catch (error) {
      console.error('Error checking captain status:', error)
    }
  }

  const fetchCaptains = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, color, captain_id')
        .eq('event_id', eventId)
        .not('captain_id', 'is', null)

      if (error) throw error

      // Fetch captain info separately
      const captainsList = await Promise.all(
        (data || [])
          .filter(team => team.captain_id && team.captain_id !== user?.id)
          .map(async (team) => {
            const { data: captainData } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', team.captain_id)
              .single()
            
            return {
              id: team.captain_id!,
              username: captainData?.username || 'Unknown',
              avatar_url: captainData?.avatar_url,
              team_name: team.name,
              team_color: team.color
            }
          })
      )

      setCaptains(captainsList)
    } catch (error) {
      console.error('Error fetching captains:', error)
      toast.error('Errore nel caricamento dei capitani')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    if (!selectedRecipient) return

    try {
      const { data, error } = await supabase
        .from('private_chats')
        .select(`
          id,
          sender_id,
          recipient_id,
          message_text,
          created_at
        `)
        .eq('event_id', eventId)
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${selectedRecipient}),and(sender_id.eq.${selectedRecipient},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error

      // Fetch sender and recipient info separately
      const messagesWithSender = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: senderData } = await supabase
            .from('profiles')
            .select('username, avatar_url, is_admin')
            .eq('id', msg.sender_id)
            .single()
          
          const { data: recipientData } = await supabase
            .from('profiles')
            .select('username, avatar_url, is_admin')
            .eq('id', msg.recipient_id)
            .single()
          
          return {
            ...msg,
            sender: senderData,
            recipient: recipientData
          }
        })
      )

      setMessages(messagesWithSender)
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast.error('Errore nel caricamento dei messaggi')
    }
  }

  const subscribeToMessages = () => {
    if (!selectedRecipient) return

    console.log('🔔 Setting up private chat subscription for:', selectedRecipient)
    
    const subscription = supabase
      .channel(`private-chat-${eventId}-${user?.id}-${selectedRecipient}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_chats',
          filter: `event_id=eq.${eventId}`
        },
        async (payload) => {
          console.log('📨 New private message received:', payload.new)
          
          // Only add message if it's part of this conversation
          if (
            (payload.new.sender_id === user?.id && payload.new.recipient_id === selectedRecipient) ||
            (payload.new.sender_id === selectedRecipient && payload.new.recipient_id === user?.id)
          ) {
            // Fetch sender info for new message
            const { data: senderData } = await supabase
              .from('profiles')
              .select('username, avatar_url, is_admin')
              .eq('id', payload.new.sender_id)
              .single()

            const { data: recipientData } = await supabase
              .from('profiles')
              .select('username, avatar_url, is_admin')
              .eq('id', payload.new.recipient_id)
              .single()

            const newMessage = {
              ...payload.new,
              sender: senderData,
              recipient: recipientData
            } as ChatMessage

            setMessages(prev => [...prev, newMessage])
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'private_chats',
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          console.log('🗑️ Private message deleted:', payload.old.id)
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      console.log('🔕 Cleaning up private chat subscription')
      subscription.unsubscribe()
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || !selectedRecipient || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('private_chats')
        .insert({
          event_id: eventId,
          sender_id: user.id,
          recipient_id: selectedRecipient,
          message_text: newMessage.trim()
        })

      if (error) throw error

      setNewMessage('')
      setAutoScroll(true)
      setIsAtBottom(true)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Errore nell\'invio del messaggio')
    } finally {
      setSending(false)
    }
  }

const scrollToBottom = () => {
  if (messagesContainerRef.current && autoScroll) {
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }
}

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const selectedCaptain = captains.find(c => c.id === selectedRecipient)
  const canUsePrivateChat = isUserCaptain || (profile?.is_admin && isAdmin)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!canUsePrivateChat) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
        <Crown className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-gray-300 mb-2">Chat Privata Capitani</h4>
        <p className="text-gray-500">Solo i capitani possono accedere alla chat privata</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col h-115 md:h-115 relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <MessageSquare className="h-5 w-5 text-purple-400" />
          <h4 className="font-semibold text-white">Chat Privata Capitani</h4>
          {selectedCaptain && (
            <span className="text-sm text-gray-400 hidden md:inline">
              con {selectedCaptain.username}
            </span>
          )}
        </div>
        {selectedRecipient && (
          <button
            onClick={() => {
              setSelectedRecipient(null)
              setMessages([])
            }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!selectedRecipient ? (
        /* Captain Selection */
        <div className="flex-1 p-4">
          <h5 className="font-medium text-white mb-4">Seleziona un capitano:</h5>
          {captains.length === 0 ? (
            <div className="text-center py-8">
              <Crown className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Nessun altro capitano disponibile</p>
            </div>
          ) : (
            <div className="space-y-2">
              {captains.map((captain) => (
                <button
                  key={captain.id}
                  onClick={() => setSelectedRecipient(captain.id)}
                  className="w-full flex items-center space-x-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {captain.avatar_url ? (
                    <img
                      src={captain.avatar_url}
                      alt={captain.username}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <Crown className="h-4 w-4 text-yellow-400" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="font-medium text-white">{captain.username}</p>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: captain.team_color }}
                      />
                      <span className="text-sm text-gray-400">{captain.team_name}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Chat Interface */
        <>
  {/* Messages */}
<div
  ref={messagesContainerRef}
  onScroll={handleScroll}
  className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3"
>
  {messages.length === 0 ? (
    <div className="text-center py-8">
      <MessageSquare className="h-12 w-12 text-gray-500 mx-auto mb-4" />
      <p className="text-gray-400">Nessun messaggio ancora</p>
      <p className="text-gray-500 text-sm">Inizia una conversazione privata!</p>
    </div>
  ) : (
    messages.map((message) => {
      const isOwnMessage = message.sender_id === user?.id

      return (
        <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-xs md:max-w-sm lg:max-w-md px-3 md:px-4 py-2 rounded-lg ${
            isOwnMessage
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-100'
          }`}>
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-xs">
                {isOwnMessage ? 'Tu' : message.sender?.username}
              </span>
              {message.sender?.is_admin && (
                <Shield className="h-3 w-3 text-red-400" />
              )}
              <span className="text-xs opacity-70 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {formatTime(message.created_at)}
              </span>
            </div>
            <p className="text-sm break-words">{message.message_text}</p>
          </div>
        </div>
      )
    })
  )}
</div>


          {/* Scroll to bottom button */}
          {!isAtBottom && (
            <div className="absolute bottom-20 right-4 z-10">
              <button
                onClick={() => {
                  setAutoScroll(true)
                  setIsAtBottom(true)
                  scrollToBottom()
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-2 shadow-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            </div>
          )}

          {/* Message Input */}
          <form onSubmit={sendMessage} className="p-4 border-t border-gray-700">
            <div className="flex space-x-2 items-end">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Messaggio privato a ${selectedCaptain?.username}...`}
                className="flex-1 px-3 py-2 md:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm md:text-base"
                maxLength={500}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-3 md:px-4 py-2 md:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}