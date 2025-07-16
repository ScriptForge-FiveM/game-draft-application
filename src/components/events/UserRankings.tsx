import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Trophy, Target, Users, Shield, Crown, Star, TrendingUp, Award, Medal, Zap } from 'lucide-react'

interface UserRanking {
  id: string
  user_id: string
  username: string
  total_drafts: number
  drafts_won: number
  total_matches: number
  total_wins: number
  total_losses: number
  total_goals: number
  total_assists: number
  total_clean_sheets: number
  captain_count: number
  mvp_awards: number
  top_scorer_awards: number
  top_assists_awards: number
  best_goalkeeper_awards: number
  ranking_points: number
  win_rate: number
  goals_per_match: number
  assists_per_match: number
}

interface DraftAward {
  id: string
  event_id: string
  award_type: string
  user_id: string
  username: string
  value: number
  description: string
  event?: {
    title: string
  }
}

export function UserRankings() {
  const [rankings, setRankings] = useState<UserRanking[]>([])
  const [recentAwards, setRecentAwards] = useState<DraftAward[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overall' | 'goals' | 'assists' | 'wins' | 'clean_sheets' | 'awards'>('overall')

  useEffect(() => {
    fetchRankingsAndAwards()
  }, [])

  const fetchRankingsAndAwards = async () => {
    try {
      // Fetch ALL user rankings (including those with 0 stats)
      const { data: rankingsData, error: rankingsError } = await supabase
        .from('user_rankings')
        .select('*')
        .order('ranking_points', { ascending: false })
        .limit(100) // Increased limit to show more users

      if (rankingsError) throw rankingsError

      // Fetch recent awards
      const { data: awardsData, error: awardsError } = await supabase
        .from('draft_awards')
        .select(`
          *,
          event:event_id (title)
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (awardsError) throw awardsError

      setRankings(rankingsData || [])
      setRecentAwards(awardsData || [])
    } catch (error) {
      console.error('Error fetching rankings:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSortedRankings = () => {
    switch (activeTab) {
      case 'goals':
        return [...rankings].sort((a, b) => b.total_goals - a.total_goals)
      case 'assists':
        return [...rankings].sort((a, b) => b.total_assists - a.total_assists)
      case 'wins':
        return [...rankings].sort((a, b) => b.total_wins - a.total_wins)
      case 'clean_sheets':
        return [...rankings].sort((a, b) => b.total_clean_sheets - a.total_clean_sheets)
      case 'awards':
        return [...rankings].sort((a, b) => 
          (b.mvp_awards + b.top_scorer_awards + b.top_assists_awards + b.best_goalkeeper_awards) - 
          (a.mvp_awards + a.top_scorer_awards + a.top_assists_awards + a.best_goalkeeper_awards)
        )
      default:
        return rankings
    }
  }

  const getAwardIcon = (awardType: string) => {
    switch (awardType) {
      case 'mvp':
        return <Crown className="h-4 w-4 text-yellow-400" />
      case 'top_scorer':
        return <Target className="h-4 w-4 text-red-400" />
      case 'top_assists':
        return <Users className="h-4 w-4 text-blue-400" />
      case 'best_goalkeeper':
        return <Shield className="h-4 w-4 text-green-400" />
      case 'tournament_winner':
        return <Trophy className="h-4 w-4 text-purple-400" />
      default:
        return <Award className="h-4 w-4 text-gray-400" />
    }
  }

  const getAwardLabel = (awardType: string) => {
    switch (awardType) {
      case 'mvp':
        return 'MVP'
      case 'top_scorer':
        return 'Top Scorer'
      case 'top_assists':
        return 'Top Assists'
      case 'best_goalkeeper':
        return 'Best Goalkeeper'
      case 'tournament_winner':
        return 'Tournament Winner'
      default:
        return awardType
    }
  }

  const getRankIcon = (position: number) => {
    if (position === 1) return <Trophy className="h-6 w-6 text-yellow-400" />
    if (position === 2) return <Medal className="h-6 w-6 text-gray-400" />
    if (position === 3) return <Medal className="h-6 w-6 text-orange-400" />
    return <span className="text-lg font-bold text-gray-400">#{position}</span>
  }

  const getStatValue = (user: UserRanking) => {
    switch (activeTab) {
      case 'goals':
        return user.total_goals
      case 'assists':
        return user.total_assists
      case 'wins':
        return user.total_wins
      case 'clean_sheets':
        return user.total_clean_sheets
      case 'awards':
        return user.mvp_awards + user.top_scorer_awards + user.top_assists_awards + user.best_goalkeeper_awards
      default:
        return user.ranking_points
    }
  }

  const getStatLabel = () => {
    switch (activeTab) {
      case 'goals':
        return 'Goal Totali'
      case 'assists':
        return 'Assist Totali'
      case 'wins':
        return 'Vittorie Totali'
      case 'clean_sheets':
        return 'Clean Sheets Totali'
      case 'awards':
        return 'Premi Totali'
      default:
        return 'Punti Ranking'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  const sortedRankings = getSortedRankings()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full mb-6">
          <TrendingUp className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">Classifica Giocatori</h1>
        <p className="text-xl text-white/80">I migliori giocatori della community</p>
      </div>

      {/* Recent Awards */}
      {recentAwards.length > 0 && (
        <div className="glass rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
            <Star className="h-6 w-6 mr-2 text-yellow-400" />
            Premi Recenti
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentAwards.slice(0, 8).map((award) => (
              <div key={award.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                <div className="flex items-center space-x-2 mb-2">
                  {getAwardIcon(award.award_type)}
                  <span className="font-medium text-white text-sm">{getAwardLabel(award.award_type)}</span>
                </div>
                <p className="font-bold text-white">{award.username}</p>
                <p className="text-sm text-gray-400">{award.event?.title}</p>
                {award.description && (
                  <p className="text-xs text-gray-500 mt-1">{award.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 overflow-x-auto">
        {[
          { id: 'overall', label: 'Generale', icon: TrendingUp },
          { id: 'goals', label: 'Goal', icon: Target },
          { id: 'assists', label: 'Assist', icon: Users },
          { id: 'wins', label: 'Vittorie', icon: Trophy },
          { id: 'clean_sheets', label: 'Clean Sheets', icon: Shield },
          { id: 'awards', label: 'Premi', icon: Award }
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-3 rounded-md font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Rankings */}
      <div className="glass rounded-xl border border-white/20 overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-6">
            Classifica per {getStatLabel()}
          </h3>
          
          {sortedRankings.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h4 className="text-xl font-semibold text-gray-300 mb-2">Nessun Dato</h4>
              <p className="text-gray-500">Non ci sono ancora statistiche disponibili.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedRankings.map((user, index) => {
                const position = index + 1
                const statValue = getStatValue(user)
                
                return (
                  <div 
                    key={user.id} 
                    className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                      position <= 3 
                        ? 'bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-600/30' 
                        : 'bg-gray-700 border border-gray-600'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-12 h-12">
                        {getRankIcon(position)}
                      </div>
                      
                      <div>
                        <h4 className="font-bold text-white">{user.username}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-400">
                          <span>{user.total_drafts} draft</span>
                          <span>{user.total_matches} partite</span>
                          {user.captain_count > 0 && (
                            <span className="flex items-center space-x-1">
                              <Crown className="h-3 w-3 text-yellow-400" />
                              <span>{user.captain_count}x capitano</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">{statValue}</p>
                      <p className="text-sm text-gray-400">{getStatLabel()}</p>
                      
                      {activeTab === 'overall' && (
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-green-400">{user.win_rate}% WR</span>
                          <span className="text-xs text-red-400">{user.goals_per_match} G/M</span>
                          <span className="text-xs text-blue-400">{user.assists_per_match} A/M</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top 3 Podium */}
      {sortedRankings.length >= 3 && (
        <div className="glass rounded-xl p-8 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-6 text-center">Podio {getStatLabel()}</h3>
          <div className="flex items-end justify-center space-x-8">
            {/* 2nd Place */}
            <div className="text-center">
              <div className="w-20 h-16 bg-gradient-to-t from-gray-600 to-gray-400 rounded-t-lg flex items-end justify-center pb-2">
                <Medal className="h-8 w-8 text-white" />
              </div>
              <div className="bg-gray-700 rounded-b-lg p-4 border-t-4 border-gray-400">
                <p className="font-bold text-white">{sortedRankings[1].username}</p>
                <p className="text-2xl font-bold text-gray-400">{getStatValue(sortedRankings[1])}</p>
                <p className="text-xs text-gray-500">2° Posto</p>
              </div>
            </div>

            {/* 1st Place */}
            <div className="text-center">
              <div className="w-24 h-20 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-t-lg flex items-end justify-center pb-2">
                <Crown className="h-10 w-10 text-white" />
              </div>
              <div className="bg-gray-700 rounded-b-lg p-4 border-t-4 border-yellow-400">
                <p className="font-bold text-white">{sortedRankings[0].username}</p>
                <p className="text-3xl font-bold text-yellow-400">{getStatValue(sortedRankings[0])}</p>
                <p className="text-xs text-gray-500">1° Posto</p>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="text-center">
              <div className="w-20 h-12 bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-lg flex items-end justify-center pb-2">
                <Medal className="h-6 w-6 text-white" />
              </div>
              <div className="bg-gray-700 rounded-b-lg p-4 border-t-4 border-orange-400">
                <p className="font-bold text-white">{sortedRankings[2].username}</p>
                <p className="text-2xl font-bold text-orange-400">{getStatValue(sortedRankings[2])}</p>
                <p className="text-xs text-gray-500">3° Posto</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}