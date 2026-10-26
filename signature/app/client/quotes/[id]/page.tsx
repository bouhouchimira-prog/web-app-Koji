'use client';

import { useState, use, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, History, Send, Link2, Plus, Lightbulb, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { SignatureModal } from '@/components/features/SignatureModal';
import { SuccessModal } from '@/components/features/SuccessModal';
import { useClientStore } from '@/store/clientStore';
import {
  fetchQuoteById,
  fetchSignatureForQuote,
  submitSignature,
  classifyStatus,
  type QuoteRecord,
} from '@/lib/quotesRepository';
import { formatCurrency } from '@/lib/utils';

function formatDateTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useClientStore((s) => s.user);

  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [signOpen, setSignOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, sig] = await Promise.all([fetchQuoteById(id), fetchSignatureForQuote(id)]);
      if (!q) {
        setError('Devis introuvable');
      } else {
        setQuote(q);
        setSignatureUrl(sig);
        setError(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSign = async (signatureData: string) => {
    if (!user || !quote) return;
    setSubmitting(true);
    try {
      const url = await submitSignature({
        quoteId: quote.id,
        userId: user.id,
        clientName: user.name,
        signatureDataUrl: signatureData.startsWith('data:') ? signatureData : await textToImageDataUrl(signatureData),
      });
      setSignatureUrl(url);
      setQuote({ ...quote, status: 'signed' });
      setSignOpen(false);
      setSuccessOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de la signature';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Tableau de Bord" />
        <div className="flex-1 flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex flex-col">
        <Header title="Tableau de Bord" />
        <div className="px-10 py-16 text-center">
          <p className="text-red-500 font-semibold">{error || 'Devis introuvable'}</p>
          <Link href="/client" className="inline-block mt-4 text-sm text-[#1D5FE1] hover:underline">← Retour au tableau de bord</Link>
        </div>
      </div>
    );
  }

  const statusKey = classifyStatus(quote.status);
  const isSigned = statusKey === 'signed';
  const projectTitle = quote.client.company || quote.client.name || quote.siteAddress || `Devis ${quote.reference}`;
  const ttc = quote.total_ttc || 0;
  const ht = quote.total_ht || 0;

  return (
    <div className="flex flex-col">
      <Header title="Tableau de Bord" subtitle={`Bon retour${user?.name ? ', ' + user.name.split(' ')[0] : ''}.`} />

      <div className="px-10 py-6 pb-12">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/client" className="text-gray-400 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h2 className="text-2xl font-bold text-gray-900">Détail du Devis #{quote.reference}</h2>
            </div>
            <div className="flex items-center gap-4 mt-3 ml-8">
              {isSigned ? (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Signé
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#F0F4FF] text-[#1D5FE1] text-xs font-bold rounded-full">
                  <Clock className="w-3 h-3" /> En attente de signature
                </span>
              )}
              <span className="text-xs text-gray-500">Modifié le {formatDateTime(quote.updated_at)}</span>
            </div>
          </div>
          {!isSigned && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSignOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1D5FE1] hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-[#1D5FE1]/30 transition-colors"
              >
                <Pencil className="w-4 h-4" /> Signer le Devis
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="bg-gray-50/40 border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Prévisualisation du document</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-10 max-w-3xl mx-auto">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-extrabold text-[#1D5FE1] tracking-tight">{(quote.company.name || 'KOJI').toUpperCase()}</p>
                  {quote.company.address && (
                    <p className="text-[10px] text-gray-400 mt-2 leading-relaxed whitespace-pre-line">{quote.company.address}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">DEVIS</p>
                  <p className="text-xs text-gray-500 mt-1">N° {quote.reference}</p>
                  {quote.date && <p className="text-xs text-gray-500">Date : {quote.date}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mt-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Émetteur</p>
                  <p className="text-sm font-bold text-gray-900 mt-2">{quote.company.name || 'Koji'}</p>
                  {quote.company.email && <p className="text-xs text-gray-500 mt-0.5">{quote.company.email}</p>}
                  {quote.company.phone && <p className="text-xs text-gray-500">{quote.company.phone}</p>}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Client</p>
                  <p className="text-sm font-bold text-gray-900 mt-2">{quote.client.company || quote.client.name || '—'}</p>
                  {quote.client.name && quote.client.company && <p className="text-xs text-gray-500 mt-0.5">{quote.client.name}</p>}
                  {quote.client.email && <p className="text-xs text-gray-500">{quote.client.email}</p>}
                  {quote.client.address && <p className="text-xs text-gray-500">{quote.client.address}</p>}
                </div>
              </div>

              {quote.rooms && quote.rooms.length > 0 ? (
                <div className="mt-10 border-t border-gray-100">
                  <div className="grid grid-cols-[1fr_80px_120px_120px] py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                    <span>Description</span>
                    <span className="text-right">Quantité</span>
                    <span className="text-right">Prix Unit.</span>
                    <span className="text-right">Total</span>
                  </div>
                  {quote.rooms.flatMap((r) => r.tasks.map((t) => ({ ...t, room: r.name }))).map((t) => (
                    <div key={t.id} className="grid grid-cols-[1fr_80px_120px_120px] py-4 text-sm text-gray-700 border-b border-gray-50">
                      <span>
                        <span className="block">{t.label}</span>
                        <span className="text-xs text-gray-400">{t.room}</span>
                      </span>
                      <span className="text-right">1</span>
                      <span className="text-right">{formatCurrency(Number(t.unit_price_ht || 0))}</span>
                      <span className="text-right font-semibold">{formatCurrency(Number(t.total_price_ht || t.unit_price_ht || 0))}</span>
                    </div>
                  ))}
                  <div className="flex justify-end gap-12 py-4 text-sm text-gray-700">
                    <span className="font-bold text-gray-900">Sous-total HT</span>
                    <span className="font-bold text-gray-900">{formatCurrency(ht)}</span>
                  </div>
                  <div className="flex justify-end gap-12 py-2 text-sm text-gray-700">
                    <span>TVA ({quote.tva_rate}%)</span>
                    <span>{formatCurrency(ttc - ht)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-10 py-8 text-center text-sm text-gray-400 border-t border-gray-100">
                  Aucun détail de ligne disponible.
                </div>
              )}

              <div className="flex justify-end items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                <p className="text-base font-bold text-gray-900">Total TTC</p>
                <p className="text-2xl font-extrabold text-[#1D5FE1]">{formatCurrency(ttc)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-12">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex items-center justify-center h-32">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Signature Émetteur</p>
                </div>
                {signatureUrl ? (
                  <div className="border-2 border-emerald-300 rounded-lg p-2 flex flex-col items-center justify-center h-32 bg-emerald-50/30">
                    <img src={signatureUrl} alt="Signature client" className="max-h-20 object-contain" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mt-1">Signé</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setSignOpen(true)}
                    className="relative border-2 border-dashed border-[#1D5FE1] rounded-lg p-6 flex flex-col items-center justify-center h-32 bg-[#F0F4FF]/40 hover:bg-[#F0F4FF] transition-colors group"
                  >
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#0E172C] text-white text-[9px] font-bold uppercase tracking-wider rounded">
                      Signer ici
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#1D5FE1]">Signature Client</p>
                    <Pencil className="w-4 h-4 text-[#1D5FE1] mt-2 group-hover:scale-110 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <p className="text-sm font-bold text-gray-900 mb-4">Informations Rapides</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Client</span>
                  <span className="font-semibold text-gray-900 truncate ml-2">{quote.client.company || quote.client.name || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Montant</span>
                  <span className="font-bold text-[#1D5FE1]">{formatCurrency(ttc)}</span>
                </div>
                {quote.client.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Signataire</span>
                    <span className="font-semibold text-[#1D5FE1] truncate ml-2">{quote.client.name}</span>
                  </div>
                )}
                {quote.validity && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Validité</span>
                    <span className="font-semibold text-gray-900">{quote.validity}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-900">Historique des actions</p>
                <History className="w-4 h-4 text-gray-400" />
              </div>
              <div className="space-y-4 relative">
                <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-gray-100" />
                {[
                  ...(isSigned ? [{ icon: CheckCircle2, title: 'Devis signé', date: formatDateTime(quote.updated_at), filled: true }] : []),
                  { icon: Send, title: 'Envoyé pour signature', date: formatDateTime(quote.updated_at), filled: !isSigned },
                  { icon: Link2, title: 'Champs configurés', date: formatDateTime(quote.created_at), filled: false },
                  { icon: Plus, title: 'Devis créé', date: formatDateTime(quote.created_at), filled: false },
                ].map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 relative">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        step.filled ? 'bg-[#1D5FE1] text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-semibold text-gray-900 leading-tight">{step.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{step.date}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!isSigned && (
              <div className="bg-gradient-to-br from-[#1D5FE1] to-[#0E172C] rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-white/5" />
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/70">
                  <Lightbulb className="w-3.5 h-3.5" /> Astuce Pro
                </div>
                <p className="text-sm mt-3">
                  Signez ce devis dès maintenant pour démarrer votre projet plus rapidement.
                </p>
                <button
                  onClick={() => setSignOpen(true)}
                  className="mt-4 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-lg text-xs font-bold transition-colors"
                >
                  Signer maintenant
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <SignatureModal open={signOpen} onClose={() => setSignOpen(false)} onConfirm={handleSign} submitting={submitting} />
      <SuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} clientName={user?.name || quote.client.name || 'Client'} />
    </div>
  );
}

async function textToImageDataUrl(text: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0E172C';
  ctx.font = 'italic 48px serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL('image/png');
}
