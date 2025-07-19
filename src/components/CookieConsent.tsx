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
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 md:p-4 bg-slate-900/95 border-t border-slate-700">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-start space-x-2 md:space-x-3 flex-1">
            <Cookie className="h-6 w-6 text-orange-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-white font-semibold mb-1 text-sm md:text-base">Utilizziamo i Cookie</h3>
              <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                Utilizziamo cookie essenziali per il funzionamento del sito e cookie analitici per migliorare la tua esperienza. 
                I cookie sono necessari per l'autenticazione Discord e per salvare le tue preferenze.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 flex-shrink-0 w-full md:w-auto">
            <button
              onClick={declineCookies}
              className="px-3 md:px-4 py-2 text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-xl transition-colors text-xs md:text-sm font-medium"
            >
              Solo Essenziali
            </button>
            <button
              onClick={acceptCookies}
              className="px-4 md:px-6 py-2 bg-gradient-to-r from-[#005ee2] to-[#004BB8] hover:from-[#004BB8] hover:to-[#003A8C] text-white rounded-xl transition-all font-medium text-xs md:text-sm flex items-center justify-center space-x-2"
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