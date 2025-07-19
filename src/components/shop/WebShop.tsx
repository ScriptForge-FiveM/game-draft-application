import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ShoppingCart, Gift, CreditCard, Star, Award, DollarSign, ExternalLink, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface UserCredit {
  id: string
  user_id: string
  event_id: string
  amount: number
  reason: string
  created_at: string
  event?: {
    title: string
  }
}

interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  category: 'gift_card' | 'merchandise' | 'premium'
  image_url?: string
  external_url?: string
  is_active: boolean
}

interface Purchase {
  id: string
  user_id: string
  item_id: string
  amount_paid: number
  status: 'pending' | 'completed' | 'cancelled'
  created_at: string
  item?: ShopItem
}

export function WebShop() {
  const { user, profile } = useAuth()
  const [credits, setCredits] = useState<UserCredit[]>([])
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [totalCredits, setTotalCredits] = useState(0)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'shop' | 'credits' | 'purchases'>('shop')

  useEffect(() => {
    if (user) {
      fetchUserData()
    }
  }, [user])

  const fetchUserData = async () => {
    try {
      // Fetch user profile to get total_credits
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('total_credits')
        .eq('id', user?.id)
        .single()
      
      if (profileError) throw profileError
      
      // Fetch user credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select(`
          *,
          event:event_id (title)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (creditsError) throw creditsError

      // Fetch shop items
      const { data: itemsData, error: itemsError } = await supabase
        .from('shop_items')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('price')

      if (itemsError) throw itemsError

      // Fetch user purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('user_purchases')
        .select(`
          *,
          item:item_id (*)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (purchasesError) throw purchasesError

      setCredits(creditsData || [])
      setShopItems(itemsData || [])
      setPurchases(purchasesData || [])

      // Use total_credits from profile (this is the current balance)
      setTotalCredits(profileData?.total_credits || 0)
    } catch (error) {
      console.error('Error fetching user data:', error)
      toast.error('Errore nel caricamento dei dati')
    } finally {
      setLoading(false)
    }
  }

  const purchaseItem = async (item: ShopItem) => {
    if (!user || totalCredits < item.price) {
      toast.error('Crediti insufficienti')
      return
    }

    setPurchasing(item.id)
    try {
      const { error } = await supabase
        .from('user_purchases')
        .insert({
          user_id: user.id,
          item_id: item.id,
          amount_paid: item.price,
          status: 'completed'
        })

      if (error) throw error

      // Deduct credits from profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          total_credits: totalCredits - item.price
        })
        .eq('id', user.id)

      if (profileError) throw profileError
      
      // Also add a credit transaction record for history
      await supabase
        .from('user_credits')
        .insert({
          user_id: user.id,
          event_id: null,
          amount: -item.price,
          reason: `Acquisto: ${item.name}`
        })

      toast.success(`${item.name} acquistato con successo!`)
      fetchUserData()
    } catch (error) {
      console.error('Error purchasing item:', error)
      toast.error('Errore durante l\'acquisto')
    } finally {
      setPurchasing(null)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'gift_card':
        return <Gift className="h-5 w-5 text-green-400" />
      case 'merchandise':
        return <Star className="h-5 w-5 text-blue-400" />
      case 'premium':
        return <Award className="h-5 w-5 text-purple-400" />
      default:
        return <ShoppingCart className="h-5 w-5 text-gray-400" />
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'gift_card':
        return 'Gift Card'
      case 'merchandise':
        return 'Merchandise'
      case 'premium':
        return 'Premium'
      default:
        return category
    }
  }

  const getItemsByCategory = () => {
    const categories: { [key: string]: ShopItem[] } = {}
    shopItems.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = []
      }
      categories[item.category].push(item)
    })
    return categories
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-6">
          <ShoppingCart className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">Web Shop</h1>
        <p className="text-xl text-white/80">Usa i tuoi crediti per acquistare premi esclusivi</p>
      </div>

      {/* Credits Display */}
      <div className="glass rounded-xl p-6 border border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">I Tuoi Crediti</h3>
              <p className="text-gray-400">Guadagnati partecipando ai tornei</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-yellow-400">{totalCredits}</p>
            <p className="text-sm text-gray-400">crediti disponibili</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
        {[
          { id: 'shop', label: 'Negozio', icon: ShoppingCart },
          { id: 'credits', label: 'I Miei Crediti', icon: DollarSign },
          { id: 'purchases', label: 'Acquisti', icon: CreditCard }
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="glass rounded-xl border border-white/20 overflow-hidden">
        <div className="p-6">
          {activeTab === 'shop' && (
            <div className="space-y-8">
              {Object.entries(getItemsByCategory()).map(([category, items]) => (
                <div key={category}>
                  <div className="flex items-center space-x-3 mb-6">
                    {getCategoryIcon(category)}
                    <h3 className="text-xl font-bold text-white">{getCategoryLabel(category)}</h3>
                    <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">
                      {items.length} articoli
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                      <div key={item.id} className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                        {item.image_url && (
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-full h-32 object-cover rounded-lg mb-4"
                          />
                        )}
                        
                        <h4 className="font-bold text-white mb-2">{item.name}</h4>
                        <p className="text-gray-300 text-sm mb-4">{item.description}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-yellow-400" />
                            <span className="text-xl font-bold text-yellow-400">{item.price}</span>
                            <span className="text-gray-400 text-sm">crediti</span>
                          </div>
                          
                          <button
                            onClick={() => purchaseItem(item)}
                            disabled={totalCredits < item.price || purchasing === item.id}
                            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                              totalCredits >= item.price && purchasing !== item.id
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {purchasing === item.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                                Acquistando...
                              </>
                            ) : totalCredits >= item.price ? (
                              'Acquista'
                            ) : (
                              'Crediti Insufficienti'
                            )}
                          </button>
                        </div>
                        
                        {item.external_url && (
                          <a
                            href={item.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center mt-3 text-blue-400 hover:text-blue-300 text-sm"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Maggiori Info
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {shopItems.length === 0 && (
                <div className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                  <h4 className="text-xl font-semibold text-gray-300 mb-2">Negozio in Arrivo</h4>
                  <p className="text-gray-500">
                    Gli articoli del negozio saranno disponibili presto!
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'credits' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-6">Storico Crediti</h3>
              
              {credits.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                  <h4 className="text-xl font-semibold text-gray-300 mb-2">Nessun Credito</h4>
                  <p className="text-gray-500">
                    Partecipa ai tornei per guadagnare crediti!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {credits.map((credit) => (
                    <div key={credit.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{credit.reason}</p>
                          {credit.event && (
                            <p className="text-sm text-gray-400">{credit.event.title}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {new Date(credit.created_at).toLocaleString('it-IT')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${
                            credit.amount > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {credit.amount > 0 ? '+' : ''}{credit.amount}
                          </p>
                          <p className="text-sm text-gray-400">crediti</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'purchases' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-6">I Miei Acquisti</h3>
              
              {purchases.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                  <h4 className="text-xl font-semibold text-gray-300 mb-2">Nessun Acquisto</h4>
                  <p className="text-gray-500">
                    I tuoi acquisti appariranno qui.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <div key={purchase.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{purchase.item?.name}</p>
                          <p className="text-sm text-gray-400">{purchase.item?.description}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(purchase.created_at).toLocaleString('it-IT')}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            {purchase.status === 'completed' ? (
                              <Check className="h-4 w-4 text-green-400" />
                            ) : purchase.status === 'cancelled' ? (
                              <X className="h-4 w-4 text-red-400" />
                            ) : (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                            )}
                            <span className={`text-sm font-medium ${
                              purchase.status === 'completed' ? 'text-green-400' :
                              purchase.status === 'cancelled' ? 'text-red-400' :
                              'text-yellow-400'
                            }`}>
                              {purchase.status === 'completed' ? 'Completato' :
                               purchase.status === 'cancelled' ? 'Annullato' :
                               'In Elaborazione'}
                            </span>
                          </div>
                          <p className="text-lg font-bold text-white">
                            {purchase.amount_paid} crediti
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}