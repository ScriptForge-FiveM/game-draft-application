import React, { useState, useEffect } from 'react'
import { Cookie, X, Check } from 'lucide-react'

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if user has already accepted cookies
    const hasAccepted = localStorage.getItem('cookieConsent')
    if (!hasAccepted) {
      // Show banner after a short delay
      setTimeout(() => setShowBanner(true), 2000)
    }
  }, [])

  const acceptCookies = () => {
    localStorage.setItem('cookieConsent', 'accepted')
    setShowBanner(false)
  }

  const declineCookies = () => {
    localStorage.setItem('cookieConsent', 'declined')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3 flex-1">
            <Cookie className="h-6 w-6 text-orange-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-white font-semibold mb-1">Utilizziamo i Cookie</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Utilizziamo cookie essenziali per il funzionamento del sito e cookie analitici per migliorare la tua esperienza. 
                I cookie sono necessari per l'autenticazione Discord e per salvare le tue preferenze.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 flex-shrink-0">
            <button
              onClick={declineCookies}
              className="px-4 py-2 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors text-sm font-medium"
            >
              Solo Essenziali
            </button>
            <button
              onClick={acceptCookies}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg transition-all font-medium text-sm flex items-center space-x-2"
            >
              <Check className="h-4 w-4" />
              <span>Accetta Tutti</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}