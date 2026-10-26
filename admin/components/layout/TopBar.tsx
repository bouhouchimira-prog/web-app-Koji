'use client'

import { useEffect, useState } from 'react'
import { Search, Bell, HelpCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// Barre du haut partagee (25 oct, refonte maquette) — auparavant dupliquee
// (avec un faux nom "Marc-Antoine" code en dur) dans chaque page. Un seul
// composant maintenant, affiche le vrai compte connecte.
export default function TopBar() {
  const [email, setEmail] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  return (
    <div className="hidden md:flex h-[72px] shrink-0 box-border bg-white border-b border-[#EDEDF3] items-center gap-3.5 px-9">
      <div className="flex-1">
        <label className="relative block max-w-[460px]">
          <Search className="w-[15px] h-[15px] text-[#9C9FB0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur, un devis, un fournisseur…"
            className="w-full h-[42px] rounded-xl border border-[#E5E5EC] bg-white pl-9 pr-3.5 text-[14px] text-[#1E2430] placeholder-[#9C9FB0] outline-none"
          />
        </label>
      </div>
      <button className="w-[42px] h-[42px] rounded-xl border border-[#EDEDF3] flex items-center justify-center text-gray-500">
        <Bell className="w-[19px] h-[19px]" strokeWidth={1.8} />
      </button>
      <button className="w-[42px] h-[42px] rounded-xl border border-[#EDEDF3] flex items-center justify-center text-gray-500">
        <HelpCircle className="w-[19px] h-[19px]" strokeWidth={1.8} />
      </button>
      {email && (
        <>
          <div className="w-px h-8 bg-gray-200" />
          <span className="text-[13px] font-semibold text-[#16233F] truncate max-w-[220px]">{email}</span>
        </>
      )}
    </div>
  )
}
