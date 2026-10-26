import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { LayoutDashboard, Users, FileText, Package, Banknote, CheckCircle2, XCircle, UserPlus, Truck } from 'lucide-react'

function formatEuro(value: number) {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `Il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Hier'
  return `Il y a ${days} j`
}

function isSigned(status: string | null) {
  const key = (status || '').toLowerCase()
  return ['signed', 'signe', 'signé', 'accepted', 'accepte'].includes(key)
}
function isRefused(status: string | null) {
  const key = (status || '').toLowerCase()
  return ['refused', 'refuse', 'refusé', 'rejected'].includes(key)
}

// Refonte maquette (25 oct, AdminDashboard.dc.html) — garde les vraies
// requetes deja en place (users/quotes/products counts), corrige un bug
// trouve en route (la carte "Volume en cours" affichait un montant
// "€28 342,3" code en dur, alors que la vraie valeur etait deja calculee
// dans potentialValue sans jamais etre utilisee), et construit une vraie
// "Activite recente" a partir des derniers devis/utilisateurs reels
// (plutot que la liste entierement inventee de la version precedente).
export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )

  const [
    { count: usersCount },
    { count: quotesCount },
    { count: productsCount },
    { data: activeQuotes },
    { data: recentQuotes },
    { data: recentUsers },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('quotes').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('quotes').select('total_amount').eq('status', 'en_cours'),
    supabase.from('quotes').select('client_name, total_amount, status, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('users').select('email, profession, is_pro, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const potentialValue = activeQuotes?.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0) || 0

  type Activity = { icon: any; title: string; sub: string; at: string }
  const activities: Activity[] = [
    ...(recentQuotes || []).map((q): Activity => ({
      icon: isSigned(q.status) ? CheckCircle2 : isRefused(q.status) ? XCircle : FileText,
      title: isSigned(q.status) ? 'Devis signé' : isRefused(q.status) ? 'Devis refusé' : 'Nouveau devis créé',
      sub: `${q.client_name || 'Nouveau prospect'} · ${formatEuro(Number(q.total_amount || 0))}`,
      at: q.created_at,
    })),
    ...(recentUsers || []).map((u): Activity => ({
      icon: UserPlus,
      title: u.is_pro ? 'Nouvel utilisateur Pro' : 'Nouvel utilisateur',
      sub: `${u.email} · ${u.profession || 'Particulier'}`,
      at: u.created_at,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6)

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Vue d’ensemble</h1>
        <p className="text-[14px] text-gray-500 mt-1">Bon retour. Voici ce qui se passe aujourd’hui.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Utilisateurs', value: usersCount || 0 },
          { icon: FileText, label: 'Devis', value: quotesCount || 0 },
          { icon: Banknote, label: 'Volume en cours', value: formatEuro(potentialValue), sub: 'HT, devis en attente' },
          { icon: Package, label: 'Produits', value: productsCount || 0, sub: 'au catalogue' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-[#EDEDF3] rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-gray-400">
              <kpi.icon className="w-4 h-4" />
              <span className="text-[12px] font-semibold">{kpi.label}</span>
            </div>
            <span className="text-[24px] font-extrabold text-[#16233F]">{kpi.value}</span>
            {kpi.sub && <span className="text-[12px] text-gray-500">{kpi.sub}</span>}
          </div>
        ))}
      </div>

      <div className="flex gap-5 items-start">
        <div className="flex-[1.7] min-w-0 bg-white border border-[#EDEDF3] rounded-[18px] p-6 flex flex-col gap-1">
          <span className="text-[16px] font-extrabold text-[#16233F] mb-2">Activité récente</span>
          {activities.length === 0 && <p className="text-[13.5px] text-gray-500 py-4">Aucune activité pour l’instant.</p>}
          {activities.map((item, idx) => (
            <div key={idx} className={`flex items-center gap-3.5 py-3 ${idx < activities.length - 1 ? 'border-b border-[#F4F4F8]' : ''}`}>
              <div className="w-10 h-10 rounded-[11px] bg-[#EDEFFB] flex items-center justify-center shrink-0">
                <item.icon className="w-[18px] h-[18px] text-[#16233F]" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-[#1E2430] truncate">{item.title}</div>
                <div className="text-[12.5px] text-gray-500 mt-0.5 truncate">{item.sub}</div>
              </div>
              <span className="text-[12.5px] text-gray-400 shrink-0">{timeAgo(item.at)}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <div className="bg-white border border-[#EDEDF3] rounded-[18px] p-6 flex flex-col gap-2.5">
            <span className="text-[16px] font-extrabold text-[#16233F] mb-1.5">Actions rapides</span>
            {[
              { icon: Package, label: 'Ajouter un produit', href: '/dashboard/products' },
              { icon: Truck, label: 'Ajouter un fournisseur', href: '/dashboard/fournisseurs' },
              { icon: LayoutDashboard, label: 'Ajouter une fourniture', href: '/dashboard/fournitures' },
            ].map((action) => (
              <a key={action.label} href={action.href} className="flex items-center gap-3 p-3 rounded-xl bg-[#F6F7FB]">
                <action.icon className="w-[18px] h-[18px] text-[#16233F]" strokeWidth={1.8} />
                <span className="flex-1 text-[14px] font-bold text-[#1E2430]">{action.label}</span>
                <span className="text-gray-400">›</span>
              </a>
            ))}
          </div>

          {(productsCount || 0) === 0 && (
            <div className="bg-[#F3EEE6] rounded-[18px] p-6 flex flex-col gap-2">
              <span className="text-[11.5px] font-bold tracking-wide text-[#8A5A00]">À SURVEILLER</span>
              <span className="text-[15px] font-bold text-[#16233F] leading-relaxed">
                Le catalogue produits est vide. Ajoutez les premiers articles pour les proposer aux artisans.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
