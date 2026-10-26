
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  LogOut,
  Banknote,
  Tag,
  Mail,
  Truck,
  Boxes,
  MessagesSquare,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Refonte maquette (25 oct, demande d'Amira) — groupes + palette marine/
// dore, meme structure que l'artboard AdminSidebar.dc.html : Pilotage /
// Gestion / Assistant IA / Business. "Discussions" (anciennement
// "Conversations IA") reutilise la page deja construite la veille, juste
// renommee ici pour coller a la maquette — l'URL ne change pas.
const NAV_GROUPS = [
  {
    label: 'Pilotage',
    items: [
      { label: 'Vue d\'ensemble', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Suivi du CA', href: '/dashboard/revenue', icon: Banknote },
    ]
  },
  {
    label: 'Gestion',
    items: [
      { label: 'Utilisateurs', href: '/dashboard/users', icon: Users },
      { label: 'Devis', href: '/dashboard/quotes', icon: FileText },
      { label: 'Produits', href: '/dashboard/products', icon: Package },
      { label: 'Fournisseurs', href: '/dashboard/fournisseurs', icon: Truck },
      { label: 'Fournitures', href: '/dashboard/fournitures', icon: Boxes },
    ]
  },
  {
    label: 'Assistant IA',
    items: [
      { label: 'Discussions', href: '/dashboard/conversations', icon: MessagesSquare, badgeKey: 'conversations' as const },
    ]
  },
  {
    label: 'Business',
    items: [
      { label: 'Offres & Tarifs', href: '/dashboard/pricing', icon: Tag },
      { label: 'Communications', href: '/dashboard/communications', icon: Mail },
    ]
  },
]

function initialsFromEmail(email: string) {
  const name = email.split('@')[0] || 'A'
  const parts = name.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function Sidebar({
  isOpen,
  onClose
}: {
  isOpen?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [conversationCount, setConversationCount] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    supabase
      .from('ai_conversations')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setConversationCount(count ?? 0))
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className={cn(
      "fixed left-0 top-0 z-50 h-screen w-[264px] bg-[#16233F] flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 px-3.5 pt-[22px] pb-4 box-border",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex items-center gap-3 px-2.5 pb-5 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-[#E8DCCB] text-[#16233F] text-[15px] font-extrabold flex items-center justify-center shrink-0">
            kj
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-[16px] font-extrabold text-white">Koji Admin</div>
            <div className="text-[12px] text-[#AEB4C4]">Espace administrateur</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-2 text-[#AEB4C4] hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-2.5">
            <div className="px-3 h-6 flex items-center text-[10.5px] font-bold tracking-[0.1em] uppercase text-[#7F8AA3] mb-0.5">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href
              const badge = 'badgeKey' in item && item.badgeKey === 'conversations' ? conversationCount : null
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onClose?.()}
                  className={cn(
                    "flex items-center gap-3 h-10 px-3 rounded-[11px] transition-colors",
                    active ? "bg-white/[0.12]" : "hover:bg-white/[0.06]"
                  )}
                >
                  <item.icon className={cn("w-[18px] h-[18px]", active ? "text-white" : "text-[#AEB4C4]")} />
                  <span className={cn("flex-1 text-[14px]", active ? "font-bold text-white" : "font-semibold text-[#AEB4C4]")}>
                    {item.label}
                  </span>
                  {badge != null && badge > 0 && (
                    <span className="min-w-[22px] h-[22px] px-[7px] rounded-full bg-[#E0A44A] text-[#16233F] text-[11.5px] font-extrabold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-3.5 border-t border-white/10 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-[38px] h-[38px] rounded-full bg-[#1E8E5A] text-white text-[13px] font-extrabold flex items-center justify-center shrink-0">
            {email ? initialsFromEmail(email) : '…'}
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-[13.5px] font-bold text-white truncate">{email || 'Chargement…'}</div>
            <div className="text-[12px] text-[#AEB4C4]">Administrateur</div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 h-10 px-3 rounded-[11px] hover:bg-white/[0.06] transition-colors"
        >
          <LogOut className="w-[18px] h-[18px] text-[#F0A090]" />
          <span className="text-[14px] font-semibold text-[#F0A090]">Se déconnecter</span>
        </button>
      </div>
    </div>
  )
}
