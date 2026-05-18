import { useState, useEffect } from "react"
import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom"
import { HashRouter } from "react-router-dom"
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth"
import {
  ShieldCheck, FileText, BookOpen, ClipboardList, LogIn, LogOut, AlertTriangle, Menu, X, ChevronRight, Github
} from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { auth, googleProvider, useEmulator } from "./core/firebase"
// @ts-ignore - virtual module
import { docs } from 'virtual:docs'

function AdminGate({ children, user }: { children: React.ReactNode; user: User | null }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) {
      setIsAdmin(null)
      return
    }

    if (useEmulator) {
      setIsAdmin(true)
      return
    }

    user.getIdTokenResult(true).then((result) => {
      setIsAdmin(!!result.claims.admin)
    })
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <ShieldCheck size={40} className="text-blue-600 mx-auto mb-4" />
          <h1 className="text-xl font-black text-gray-900 mb-2">Icecap Docs</h1>
          <p className="text-gray-500 text-sm mb-6">Sign in with an admin account to access documentation.</p>
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
          <p className="text-gray-500 text-sm mb-6">This account does not have admin privileges. Documentation is restricted to internal team members.</p>
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

function DocContent() {
  const location = useLocation()
  const docId = location.pathname === '/' ? 'readme' : location.pathname.slice(1)
  const doc = docs.find((d: any) => d.id === docId)

  if (!doc) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle size={48} className="text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Document Not Found</h2>
        <p className="text-gray-500 mt-2">The requested documentation page does not exist.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="mb-8 flex items-center gap-2 text-sm font-medium text-gray-400 uppercase tracking-widest">
        <span>{doc.category}</span>
        <ChevronRight size={14} />
        <span className="text-blue-600">{doc.title}</span>
      </div>
      <article className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {doc.content}
        </ReactMarkdown>
      </article>
      <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-between text-sm text-gray-400 font-mono">
        <span>Path: {doc.path}</span>
        <a href={`https://github.com/tianhaozhou/icecap/blob/main/${doc.path}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
          <Github size={14} />
          View on GitHub
        </a>
      </div>
    </div>
  )
}

function Layout({ user }: { user: User }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  
  const categories = Array.from(new Set(docs.map((d: any) => d.category))) as string[]

  return (
    <div className="min-h-screen bg-white flex">
      {/* Mobile Sidebar Toggle */}
      <button 
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-blue-600 text-white rounded-full shadow-lg lg:hidden"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-gray-50 border-r border-gray-100 transform transition-transform duration-300 lg:translate-x-0 lg:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <BookOpen size={18} />
            </div>
            <div>
              <h1 className="font-black text-gray-900 leading-none">Icecap</h1>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Documentation</span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto space-y-8">
            {categories.map(category => (
              <div key={category}>
                <h2 className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                  {category}
                </h2>
                <div className="space-y-1">
                  {docs.filter((d: any) => d.category === category).map((doc: any) => (
                    <NavLink
                      key={doc.id}
                      to={doc.id === 'readme' ? '/' : `/${doc.id}`}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
                        ${isActive 
                          ? 'bg-white text-blue-600 shadow-sm border border-gray-100' 
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}
                      `}
                    >
                      {category === 'Design' ? <ClipboardList size={16} /> : <FileText size={16} />}
                      {doc.title}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-gray-200">
            <div className="flex items-center gap-3 px-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt={user.displayName || ''} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{user.displayName}</p>
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-white">
        <DocContent />
      </main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])

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
        {user && <Layout user={user} />}
      </AdminGate>
    </HashRouter>
  )
}
