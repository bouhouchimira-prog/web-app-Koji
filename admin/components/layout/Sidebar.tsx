'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { X } from 'lucide-react'

// Menu du back-office (maquette PRO-24, décision ABL du 4 nov.) : lecture
// par univers, cinq groupes. Les messages des particuliers et les échanges
// entre entreprises ne se mélangent jamais. Une rubrique pas encore
// construite reste visible, marquée « bientôt ».
type Item = { label: string; href: string; bientot?: boolean }
const GROUPES: { label: string; univers?: 'pro' | 'client'; items: Item[] }[] = [
  { label: "Vue d'ensemble", items: [{ label: 'Tableau de bord', href: '/dashboard' }] },
  {
    label: 'Koji Pro · entreprises', univers: 'pro',
    items: [
      { label: 'Entreprises', href: '/dashboard/entreprises' },
      { label: 'Devis', href: '/dashboard/quotes' },
      { label: 'Réseau pro', href: '/dashboard/reseau' },
      { label: 'Support Pro', href: '/dashboard/support-pro' },
      { label: 'Prix et offres', href: '/dashboard/pricing' },
      { label: 'Revenus', href: '/dashboard/revenue' }
    ]
  },
  {
    label: 'Koji Client · particuliers', univers: 'client',
    items: [
      { label: 'Particuliers', href: '/dashboard/particuliers' },
      { label: 'Demandes', href: '/dashboard/demandes' },
      { label: 'Conversations', href: '/dashboard/conversations' },
      { label: 'Support Client', href: '/dashboard/support-client' }
    ]
  },
  { label: 'Partenaires', items: [{ label: 'Fournisseurs', href: '/dashboard/fournisseurs' }, { label: 'Produits', href: '/dashboard/products' }] },
  { label: 'Transversal', items: [{ label: 'Communications', href: '/dashboard/communications' }, { label: 'Journal des accès', href: '/dashboard/journal' }] }
]

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sortir = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }
  const actif = (href: string) => (href === '/dashboard' ? pathname === href : Boolean(pathname?.startsWith(href)))

  return (
    <aside className={`bo-side ${isOpen ? 'ouvert' : ''}`} aria-label="Navigation du back-office">
      <div className="bo-marque">
        <b>Back-office</b>
        {onClose ? <button type="button" className="bo-fermer" onClick={onClose} aria-label="Fermer le menu"><X size={18} /></button> : null}
      </div>
      <nav>
        {GROUPES.map((g) => (
          <div key={g.label} className="bo-grp">
            <span className={`bo-grp-t ${g.univers ? `u-${g.univers}` : ''}`}>{g.label}</span>
            {g.items.map((i) => i.bientot ? (
              <span key={i.href} className="bo-lien off" aria-disabled="true">{i.label}<small>bientôt</small></span>
            ) : (
              <Link key={i.href} href={i.href} onClick={() => onClose?.()} className={`bo-lien ${actif(i.href) ? 'on' : ''}`} aria-current={actif(i.href) ? 'page' : undefined}>{i.label}</Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="bo-pied">
        <span>{email ? `${email.split('@')[0]} · admin` : '…'}</span>
        <button type="button" onClick={sortir}>Se déconnecter</button>
      </div>
    </aside>
  )
}
