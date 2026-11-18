'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'

// Cadre du back-office (maquette PRO-24) : menu graphite à gauche, page à
// droite ; sur téléphone, le menu s'ouvre par-dessus.
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="md:hidden" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#171B1E', color: '#FFFFFF', position: 'sticky', top: 0, zIndex: 40 }}>
        <b>Back-office Koji</b>
        <button type="button" onClick={() => setOuvert(true)} aria-label="Ouvrir le menu" style={{ background: 'none', border: 0, color: '#FFFFFF' }}><Menu size={22} /></button>
      </div>
      <Sidebar isOpen={ouvert} onClose={() => setOuvert(false)} />
      <main className="md:pl-[248px]">
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px 48px' }}>{children}</div>
      </main>
      {ouvert ? <div onClick={() => setOuvert(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 45 }} className="md:hidden" /> : null}
    </div>
  )
}
