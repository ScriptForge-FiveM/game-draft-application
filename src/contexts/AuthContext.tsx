import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Profile {
  id: string
  username: string
  discord_id?: string
  avatar_url?: string
  is_admin: boolean
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  signInWithDiscord: () => Promise<void>
  refreshProfile: () => Promise<void>
  isAdminViewActive: boolean
  toggleAdminView: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdminViewActive, setIsAdminViewActive] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 10

  useEffect(() => {
    console.log('🔧 AuthProvider initialized')
    
    // Get initial session
    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event, session?.user?.id)
        console.log('📋 Session details:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userEmail: session?.user?.email,
          userMetadata: session?.user?.user_metadata,
          provider: session?.user?.app_metadata?.provider
        })
        
        if (session?.user) {
          console.log('✅ User authenticated:', session.user.id)
          setUser(session.user)
          setRetryCount(0) // Reset retry count on new session
          
          // For new sign-ins, wait a bit for the database trigger
          if (event === 'SIGNED_IN') {
            console.log('🆕 New sign in detected, waiting for profile creation...')
            // Wait longer for profile creation
            setTimeout(async () => {
              await loadUserProfile(session.user.id)
            }, 2000)
          } else {
            await loadUserProfile(session.user.id)
          }
        } else {
          console.log('👋 User signed out or no session')
          setUser(null)
          setProfile(null)
          setRetryCount(0)
          setIsAdminViewActive(true) // Reset to admin view on logout
        }
        
        setLoading(false)
      }
    )

    return () => {
      console.log('🧹 Cleaning up auth subscription')
      subscription.unsubscribe()
    }
  }, [])

  // Auto-retry profile loading if user exists but profile doesn't
  useEffect(() => {
    if (user && !profile && !loading && retryCount < maxRetries) {
      const timer = setTimeout(() => {
        console.log(`🔄 Auto-retry profile loading (${retryCount + 1}/${maxRetries})`)
        setRetryCount(prev => prev + 1)
        loadUserProfile(user.id, 3) // Fewer retries per attempt
      }, 3000) // Wait 3 seconds between retries
      
      return () => clearTimeout(timer)
    }
  }, [user, profile, loading, retryCount])

  const getInitialSession = async () => {
    try {
      console.log('🔍 Getting initial session...')
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error("❌ Error fetching session:", error)
        setUser(null)
        setProfile(null)
      } else if (data.session?.user) {
        console.log('✅ Found existing session for user:', data.session.user.id)
        setUser(data.session.user)
        await loadUserProfile(data.session.user.id)
      } else {
        console.log('ℹ️ No existing session found')
        setUser(null)
        setProfile(null)
      }
    } catch (error) {
      console.error('💥 Error in getInitialSession:', error)
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const loadUserProfile = async (userId: string, retries = 5) => {
    try {
      console.log('📋 Loading profile for user:', userId, `(${retries} retries left)`)
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️ Profile not found for user:', userId)
          if (retries > 0) {
            console.log('🔄 Retrying profile load in 1 second...')
            setTimeout(() => loadUserProfile(userId, retries - 1), 1000)
            return
          } else {
            console.log('❌ Profile still not found after retries, attempting to create...')
            await createMissingProfile(userId)
            setProfile(null)
          }
        } else {
          console.error('❌ Error loading profile:', error)
          setProfile(null)
        }
      } else {
        console.log('✅ Profile loaded successfully:', data)
        setProfile(data)
        setRetryCount(0) // Reset retry count on successful load
      }
    } catch (error) {
      console.error('💥 Error in loadUserProfile:', error)
      setProfile(null)
    }
  }

  const createMissingProfile = async (userId: string) => {
    try {
      console.log('🔧 Attempting to create missing profile for user:', userId)
      
      // Call the database function to create missing profiles
      const { error } = await supabase.rpc('create_missing_profiles')
      
      if (error) {
        console.error('❌ Error creating missing profile:', error)
        return
      }
      
      console.log('✅ Missing profile creation function called')
      
      // Try to load the profile again after a short delay
      setTimeout(async () => {
        const { data, error: loadError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (!loadError && data) {
          console.log('✅ Profile created and loaded successfully:', data)
          setProfile(data)
          setRetryCount(0)
        } else {
          console.log('❌ Profile still not available after creation attempt')
        }
      }, 1000)
      
    } catch (error) {
      console.error('💥 Error in createMissingProfile:', error)
    }
  }

  const signInWithDiscord = async () => {
    try {
      console.log('🚀 Starting Discord sign in...')
      console.log('🌐 Current URL:', window.location.origin)
      
      const redirectTo = `${window.location.origin}/dashboard`
      console.log('🔗 Redirect URL:', redirectTo)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: redirectTo,
          scopes: 'identify email guilds'
        }
      })

      if (error) {
        console.error('❌ Discord sign in error:', error)
        throw error
      }
      
      console.log('✅ Discord OAuth initiated successfully', data)
    } catch (error) {
      console.error('💥 Error signing in with Discord:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      console.log('👋 Signing out...')
      
      // Check if there's actually a session to sign out from
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log('ℹ️ No active session to sign out from')
        // Clear state anyway
        setUser(null)
        setProfile(null)
        setRetryCount(0)
        return
      }
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Sign out error:', error)
        throw error
      }

      // Clear state immediately
      setUser(null)
      setProfile(null)
      setRetryCount(0)
      setIsAdminViewActive(true) // Reset to admin view
      
      console.log('✅ Sign out successful')
    } catch (error) {
      console.error('💥 Error signing out:', error)
      // Even if signOut fails, clear the local state
      setUser(null)
      setProfile(null)
      setRetryCount(0)
      setIsAdminViewActive(true)
      throw error
    }
  }

  const refreshProfile = async () => {
    if (user) {
      console.log('🔄 Manually refreshing profile for user:', user.id)
      setRetryCount(0) // Reset retry count on manual refresh
      await loadUserProfile(user.id)
    }
  }

  const toggleAdminView = () => {
    setIsAdminViewActive(prev => !prev)
  }
  
  const value = {
    user,
    profile,
    loading,
    signOut,
    signInWithDiscord,
    refreshProfile,
    isAdminViewActive,
    toggleAdminView
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}