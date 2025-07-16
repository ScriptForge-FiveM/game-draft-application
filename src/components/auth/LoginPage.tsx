import React from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../../lib/supabase'
import { Gamepad2, Users, Zap, Trophy } from 'lucide-react'

export function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Hero content */}
        <div className="text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start mb-6">
            <Gamepad2 className="h-12 w-12 text-purple-500 mr-3" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Lil Draft
            </h1>
          </div>
          
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Live Draft Events for Gaming Communities
          </h2>
          
          <p className="text-xl text-gray-300 mb-8">
            Create engaging draft experiences for your Twitch streams. Perfect for FIFA Pro Clubs, NBA 2K, and any team-based game.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <Users className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <h3 className="font-semibold text-white">Team Building</h3>
              <p className="text-sm text-gray-400">Create balanced teams with live drafting</p>
            </div>
            <div className="text-center">
              <Zap className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <h3 className="font-semibold text-white">Real-time</h3>
              <p className="text-sm text-gray-400">Live updates during your stream</p>
            </div>
            <div className="text-center">
              <Trophy className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
              <h3 className="font-semibold text-white">Tournaments</h3>
              <p className="text-sm text-gray-400">Auto-generate tournament brackets</p>
            </div>
          </div>
        </div>
        
        {/* Right side - Auth form */}
        <div className="bg-gray-800 rounded-lg p-8 shadow-xl border border-gray-700">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white text-center">Get Started</h3>
            <p className="text-gray-400 text-center mt-2">Sign in to create your first draft event</p>
          </div>
          
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#8B5CF6',
                    brandAccent: '#7C3AED',
                    inputBackground: '#374151',
                    inputBorder: '#4B5563',
                    inputText: '#F9FAFB',
                    inputLabelText: '#D1D5DB',
                  }
                }
              },
              className: {
                container: 'text-white',
                label: 'text-gray-300',
                button: 'bg-purple-600 hover:bg-purple-700 text-white font-medium',
                input: 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              }
            }}
            providers={['discord']}
            onlyThirdPartyProviders={true}
            redirectTo={`${window.location.origin}/dashboard`}
          />
        </div>
      </div>
    </div>
  )
}