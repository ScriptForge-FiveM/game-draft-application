import React from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Footer } from './Footer'
import { CookieConsent } from './CookieConsent'
import { LogOut, Plus, Trophy, Gamepad2, Shield, TrendingUp, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export function Layout() {
  const { user, profile, signOut, isAdminViewActive, toggleAdminView } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Disconnesso con successo!')
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Errore durante la disconnessione')
    }
  }

  const handleToggleAdminView = () => {
    toggleAdminView()
    toast.success(isAdminViewActive ? 'Modalità Utente Attivata' : 'Modalità Admin Attivata')
  }
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-3 group">
              <img 
                src="/image.png" 
                alt="Lil Turbino Events Logo" 
                className="h-16 w-16  shadow-lg"
              />
              <span className="text-xl font-bold text-white">
                Lil Turbino Events
              </span>
            </Link>
            
            {user && (
              <div className="flex items-center space-x-4">

                <Link
                  to="/dashboard"
                  className="nav-link flex items-center space-x-2 text-white hover:text-orange-300"
                >
                  <Trophy className="h-5 w-5" />
                  <span>Dashboard</span>
                </Link>
                
                <Link
                  to="/rankings"
                  className="nav-link flex items-center space-x-2 text-white hover:text-orange-300"
                >
                  <TrendingUp className="h-5 w-5" />
                  <span>Classifica</span>
                </Link>
                
                {/* Admin View Toggle */}
                {profile?.is_admin && (
                  <button
                    onClick={handleToggleAdminView}
                    className={`nav-link flex items-center space-x-2 transition-all duration-200 ${
                      isAdminViewActive 
                        ? 'text-orange-400 hover:text-orange-300' 
                        : 'text-blue-400 hover:text-blue-300'
                    }`}
                    title={isAdminViewActive ? 'Passa a Vista Utente' : 'Passa a Vista Admin'}
                  >
                    {isAdminViewActive ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    <span className="text-sm font-medium">
                      {isAdminViewActive ? 'Vista Admin' : 'Vista Utente'}
                    </span>
                  </button>
                )}
                
                <div className="flex items-center space-x-3 glass px-4 py-2 rounded-lg">
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.username}
                      className="h-8 w-8 rounded-full border-2 border-white/20"
                    />
                  ) : (
                    <Gamepad2 className="h-5 w-5 text-white" />
                  )}
                  <span className="text-white font-medium">
                    {profile?.username || user.email}
                  </span>
                  {profile?.is_admin && isAdminViewActive && (
                    <span className="badge badge-registration text-xs">
                      <Shield className="h-3 w-3" />
                      Admin
                    </span>
                  )}
                </div>
                
                <button
                  onClick={handleSignOut}
                  className="btn-danger flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Quit</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Outlet />
      </main>
      
      <Footer />
      <CookieConsent />
    </div>
  )
}