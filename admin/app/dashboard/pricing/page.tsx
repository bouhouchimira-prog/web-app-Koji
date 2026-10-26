import { Rocket, Zap, Tag, Percent, History, AlertTriangle } from 'lucide-react'
import { hasStripe, getStripe, PRO_PRICE_IDS, BUSINESS_PRICE_IDS } from '@/lib/stripe'

type PlanPrices = { month: number | null; year: number | null; currency: string }

async function fetchPlanPrices(ids: { month: string; year: string }): Promise<PlanPrices> {
  if (!hasStripe) return { month: null, year: null, currency: 'eur' }
  const stripe = getStripe()
  const [monthPrice, yearPrice] = await Promise.all([
    ids.month ? stripe.prices.retrieve(ids.month).catch(() => null) : Promise.resolve(null),
    ids.year ? stripe.prices.retrieve(ids.year).catch(() => null) : Promise.resolve(null)
  ])
  return {
    month: monthPrice?.unit_amount != null ? monthPrice.unit_amount / 100 : null,
    year: yearPrice?.unit_amount != null ? yearPrice.unit_amount / 100 : null,
    currency: monthPrice?.currency || yearPrice?.currency || 'eur'
  }
}

function formatPrice(amount: number | null, currency: string) {
  if (amount == null) return null
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (currency === 'eur' ? ' €' : ` ${currency.toUpperCase()}`)
}

// Refonte (25 oct) : page entierement decorative avant ce changement (aucune
// table de prix en base, 2 offres + chiffres inventes en dur). Lit maintenant
// les vrais Produits/Prix Stripe de koji-web (memes ids de prix, voir
// lib/stripe.ts) — lecture seule : un Prix Stripe est immuable une fois cree,
// creer/modifier une offre depuis cette page est volontairement hors scope
// (voir le plan), ces actions restent visibles mais marquees "Bientôt".
export default async function PricingPage() {
  if (!hasStripe) {
    return (
      <div className="space-y-5 pb-10">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Offres &amp; Tarifs</h1>
          <p className="text-[14px] text-gray-500 mt-1">Gérez les abonnements, les frais d'inscription et les promotions.</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#0E172C] text-[15px]">Stripe n'est pas configuré</p>
            <p className="text-[14px] text-gray-600 mt-1">Ajoute <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[13px]">STRIPE_SECRET_KEY</code> (et les 4 ids de prix <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[13px]">STRIPE_PRICE_PRO_MONTHLY</code>/<code className="bg-amber-100 px-1.5 py-0.5 rounded text-[13px]">_YEARLY</code>/<code className="bg-amber-100 px-1.5 py-0.5 rounded text-[13px]">STRIPE_PRICE_BUSINESS_MONTHLY</code>/<code className="bg-amber-100 px-1.5 py-0.5 rounded text-[13px]">_YEARLY</code>) dans <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[13px]">.env.local</code> — mêmes valeurs que côté koji-web — pour afficher les vrais tarifs ici.</p>
          </div>
        </div>
      </div>
    )
  }

  const [pro, business] = await Promise.all([
    fetchPlanPrices(PRO_PRICE_IDS),
    fetchPlanPrices(BUSINESS_PRICE_IDS)
  ])

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Offres &amp; Tarifs</h1>
          <p className="text-[14px] text-gray-500 mt-1">Reflète les vrais plans Stripe de koji-web (lecture seule).</p>
        </div>
        <span className="h-11 px-5 rounded-xl border border-dashed border-[#DADDE6] bg-white text-gray-400 text-[14px] font-bold flex items-center">+ Créer une offre · Bientôt</span>
      </div>

      <div className="flex gap-5 items-stretch">
        <div className="flex-1 min-w-0 bg-white border border-[#EDEDF3] rounded-[20px] p-6 flex flex-col gap-3.5">
          <div className="flex justify-between items-start">
            <span className="w-[46px] h-[46px] rounded-[13px] bg-[#EDEFFB] flex items-center justify-center">
              <Rocket className="w-[22px] h-[22px] text-[#16233F]" strokeWidth={1.8} />
            </span>
            <span className="text-[12px] font-bold px-3 py-1 rounded-xl bg-[#F0F1F5] text-gray-500">Gratuit</span>
          </div>
          <div>
            <div className="text-[20px] font-extrabold text-[#16233F]">Start</div>
            <div className="text-[13.5px] text-gray-500 mt-0.5">Pour démarrer et tester Koji</div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-extrabold text-[#16233F] tracking-tight">0 €</span>
            <span className="text-[14px] text-gray-500">/ mois</span>
          </div>
          <p className="text-[13px] text-gray-400">Aucun prix Stripe — offre gratuite, sans carte bancaire.</p>
          <div className="flex-1" />
        </div>

        <div className="flex-1 min-w-0 bg-white border-2 border-[#16233F] rounded-[20px] p-6 flex flex-col gap-3.5">
          <span className="w-[46px] h-[46px] rounded-[13px] bg-[#16233F] flex items-center justify-center">
            <Zap className="w-[22px] h-[22px] text-white" strokeWidth={1.8} />
          </span>
          <div>
            <div className="text-[20px] font-extrabold text-[#16233F]">Koji Pro</div>
            <div className="text-[13.5px] text-gray-500 mt-0.5">Pour les entreprises avec plusieurs chantiers</div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-extrabold text-[#16233F] tracking-tight">{formatPrice(pro.month, pro.currency) || '—'}</span>
            <span className="text-[14px] text-gray-500">/ mois</span>
          </div>
          <p className="text-[13px] text-gray-500">{formatPrice(pro.year, pro.currency) ? `ou ${formatPrice(pro.year, pro.currency)} / mois en annuel` : 'Tarif annuel non configuré'}</p>
          <div className="flex-1" />
          <span className="h-11 rounded-xl border border-dashed border-[#DADDE6] bg-white text-gray-400 text-[14px] font-bold flex items-center justify-center">Modifier les tarifs · Bientôt</span>
        </div>

        <div className="flex-1 min-w-0 bg-white border border-[#EDEDF3] rounded-[20px] p-6 flex flex-col gap-3.5">
          <span className="w-[46px] h-[46px] rounded-[13px] bg-[#EDEFFB] flex items-center justify-center">
            <Rocket className="w-[22px] h-[22px] text-[#16233F]" strokeWidth={1.8} />
          </span>
          <div>
            <div className="text-[20px] font-extrabold text-[#16233F]">Koji Business</div>
            <div className="text-[13.5px] text-gray-500 mt-0.5">Pour les entreprises tous corps d'état</div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-extrabold text-[#16233F] tracking-tight">{formatPrice(business.month, business.currency) || '—'}</span>
            <span className="text-[14px] text-gray-500">/ mois</span>
          </div>
          <p className="text-[13px] text-gray-500">{formatPrice(business.year, business.currency) ? `ou ${formatPrice(business.year, business.currency)} / mois en annuel` : 'Tarif annuel non configuré'}</p>
          <div className="flex-1" />
          <span className="h-11 rounded-xl border border-dashed border-[#DADDE6] bg-white text-gray-400 text-[14px] font-bold flex items-center justify-center">Configurer l'offre · Bientôt</span>
        </div>

        <div className="flex-none w-[320px] flex flex-col gap-5">
          <div className="bg-white border border-[#EDEDF3] rounded-[18px] p-6 flex flex-col gap-2.5">
            <span className="text-[16px] font-extrabold text-[#16233F] mb-1.5">Actions rapides</span>
            {[
              { icon: Tag, label: "Frais d'inscription" },
              { icon: Percent, label: 'Codes promotionnels' },
              { icon: History, label: 'Historique des prix' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[#F6F7FB] text-left opacity-60">
                <item.icon className="w-[18px] h-[18px] text-[#16233F]" strokeWidth={1.8} />
                <span className="flex-1 text-[14px] font-bold text-[#1E2430]">{item.label}</span>
                <span className="text-[11px] font-bold text-gray-400 uppercase">Bientôt</span>
              </div>
            ))}
          </div>
          <div className="bg-[#F3EEE6] rounded-[18px] p-6 flex flex-col gap-2">
            <span className="text-[11.5px] font-bold tracking-wide text-[#8A5A00]">INFO</span>
            <span className="text-[14.5px] font-bold text-[#16233F] leading-relaxed">Un prix Stripe est immuable une fois créé : changer un tarif crée un nouveau prix et archive l'ancien. Fait depuis le dashboard Stripe pour l'instant.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
