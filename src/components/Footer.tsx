import React from 'react'
import { Heart, Shield, Mail, ExternalLink, Gamepad2, Users, Trophy, Calendar, X } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()
  const [showPrivacyModal, setShowPrivacyModal] = React.useState(false)
  const [showTermsModal, setShowTermsModal] = React.useState(false)

  return (
    <footer className="bg-gray-900/50 backdrop-blur-sm border-t border-gray-700 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/image.png" 
                alt="Lil Turbino Events Logo" 
                className="h-12 w-12 rounded-full"
              />
              <div>
                <h3 className="text-xl font-bold text-white">Lil Turbino Events</h3>
                <p className="text-orange-400 text-sm font-medium">Tornei Gaming Esclusivi</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6 leading-relaxed max-w-md">
              La piattaforma ufficiale per i draft events di Lil Turbino. Partecipa ai tornei esclusivi, 
              forma la tua squadra e competi con i migliori giocatori della community.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center space-x-4">
              <a
                href="https://www.twitch.tv/lilturbinotv"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors group"
                title="Twitch"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                </svg>
              </a>
              
              <a
                href="https://discord.gg/QMZKJ9ar7t"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors group"
                title="Discord"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/>
                </svg>
              </a>
              
              <a
                href="https://www.youtube.com/@lilturbino"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors group"
                title="YouTube"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              
              <a
                href="https://www.instagram.com/lilturbino"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-lg transition-all group"
                title="Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 flex items-center">
              <Gamepad2 className="h-5 w-5 mr-2 text-orange-400" />
              Piattaforma
            </h4>
            <ul className="space-y-3">
              <li>
                <a href="/dashboard" className="text-gray-300 hover:text-orange-400 transition-colors flex items-center text-sm">
                  <Trophy className="h-4 w-4 mr-2" />
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/rankings" className="text-gray-300 hover:text-orange-400 transition-colors flex items-center text-sm">
                  <Users className="h-4 w-4 mr-2" />
                  Classifica
                </a>
              </li>
              <li>
                <a href="https://discord.gg/QMZKJ9ar7t" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-orange-400 transition-colors flex items-center text-sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Community Discord
                </a>
              </li>
            </ul>
          </div>

          {/* Support & Info */}
          <div>
            <h4 className="text-white font-semibold mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-orange-400" />
              Supporto
            </h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:support@lilturbinoevents.com" className="text-gray-300 hover:text-orange-400 transition-colors flex items-center text-sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Contattaci
                </a>
              </li>
              <li>
                <button 
                  onClick={() => {
                    localStorage.removeItem('cookieConsent')
                    window.location.reload()
                  }}
                  className="text-gray-300 hover:text-orange-400 transition-colors flex items-center text-sm"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Gestisci Cookie
                </button>
              </li>
              <li>
                <a href="https://www.twitch.tv/lilturbinotv" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-orange-400 transition-colors flex items-center text-sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  Programma Live
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="space-y-6">
            {/* Copyright and Legal */}
            <div className="flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0">
              <div className="text-center lg:text-left">
                <p className="text-gray-300 text-sm font-medium">
                  © {currentYear} Lil Turbino Events. Tutti i diritti riservati.
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Piattaforma ufficiale per eventi gaming esclusivi
                </p>
              </div>
              
              <div className="flex items-center space-x-6 text-sm">
                <button 
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-gray-300 hover:text-orange-400 transition-colors font-medium"
                >
                  Privacy Policy
                </button>
                <button 
                  onClick={() => setShowTermsModal(true)}
                  className="text-gray-300 hover:text-orange-400 transition-colors font-medium"
                >
                  Termini di Servizio
                </button>
              </div>
            </div>
            
            {/* Developer Credit */}
            <div className="border-t border-gray-800 pt-6">
              <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">PT</span>
                  </div>
                  <div>
                    <p className="text-gray-300 text-sm font-medium">
                      Sviluppato da <span className="text-orange-400 font-bold">PatataTurchina</span>
                    </p>
                    <p className="text-gray-500 text-xs">Full-Stack Developer & Gaming Enthusiast</p>
                  </div>
                </div>
                
                <div className="text-center md:text-right">
                  <p className="text-gray-400 text-xs flex items-center justify-center md:justify-end">
                    Fatto con <Heart className="h-4 w-4 mx-1 text-red-500 animate-pulse" /> per la community gaming italiana
                  </p>
    
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Privacy Policy</h3>
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6 text-gray-300">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Raccolta Dati</h4>
                  <p className="leading-relaxed">
                    Raccogliamo solo i dati strettamente necessari per il funzionamento della piattaforma:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Informazioni del profilo Discord (username, avatar, ID)</li>
                    <li>Dati di registrazione agli eventi (posizione, piattaforma, note)</li>
                    <li>Statistiche di gioco per classifiche e tornei</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Utilizzo Dati</h4>
                  <p className="leading-relaxed">
                    I tuoi dati sono utilizzati esclusivamente per:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Autenticazione e gestione del profilo</li>
                    <li>Partecipazione agli eventi draft</li>
                    <li>Generazione di classifiche e statistiche</li>
                    <li>Comunicazioni relative agli eventi</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Protezione Dati</h4>
                  <p className="leading-relaxed text-sm">
                    I tuoi dati sono protetti con crittografia e non vengono mai condivisi con terze parti. 
                    Puoi richiedere la cancellazione del tuo account e di tutti i dati associati in qualsiasi momento.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Cookie</h4>
                  <p className="leading-relaxed text-sm">
                    Utilizziamo cookie essenziali per l'autenticazione e cookie analitici per migliorare l'esperienza utente. 
                    Le tue preferenze sui cookie sono salvate localmente sul tuo dispositivo.
                  </p>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-700">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 rounded-lg transition-colors"
                >
                  Ho Capito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Termini di Servizio</h3>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6 text-gray-300">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Accettazione dei Termini</h4>
                  <p className="leading-relaxed text-sm">
                    Utilizzando questa piattaforma accetti di rispettare tutti i termini e le condizioni qui descritti. 
                    Se non accetti questi termini, non utilizzare il servizio.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Regole della Community</h4>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>Comportati in modo rispettoso verso tutti i partecipanti</li>
                    <li>Non utilizzare linguaggio offensivo o discriminatorio</li>
                    <li>Partecipa agli eventi in modo sportivo e corretto</li>
                    <li>Non creare account multipli o falsi</li>
                    <li>Rispetta le decisioni degli organizzatori e amministratori</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Partecipazione Eventi</h4>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>Registrati solo se puoi effettivamente partecipare</li>
                    <li>Comunica tempestivamente eventuali problemi o assenze</li>
                    <li>Rispetta gli orari e le modalità degli eventi</li>
                    <li>Gioca lealmente senza utilizzare cheat o exploit</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Conseguenze</h4>
                  <p className="leading-relaxed text-sm">
                    La violazione di questi termini può comportare l'esclusione temporanea o permanente dalla piattaforma 
                    e dagli eventi futuri, a discrezione degli amministratori.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Modifiche</h4>
                  <p className="leading-relaxed text-sm">
                    Ci riserviamo il diritto di modificare questi termini in qualsiasi momento. 
                    Le modifiche saranno comunicate attraverso la piattaforma.
                  </p>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-700">
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 rounded-lg transition-colors"
                >
                  Accetto i Termini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  )
}