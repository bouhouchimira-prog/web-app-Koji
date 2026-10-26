'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Wallet, ClipboardList, Lightbulb, Eye, Rocket, Phone, MessageCircle, Loader2, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useClientStore } from '@/store/clientStore';
import { fetchClientQuotesByEmail, classifyStatus, type QuoteRecord } from '@/lib/quotesRepository';

const statusBadge: Record<string, { label: string; className: string }> = {
  signed: { label: 'Signé', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'En attente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expiré', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function formatFrenchDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export default function ClientDashboard() {
  const user = useClientStore((s) => s.user);
  const authReady = useClientStore((s) => s.authReady);

  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !user?.email) return;
    let cancelled = false;
    setLoading(true);
    // Match the client's devis by their login email (via chantiers.client_email),
    // NOT by user_id — quotes.user_id is the entreprise, never the client.
    fetchClientQuotesByEmail(user.email)
      .then((data) => { if (!cancelled) { setQuotes(data); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message || 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authReady, user?.email]);

  const totalEstimate = useMemo(
    () => quotes.reduce((sum, q) => sum + (q.total_ttc || 0), 0),
    [quotes]
  );

  const pendingCount = useMemo(
    () => quotes.filter((q) => classifyStatus(q.status) === 'pending').length,
    [quotes]
  );

  // Derive the artisan (entreprise) from the most recent devis' company snapshot
  // so the "conseiller" card shows the real contact instead of a placeholder.
  const artisan = useMemo(() => {
    for (const q of quotes) {
      const c = q.company || {};
      if (c.name || c.email || c.phone) {
        return {
          name: c.name || 'Votre artisan',
          email: c.email || '',
          phone: c.phone || '',
        };
      }
    }
    return null;
  }, [quotes]);

  const artisanInitials = (artisan?.name || 'KO')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'KO';

  return (
    <div className="flex flex-col">
      <Header title="Tableau de Bord" subtitle={`Bon retour${user?.name ? ', ' + user.name.split(' ')[0] : ''}. Voici ce qui se passe aujourd'hui.`} />

      <div className="px-10 py-6 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mes Devis</h2>
          <p className="text-sm text-gray-500 mt-1">
            Gérez vos demandes de prestations et suivez leur statut en temps réel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <div className="flex items-start justify-between">
              <p className="text-sm text-gray-500">Total estimé</p>
              <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-3">
              {Math.round(totalEstimate).toLocaleString('fr-FR')} <span className="text-xl">€</span>
            </p>
            <p className="text-xs text-gray-500 mt-3">Sur {quotes.length} devis</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <div className="flex items-start justify-between">
              <p className="text-sm text-gray-500">En attente</p>
              <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                <ClipboardList className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-3">
              {pendingCount} <span className="text-base font-medium text-gray-500">devis</span>
            </p>
            <p className="text-xs text-[#1D5FE1] font-semibold mt-3 flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-[#1D5FE1]" /> En attente de signature
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#1D5FE1] to-[#0E172C] rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-white/5" />
            <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center">
              <Lightbulb className="w-5 h-5" />
            </div>
            <p className="text-lg font-bold mt-6 leading-tight">Besoin d&apos;un<br />accompagnement ?</p>
            <p className="text-xs text-white/80 mt-2">Votre artisan est disponible pour vous accompagner sur vos projets.</p>
            <Link href="/client/messages" className="mt-4 inline-flex px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-lg text-sm font-semibold transition-colors">
              Contacter mon artisan
            </Link>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Historique des devis</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center text-sm text-red-500">{error}</div>
          ) : quotes.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="text-sm font-semibold text-gray-500 mt-3">Aucun devis pour le moment</p>
              <p className="text-xs text-gray-400 mt-1">Vos devis apparaîtront ici dès leur création.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/60">
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Projet</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Émission</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => {
                    const key = classifyStatus(q.status);
                    const badge = statusBadge[key];
                    const projectTitle = q.client.company || q.client.name || q.siteAddress || 'Devis';
                    return (
                      <tr key={q.id} className="border-t border-gray-100 hover:bg-gray-50/40 transition-colors">
                        <td className="px-6 py-5 text-sm text-gray-500 font-medium">#{q.reference}</td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-gray-900">{projectTitle}</p>
                          {q.client.email && <p className="text-xs text-gray-500 mt-0.5">{q.client.email}</p>}
                        </td>
                        <td className="px-6 py-5 text-sm text-gray-700">{formatFrenchDate(q.created_at)}</td>
                        <td className="px-6 py-5 text-sm font-bold text-gray-900">{formatCurrency(q.total_ttc)}</td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <Link
                            href={`/client/quotes/${q.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#1D5FE1] hover:bg-[#F0F4FF] transition-colors"
                            title="Voir le devis"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && quotes.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">Affichage de {quotes.length} devis</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-10">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 flex items-center gap-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
            <div className="relative shrink-0">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#1D5FE1] to-[#0E172C] flex items-center justify-center text-white font-bold text-lg">
                {artisanInitials}
              </div>
              <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Votre artisan</p>
              <p className="text-base font-bold text-gray-900 mt-1 truncate">{artisan?.name || 'Votre artisan'}</p>
              <p className="text-xs text-gray-500 truncate">
                {artisan?.email || 'Disponible pour discuter de vos projets.'}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Link href="/client/messages" className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" /> Envoyer un message
                </Link>
                {artisan?.phone && (
                  <a href={`tel:${artisan.phone}`} className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 transition-colors">
                    <Phone className="w-3.5 h-3.5" /> Appeler
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#F0F4FF] border border-[#1D5FE1]/10 rounded-2xl p-6">
            <p className="text-base font-bold text-gray-900">Prêt pour un nouveau projet ?</p>
            <p className="text-xs text-gray-600 mt-1">
              Contactez votre conseiller pour démarrer un nouveau devis personnalisé.
            </p>
            <Link href="/client/messages" className="mt-4 inline-flex items-center gap-2 px-5 py-3 bg-[#1D5FE1] hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-[#1D5FE1]/30 transition-colors">
              <Rocket className="w-4 h-4" /> Lancer une nouvelle demande
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
