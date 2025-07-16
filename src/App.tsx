import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedLoginPage } from './components/auth/ProtectedLoginPage'
import { ProfileCompletion } from './components/auth/ProfileCompletion'
import { Dashboard } from './components/dashboard/Dashboard'
import { CreateEvent } from './components/events/CreateEvent'
import { EventManagement } from './components/events/EventManagement'
import { PublicEventView } from './components/events/PublicEventView'
import { PublicEventDetails } from './components/events/PublicEventDetails'
import { UserRankings } from './components/events/UserRankings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isAdminViewActive } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile?.is_admin || !isAdminViewActive) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-white text-xl">Caricamento profilo...</p>
          <p className="text-white/60 text-sm mt-2">Connessione a Discord in corso...</p>
        </div>
      </div>
    )
  }

  // If user is logged in but has no profile, redirect to complete profile
  // But give some time for the automatic profile creation to work
  if (user && !profile) {
    console.log('🔄 User logged in but no profile found, redirecting to profile completion')
    return <Navigate to="/complete-profile" replace />
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : <ProtectedLoginPage />
      } />
      
      <Route path="/complete-profile" element={
        user && !profile ? <ProfileCompletion /> : <Navigate to="/dashboard" replace />
      } />

      {/* Protected routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={
          user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        } />
        
        <Route path="dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="create-event" element={
          <AdminRoute>
            <CreateEvent />
          </AdminRoute>
        } />
        
        <Route path="event/:eventId" element={
          <AdminRoute>
            <EventManagement />
          </AdminRoute>
        } />
        
        <Route path="event/:eventId/captain" element={
          <ProtectedRoute>
            <PublicEventDetails />
          </ProtectedRoute>
        } />
        
        <Route path="event/:eventId/join" element={
          <ProtectedRoute>
            <PublicEventView />
          </ProtectedRoute>
        } />
        
        <Route path="event/:eventId/view" element={
          <ProtectedRoute>
            <PublicEventDetails />
          </ProtectedRoute>
        } />
        
        <Route path="rankings" element={
          <ProtectedRoute>
            <UserRankings />
          </ProtectedRoute>
        } />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#374151',
              color: '#F9FAFB',
              border: '1px solid #4B5563'
            }
          }}
        />
      </Router>
    </AuthProvider>
  )
}

export default App