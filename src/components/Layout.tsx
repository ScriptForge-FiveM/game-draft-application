import React from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Footer } from './Footer'
import { CookieConsent } from './CookieConsent'
import { LogOut, Plus, Trophy, Gamepad2, Shield, TrendingUp, Eye, EyeOff, Menu, X } from 'lucide-react'
import toast from 'react-hot-toast'

export function Layout() {
  const { user, profile, signOut, isAdminViewActive, toggleAdminView } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

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

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="solid-bg border-b border-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center space-x-3 group">
              <img 
                src="/image.png" 
                alt="Lil Turbino Events Logo" 
                className="h-12 w-12 md:h-16 md:w-16 shadow-lg"
              />
              <span className="text-lg md:text-xl font-bold text-white hidden sm:block">
                Lil Turbino Events
              </span>
            </Link>
            
            {user && (
              <>
                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center space-x-4">
                  <Link
                    to="/dashboard"
                    className="nav-link flex items-center space-x-2 text-white hover:text-[#005ee2]"
                  >
                    <Trophy className="h-5 w-5" />
                    <span>Dashboard</span>
                  </Link>
                  
                  <Link
                    to="/rankings"
                    className="nav-link flex items-center space-x-2 text-white hover:text-[#005ee2]"
                  >
                    <TrendingUp className="h-5 w-5" />
                    <span>Classifica</span>
                  </Link>
                  
                  <Link
                    to="/shop"
                    className="nav-link flex items-center space-x-2 text-white hover:text-[#005ee2]"
                  >
                    <Trophy className="h-5 w-5" />
                    <span>Shop</span>
                  </Link>
                  
                  {/* Admin View Toggle */}
                  {profile?.is_admin && (
                    <button
                      onClick={handleToggleAdminView}
                      className={`nav-link flex items-center space-x-2 transition-all duration-200 ${
                        isAdminViewActive 
                          ? 'text-[#005ee2] hover:text-[#4A90E2]' 
                          : 'text-[#005ee2] hover:text-[#4A90E2]'
                      }`}
                      title={isAdminViewActive ? 'Passa a Vista Utente' : 'Passa a Vista Admin'}
                    >
                      {isAdminViewActive ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                      <span className="text-sm font-medium">
                        {isAdminViewActive ? 'Vista Admin' : 'Vista Utente'}
                      </span>
                    </button>
                  )}
                  
                  <div className="flex items-center space-x-3 solid-bg px-4 py-2 rounded-lg">
                    {profile?.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt={profile.username}
                        className="h-8 w-8 rounded-full border-2 border-slate-500"
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

                {/* Mobile Navigation */}
                <div className="md:hidden flex items-center space-x-2">
                  <div className="flex items-center space-x-2 solid-bg px-3 py-2 rounded-lg">
                    {profile?.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt={profile.username}
                        className="h-6 w-6 rounded-full border border-slate-500"
                      />
                    ) : (
                      <Gamepad2 className="h-4 w-4 text-white" />
                    )}
                    <span className="text-white font-medium text-sm">
                      {profile?.username?.substring(0, 8) || user.email?.split('@')[0]?.substring(0, 8)}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 rounded-xl solid-bg text-white hover:bg-slate-600 transition-colors"
                  >
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu */}
          {user && mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-600 py-4">
              <div className="space-y-2">
                <Link
                  to="/dashboard"
                  onClick={closeMobileMenu}
                  className="flex items-center space-x-3 px-4 py-3 text-white hover:bg-[#005ee2]/20 rounded-xl transition-colors"
                >
                  <Trophy className="h-5 w-5" />
                  <span>Dashboard</span>
                </Link>
                
                <Link
                  to="/rankings"
                  onClick={closeMobileMenu}
                  className="flex items-center space-x-3 px-4 py-3 text-white hover:bg-[#005ee2]/20 rounded-xl transition-colors"
                >
                  <TrendingUp className="h-5 w-5" />
                  <span>Classifica</span>
                </Link>
                
                <Link
                  to="/shop"
                  onClick={closeMobileMenu}
                  className="flex items-center space-x-3 px-4 py-3 text-white hover:bg-[#005ee2]/20 rounded-xl transition-colors"
                >
                  <Trophy className="h-5 w-5" />
                  <span>Shop</span>
                </Link>
                
                {profile?.is_admin && (
                  <button
                    onClick={() => {
                      handleToggleAdminView()
                      closeMobileMenu()
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isAdminViewActive 
                        ? 'text-[#005ee2] hover:bg-[#005ee2]/20 rounded-xl' 
                        : 'text-[#005ee2] hover:bg-[#005ee2]/20 rounded-xl'
                    }`}
                  >
                    {isAdminViewActive ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    <span>
                      {isAdminViewActive ? 'Vista Admin' : 'Vista Utente'}
                    </span>
                  </button>
                )}
                
                <div className="border-t border-slate-600 pt-2 mt-2">
                  <button
                    onClick={() => {
                      handleSignOut()
                      closeMobileMenu()
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-600/20 rounded-xl transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Disconnetti</span>
                  </button>
                </div>
              </div>
            </div>
                  )}
        </div>
      </nav>
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 w-full">
        <Outlet />
      </main>
      
      <Footer />
      <CookieConsent />
    </div>
  )
}