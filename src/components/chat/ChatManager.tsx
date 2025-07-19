import React, { useState } from 'react'
import { MessageCircle, MessageSquare, HelpCircle, Users, Crown, Shield } from 'lucide-react'
import { EventChat } from './EventChat'
import { PrivateChat } from './PrivateChat'
import { SupportChat } from './SupportChat'
import { MatchChat } from './MatchChat'

interface ChatManagerProps {
  eventId: string
  isAdmin?: boolean
  defaultTab?: 'event' | 'private' | 'support'
  matchId?: string
  tournamentMatchId?: string
}

export function ChatManager({ eventId, isAdmin = false, defaultTab = 'event', matchId, tournamentMatchId }: ChatManagerProps) {
  const [activeTab, setActiveTab] = useState<'event' | 'private' | 'support' | 'match'>(defaultTab)

  const tabs = [
    {
      id: 'event',
      label: 'Chat Evento',
      icon: MessageCircle,
      color: 'text-blue-400',
      description: 'Chat pubblica'
    },
    {
      id: 'private',
      label: 'Chat Capitani',
      icon: MessageSquare,
      color: 'text-purple-400',
      description: 'Solo capitani'
    },
    {
      id: 'support',
      label: 'Supporto',
      icon: HelpCircle,
      color: 'text-orange-400',
      description: 'Contatta admin'
    }
  ]

  // Add match chat tab if match IDs are provided
  if (matchId || tournamentMatchId) {
    tabs.push({
      id: 'match',
      label: 'Match',
      icon: MessageCircle,
      color: 'text-yellow-400',
      description: 'Discussione match'
    })
  }
  
  return (
    <div className="space-y-6">

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex flex-col items-center space-y-1 px-2 md:px-4 py-3 rounded-md font-medium transition-colors whitespace-nowrap min-w-0 ${
                activeTab === tab.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className={`h-5 w-5 ${activeTab === tab.id ? tab.color : ''}`} />
              <span className="text-xs md:text-sm truncate">{tab.label}</span>
              <span className="text-xs opacity-70 hidden md:block">{tab.description}</span>
            </button>
          )
        })}
      </div>

      {/* Chat Content */}
      <div className="min-h-[400px]">
        {activeTab === 'event' && (
          <EventChat eventId={eventId} isAdmin={isAdmin} />
        )}
        {activeTab === 'private' && (
          <PrivateChat eventId={eventId} isAdmin={isAdmin} />
        )}
        {activeTab === 'support' && (
          <SupportChat eventId={eventId} isAdmin={isAdmin} />
        )}
        {activeTab === 'match' && (matchId || tournamentMatchId) && (
          <MatchChat 
            matchId={matchId} 
            tournamentMatchId={tournamentMatchId} 
            isAdmin={isAdmin} 
          />
        )}
      </div>
    </div>
  )
}