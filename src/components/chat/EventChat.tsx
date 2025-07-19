import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { MessageCircle, Send, Trash2, Shield, Users, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface ChatMessage {
  id: string
  sender_id: string
  message: string
  created_at: string
  sender?: {
    username: string
    avatar_url?: string
    is_admin: boolean
  }
}

interface EventChatProps {
  eventId: string
  isAdmin?: boolean
}

export function EventChat({ eventId, isAdmin = false }: EventChatProps) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isUserRegistered, setIsUserRegistered] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  useEffect(() => {
    if (eventId && user) {
      checkUserRegistration()
      fetchMessages()
    }
  }, [eventId, user])

  useEffect(() => {
    if (eventId && user && isUserRegistered) {
      const cleanup = subscribeToMessages()
      return cleanup
    }
  }, [eventId, user, isUserRegistered])

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

  const checkUserRegistration = async () => {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user?.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setIsUserRegistered(!!data)
      
      // Also check if user is admin for this event
      if (!data && profile?.is_admin) {
        const { data: eventData } = await supabase
          .from('draft_events')
          .select('admin_id')
          .eq('id', eventId)
          .single()
        
        if (eventData?.admin_id === user?.id) {
          setIsUserRegistered(true)
        }
      }
    } catch (error) {
      console.error('Error checking registration:', error)
    }
  }

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('event_chats')
        .select(`
          id,
          sender_id,
          sender_username,
          message,
          created_at
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error

      // Fetch sender info separately
      const messagesWithSender = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: senderData } = await supabase
            .from('profiles')
            .select('username, avatar_url, is_admin')
            .eq('id', msg.sender_id)
            .single()
          
          return {
            ...msg,
            message_text: msg.message, // Map to expected field name
            sender: senderData
          }
        })
      )

      setMessages(messagesWithSender)
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast.error('Errore nel caricamento dei messaggi')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToMessages = () => {
    console.log('🔔 Setting up event chat subscription for event:', eventId)
    
    const subscription = supabase
      .channel(`event-chat-${eventId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_chats',
          filter: `event_id=eq.${eventId}`
        },
        async (payload) => {
          console.log('📨 New event message received:', payload.new)
          
          // Fetch sender info for new message
          const { data: senderData } = await supabase
            .from('profiles')
            .select('username, avatar_url, is_admin')
            .eq('id', payload.new.sender_id)
            .single()

          const newMessage = {
            ...payload.new,
            sender: senderData
          } as ChatMessage

          setMessages(prev => [...prev, newMessage])
        }
      )
      .on('postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'event_chats',
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          console.log('🗑️ Message deleted:', payload.old.id)
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      console.log('🔕 Cleaning up event chat subscription')
      subscription.unsubscribe()
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('event_chats')
        .insert({
          event_id: eventId,
          sender_id: user.id,
          sender_username: profile?.username || user.email?.split('@')[0] || 'Utente',
          message: newMessage.trim()
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

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('event_chats')
        .delete()
        .eq('id', messageId)

      if (error) throw error
      toast.success('Messaggio eliminato')
    } catch (error) {
      console.error('Error deleting message:', error)
      toast.error('Errore nell\'eliminazione del messaggio')
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

  const canSendMessages = isUserRegistered || (profile?.is_admin && isAdmin)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col h-115 md:h-115 relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <MessageCircle className="h-5 w-5 text-blue-400" />
          <h4 className="font-semibold text-white">Chat Evento</h4>
          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
            {messages.length}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Users className="h-4 w-4" />
          <span>Tutti i partecipanti</span>
        </div>
      </div>

      {/* Messages */}
    {/* Messages */}
<div
  ref={messagesContainerRef}
  onScroll={handleScroll}
  className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3"
>
  {messages.length === 0 ? (
    <div className="text-center py-8">
      <MessageCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
      <p className="text-gray-400">Nessun messaggio ancora</p>
      <p className="text-gray-500 text-sm">Inizia la conversazione!</p>
    </div>
  ) : (
    messages.map((message) => (
      <div key={message.id} className="group">
        <div className="flex items-start space-x-3">
          {message.sender?.avatar_url ? (
            <img
              src={message.sender.avatar_url}
              alt={message.sender.username}
              className="w-6 h-6 md:w-8 md:h-8 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="h-3 w-3 md:h-4 md:w-4 text-gray-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className={`font-medium text-sm ${
                message.sender?.is_admin ? 'text-red-400' : 'text-white'
              }`}>
                {message.sender?.username || 'Utente Sconosciuto'}
              </span>
              {message.sender?.is_admin && (
                <Shield className="h-3 w-3 text-red-400" />
              )}
              <span className="text-xs text-gray-500 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {formatTime(message.created_at)}
              </span>
              {isAdmin && (
                <button
                  onClick={() => deleteMessage(message.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                  title="Elimina messaggio"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="text-gray-300 text-sm break-words">
              {message.message}
            </p>
          </div>
        </div>
      </div>
    ))
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
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      )}

      {/* Message Input */}
      {canSendMessages ? (
        <form onSubmit={sendMessage} className="p-4 border-t border-gray-700">
          <div className="flex space-x-2 items-end">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Scrivi un messaggio..."
              className="flex-1 px-3 py-2 md:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm md:text-base"
              maxLength={500}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-3 md:px-4 py-2 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t border-gray-700 bg-gray-700/50">
          <p className="text-gray-400 text-xs md:text-sm text-center">
            Devi essere registrato all'evento per partecipare alla chat
          </p>
        </div>
      )}
    </div>
  )
}