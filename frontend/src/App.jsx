import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Today from './pages/Today'
import Queue from './pages/Queue'
import Published from './pages/Published'
import Agent from './pages/Agent'
import Shops from './pages/Shops'
import Report from './pages/Report'
import Settings from './pages/Settings'
import { getAgentStatus, getConceptStats } from './api'

const navItems = [
  { to: '/', label: 'Vandaag', mobileLabel: 'Vandaag', icon: '☀️', exact: true },
  { to: '/queue', label: 'Wachtrij', mobileLabel: 'Wachtrij', icon: '📋' },
  { to: '/published', label: 'Gepubliceerd', mobileLabel: 'Live', icon: '🚀' },
  { to: '/agent', label: 'Agent', mobileLabel: 'Agent', icon: '🤖' },
  { to: '/shops', label: 'Shops', mobileLabel: 'Shops', icon: '🏪' },
  { to: '/report', label: 'Rapport', mobileLabel: 'Rapport', icon: '📊' },
  { to: '/settings', label: 'Instellingen', mobileLabel: 'Settings', icon: '⚙️' },
]

function Sidebar({ status, stats }) {
  return (
    <aside className="hidden md:flex md:flex-col w-56 bg-zinc-900 text-zinc-100 h-screen fixed left-0 top-0 z-20">
      <div className="p-5 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">⚡</span>
          <span className="font-bold text-lg tracking-tight">Zvelo</span>
        </div>
        <p className="text-xs text-zinc-500">Etsy AI Agent</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-orange-500 text-white font-medium'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.to === '/' && (stats?.pending + stats?.ready_for_review) > 0 && (
              <span className="ml-auto bg-orange-400 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {stats.pending + stats.ready_for_review}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${status?.running ? 'bg-orange-400 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="text-zinc-500">
            {status?.running ? 'Agent actief...' : 'Agent inactief'}
          </span>
        </div>
        {status?.simulation && (
          <div className="mt-2 px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400 text-center">
            ⚡ Simulatiemodus
          </div>
        )}
      </div>
    </aside>
  )
}

function BottomNav({ status, stats }) {
  const pendingCount = (stats?.pending || 0) + (stats?.ready_for_review || 0)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 flex md:hidden bg-zinc-900 border-t border-zinc-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors min-h-[56px] ${
              isActive ? 'text-orange-400' : 'text-zinc-500'
            }`
          }
        >
          <span className="text-lg leading-none">{item.icon}</span>
          <span className="text-[9px] leading-tight font-medium">{item.mobileLabel || item.label}</span>
          {item.to === '/' && pendingCount > 0 && (
            <span className="absolute top-1.5 right-[15%] bg-orange-500 text-white text-[8px] rounded-full min-w-[14px] h-[14px] flex items-center justify-center font-bold px-0.5">
              {pendingCount}
            </span>
          )}
          {item.to === '/agent' && status?.running && (
            <span className="absolute top-1.5 right-[15%] w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function Layout({ children }) {
  const [status, setStatus] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const load = () => {
      getAgentStatus().then(setStatus).catch(() => {})
      getConceptStats().then(setStats).catch(() => {})
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar status={status} stats={stats} />
      <main className="flex-1 min-h-screen overflow-auto md:ml-56 pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav status={status} stats={stats} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/published" element={<Published />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/shops" element={<Shops />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
