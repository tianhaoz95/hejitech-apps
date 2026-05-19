import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { LogIn, AlertTriangle } from 'lucide-react'
import { auth, googleProvider } from './core/firebase'
import { Gallery } from './pages/Gallery'
import { RedfinMockup } from './mockups/RedfinMockup'
import { ZillowMockup } from './mockups/ZillowMockup'
import { RealtorMockup } from './mockups/RealtorMockup'
import { HubMockup } from './mockups/HubMockup'
import { SplitImage } from './mockups/SplitImage'

function AdminGate({ children, user }: { children: React.ReactNode; user: User | null }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) { setIsAdmin(null); return }
    user.getIdTokenResult(true).then(result => setIsAdmin(!!result.claims.admin))
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <img src="/logo-color.svg" alt="Icecap" className="h-10 mx-auto mb-5" />
          <h1 className="text-xl font-black text-gray-900 mb-1">Promo Studio</h1>
          <p className="text-gray-400 text-sm mb-6">Sign in with an admin account to access promo assets.</p>
          <button
            onClick={() => signInWithPopup(auth, googleProvider).catch(console.error)}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <AlertTriangle size={40} className="text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-black text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm mb-6">Admin access required.</p>
          <button
            onClick={() => signOut(auth)}
            className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function AppShell({ user }: { user: User }) {
  return (
    <div className="relative">
      <Routes>
        <Route path="/" element={<Gallery user={user} />} />
        <Route path="/mockup/redfin" element={<RedfinMockup />} />
        <Route path="/mockup/zillow" element={<ZillowMockup />} />
        <Route path="/mockup/realtor" element={<RealtorMockup />} />
        <Route path="/mockup/hub" element={<HubMockup />} />
        <Route path="/split" element={<SplitImage />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <HashRouter>
      <AdminGate user={user || null}>
        {user && <AppShell user={user} />}
      </AdminGate>
    </HashRouter>
  )
}
