import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { HelpCircle, Send, Shield, Crown, Clock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface SupportMessage {
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
}

interface SupportChatProps {
  eventId: string
  isAdmin?: boolean
}

export function SupportChat({ eventId, isAdmin = false }: SupportChatProps) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isUserCaptain, setIsUserCaptain] = useState(false)
  const [eventAdmin, setEventAdmin] = useState<{ id: string, username: string } | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  useEffect(() => {
    if (eventId && user) {
      fetchEventAdmin()
      checkIfUserIsCaptain()
      fetchMessages()
    }
  }, [eventId, user])

  useEffect(() => {
    if (eventAdmin && user) {
      const cleanup = subscribeToMessages()
      return cleanup
    }
  }, [eventAdmin, user])

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

  const fetchEventAdmin = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('draft_events')
        .select('admin_id')
        .eq('id', eventId)
        .single()

      if (error) throw error

      // Fetch admin info separately
      const { data: adminData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.admin_id)
        .single()

      setEventAdmin({
        id: data.admin_id,
        username: adminData?.username || 'Admin'
      })
    } catch (error) {
      console.error('Error fetching event admin:', error)
      toast.error('Errore nel caricamento dell\'admin dell\'evento')
    } finally {
      setLoading(false)
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

  const fetchMessages = async () => {
    if (!eventAdmin) return

    try {
      // For captains: messages between them and the admin
      // For admins: all support messages for this event
      let query = supabase
        .from('private_chats')
        .select(`
          id,
          sender_id,
          recipient_id,
          message_text,
          created_at
        `)
        .eq('event_id', eventId)

      if (isAdmin && profile?.is_admin) {
        // Admin sees all support messages (where one participant is the event admin)
        query = query.or(`sender_id.eq.${eventAdmin.id},recipient_id.eq.${eventAdmin.id}`)
      } else {
        // Captain sees only their conversation with the admin
        query = query.or(`and(sender_id.eq.${user?.id},recipient_id.eq.${eventAdmin.id}),and(sender_id.eq.${eventAdmin.id},recipient_id.eq.${user?.id})`)
      }

      const { data, error } = await query
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
            sender: senderData
          }
        })
      )

      setMessages(messagesWithSender)
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast.error('Errore nel caricamento dei messaggi di supporto')
    }
  }

  const subscribeToMessages = () => {
    if (!eventAdmin) return

    console.log('🔔 Setting up support chat subscription for event:', eventId)
    
    const subscription = supabase
      .channel(`support-chat-${eventId}-${user?.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_chats',
          filter: `event_id=eq.${eventId}`
        },
        async (payload) => {
          console.log('📨 New support message received:', payload.new)
          
          // Check if this message is relevant to the current user
          const isRelevant = isAdmin && profile?.is_admin
            ? (payload.new.sender_id === eventAdmin.id || payload.new.recipient_id === eventAdmin.id)
            : (
                (payload.new.sender_id === user?.id && payload.new.recipient_id === eventAdmin.id) ||
                (payload.new.sender_id === eventAdmin.id && payload.new.recipient_id === user?.id)
              )

          if (isRelevant) {
            // Fetch sender info for new message
            const { data: senderData } = await supabase
              .from('profiles')
              .select('username, avatar_url, is_admin')
              .eq('id', payload.new.sender_id)
              .single()

            const newMessage = {
              ...payload.new,
              sender: senderData
            } as SupportMessage

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
          console.log('🗑️ Support message deleted:', payload.old.id)
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      console.log('🔕 Cleaning up support chat subscription')
      subscription.unsubscribe()
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || !eventAdmin || sending) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('private_chats')
        .insert({
          event_id: eventId,
          sender_id: user.id,
          recipient_id: eventAdmin.id,
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
    if (messagesEndRef.current && autoScroll) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const canUseSupportChat = isUserCaptain || (profile?.is_admin && isAdmin)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!canUseSupportChat) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
        <HelpCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-gray-300 mb-2">Chat Supporto</h4>
        <p className="text-gray-500">Solo i capitani possono contattare il supporto</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col h-115 md:h-115">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <HelpCircle className="h-5 w-5 text-orange-400" />
          <h4 className="font-semibold text-white">Chat Supporto</h4>
          {eventAdmin && (
            <span className="text-sm text-gray-400">
              {isAdmin ? 'Messaggi di supporto' : `con ${eventAdmin.username}`}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Shield className="h-4 w-4" />
          <span>Admin</span>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <HelpCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">Nessun messaggio di supporto</p>
            <p className="text-gray-500 text-sm">
              {isAdmin ? 'I capitani possono contattarti qui' : 'Contatta l\'admin per supporto'}
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender_id === user?.id
            const isFromAdmin = message.sender?.is_admin
            
            return (
              <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs md:max-w-sm lg:max-w-md px-3 md:px-4 py-2 rounded-lg ${
                  isOwnMessage 
                    ? 'bg-orange-600 text-white' 
                    : isFromAdmin
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-xs">
                      {isOwnMessage ? 'Tu' : message.sender?.username}
                    </span>
                    {message.sender?.is_admin && (
                      <Shield className="h-3 w-3 text-white" />
                    )}
                    {!message.sender?.is_admin && !isOwnMessage && (
                      <Crown className="h-3 w-3 text-yellow-400" />
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
        <div ref={messagesEndRef} />
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
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-full p-2 shadow-lg transition-colors"
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
            placeholder={
              isAdmin 
                ? "Rispondi al supporto..." 
                : `Messaggio di supporto a ${eventAdmin?.username}...`
            }
            className="flex-1 px-3 py-2 md:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm md:text-base"
            maxLength={500}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-3 md:px-4 py-2 md:py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>

      {/* Info Banner */}
      <div className="p-3 bg-orange-800/20 border-t border-orange-600/30">
        <div className="flex items-center space-x-2 text-orange-300">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-xs md:text-sm">
            {isAdmin 
              ? 'Puoi rispondere a tutti i messaggi di supporto dei capitani'
              : 'Usa questa chat per contattare l\'organizzatore dell\'evento'
            }
          </p>
        </div>
      </div>
    </div>
  )
}