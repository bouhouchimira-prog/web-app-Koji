'use client';

import { useClientStore } from '@/store/clientStore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SignatureModal } from '@/components/features/SignatureModal';
import { useState, useEffect, useRef } from 'react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Download, CheckCircle, Printer, FileText, Share2, Clock, Paperclip, X, File as FileIcon, Send, ClipboardList, Circle } from 'lucide-react';
import Image from 'next/image';
import { Textarea } from '@/components/ui/Textarea';
import type { Quote, QuoteLineItem } from '@/types';

interface QuoteDetailViewProps {
  id: string;
  email?: string;
}

// Brand palette (matches the mobile devis screen).
const NAVY = '#0F172A';
const GOLD = '#A18B73';

// Trade/lot accent colours, mirroring the mobile app's _familleColor().
function familleColor(famille: string): string {
  switch (famille.toLowerCase()) {
    case 'carrelage': return '#B45309';
    case 'peinture': return '#7C3AED';
    case 'plomberie': return '#0369A1';
    case 'electricité':
    case 'electricite': return '#D97706';
    case 'menuiserie': return '#166534';
    case 'démolition':
    case 'demolition': return '#B91C1C';
    default: return '#475569';
  }
}

// French label for the canonical room ids, like the mobile _getRoomLabel().
function roomLabel(id: string): string {
  switch (id) {
    case 'salon': return 'Salon';
    case 'cuisine': return 'Cuisine';
    case 'chambre': return 'Chambre';
    case 'salle_de_bain': return 'Salle de bain';
    case 'bureau': return 'Bureau';
    case 'exterieur': return 'Extérieur';
    default:
      if (!id) return 'Pièce';
      return id.charAt(0).toUpperCase() + id.slice(1);
  }
}

// French number, e.g. 1234.5 -> "1 234,50".
function fmtNum(v: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

// Reproduce the mobile line breakdown ("MO : …", "Fnt : …", or "Forfait : …").
function lineBreakdown(item: QuoteLineItem): string[] {
  const parts: string[] = [];
  if (item.forfait) {
    parts.push(`Forfait : ${fmtNum(item.unitPrice)} €`);
    return parts;
  }
  const mo = (item.moUnitPrice ?? 0) * (item.quantity ?? 0);
  const fnt = (item.fournituresUnitPrice ?? 0) * (item.quantity ?? 0);
  if ((item.hours ?? 0) > 0 && (item.effectiveRate ?? 0) > 0) {
    parts.push(`MO : ${fmtNum(item.quantity)} × ${fmtNum(item.hours!)} h × ${fmtNum(item.effectiveRate!)} € = ${fmtNum(mo)} €`);
  } else if (mo > 0) {
    parts.push(`MO : ${fmtNum(mo)} €`);
  }
  if (fnt > 0) {
    parts.push(`Fnt : ${fmtNum(item.quantity)} × ${fmtNum(item.fournituresUnitPrice!)} € = ${fmtNum(fnt)} €`);
  }
  return parts;
}

// `email` (the address baked into the link by koji-main) is used only to
// pre-fill the login field — the devis still opens strictly on the logged-in
// account's email, never on the URL value.
export function QuoteDetailView({ id }: QuoteDetailViewProps) {
  const { quotes, updateQuoteStatus, updateQuoteStartDate, addQuoteMessage, fetchQuote, isLoading, error } = useClientStore();
  const authReady = useClientStore((s) => s.authReady);
  const router = useRouter();

  const quote = quotes.find((q) => q.id === id);

  // Local state for new comment
  const [newComment, setNewComment] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The chantier space has three sections; "devis" is the default.
  const [activeTab, setActiveTab] = useState<'devis' | 'suivi' | 'messages'>('devis');

  // While generating the PDF we force the desktop table layout (html2canvas
  // renders the responsive phone/grid variants poorly — rows came out empty).
  const [pdfMode, setPdfMode] = useState(false);

  // The devis opens ONLY after a successful Identifiant + Mot de passe login,
  // which sets a per-session flag for this quote id. Opening the link without
  // logging in (e.g. someone the client forwarded it to) finds no flag and is
  // sent to /auth/login. So the login screen always gates access — sharing the
  // raw link grants nothing.
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  useEffect(() => {
    if (!id || accessChecked) return;
    let unlocked = false;
    try {
      unlocked = sessionStorage.getItem(`koji_access_${id}`) === '1';
    } catch {
      unlocked = false;
    }
    setHasAccess(unlocked);
    setAccessChecked(true);
    if (unlocked) {
      fetchQuote(id); // id alone authorizes the data once login is proven
    } else {
      router.replace(`/auth/login`);
    }
  }, [id, accessChecked, fetchQuote, router]);

  const handleSign = async (signatureData: string) => {
    if (!quote) return;
    await updateQuoteStatus(quote.id, 'Accepted', signatureData);
    setIsSignModalOpen(false);
  };

  const handleReject = async () => {
    if (!quote) return;
    if (confirm('Êtes-vous sûr de vouloir refuser ce devis ?')) {
      await updateQuoteStatus(quote.id, 'Rejected');
    }
  };

  const handleStartDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!quote) return;
    await updateQuoteStartDate(quote.id, e.target.value);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`Fichier trop volumineux: ${file.name} (Max 10MB)`);
          return false;
        }
        return true;
      });

      if (pendingFiles.length + validFiles.length > 10) {
        alert("Maximum 10 fichiers par message.");
        return;
      }

      setPendingFiles(prev => [...prev, ...validFiles]);
      // Reset input manually
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitComment = async () => {
    if ((!newComment.trim() && pendingFiles.length === 0) || isSending || !quote) return;

    setIsSending(true);
    try {
      await addQuoteMessage(quote.id, newComment, pendingFiles);
      setNewComment('');
      setPendingFiles([]);
    } catch (error) {
      alert("Erreur lors de l'envoi du message.");
    } finally {
      setIsSending(false);
    }
  };
  // Until we've checked the per-session login flag — or while redirecting an
  // unauthenticated visitor to /auth/login, or while the quote loads — show the
  // loader. This prevents the devis (or the error card) from flashing before
  // the login screen takes over.
  if (!accessChecked || !hasAccess || isLoading || !authReady) {
    return <div className="p-8 flex justify-center items-center h-screen text-primary">Chargement du devis...</div>;
  }

  // A quote present in the store + no error means the (login-gated, id-authorized)
  // fetch succeeded — open it.
  const loadedById = quote != null && !error;

  // Access was granted (logged in) but the devis still could not be loaded
  // (bad/expired id, or the backend RPC isn't updated yet).
  if (!loadedById) {
    // The devis could not be opened from this link (bad/expired id, or the
    // backend RPC isn't updated yet). Point the visitor at the per-chantier
    // Identifiant + Mot de passe login rather than an email form.
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 border-none shadow-sm bg-white space-y-5">
          <div className="text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-[#0E172C] flex items-center justify-center mx-auto overflow-hidden">
              <img src="/koji-mark.svg" alt="Koji" className="w-full h-full object-contain p-2.5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Devis introuvable</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Ce lien ne permet pas d&apos;ouvrir le devis. Connectez-vous avec
                l&apos;identifiant et le mot de passe reçus par message.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => router.push('/auth/login')}
            className="w-full h-12 bg-primary hover:bg-primary/90"
          >
            Se connecter avec mon identifiant
          </Button>
        </Card>
      </div>
    );
  }

  const handleDownload = async () => {
    const element = document.getElementById('quote-document');
    if (!element) {
      alert("Erreur: Document non trouvé.");
      return;
    }

    // Force the desktop (table) layout for the capture — the responsive phone
    // variant rendered as empty rows in html2canvas. Wait two frames so React
    // has painted the pdf-mode layout before the snapshot.
    setPdfMode(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      // Dynamic import to avoid SSR issues
      // @ts-ignore
      const module = await import('html2pdf.js');
      const html2pdf = module.default || module;

      const opt: any = {
        margin: [10, 10],
        filename: `Devis-${quote.quoteNumber || quote.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          // Capture at a fixed desktop width so the PDF looks the same from a
          // phone as from a computer.
          windowWidth: 900,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      // html2pdf is a function that returns a worker
      await html2pdf().set(opt).from(element).save();
    } catch (error: any) {
      console.error("PDF generation failed", error);
      alert(`Erreur PDF: ${error?.message || 'Inconnue'}. L'impression s'ouvre.`);
      window.print();
    } finally {
      setPdfMode(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Devis ${quote.id}`,
          text: `Voici le devis pour votre projet ${quote.projectTitle}`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback
      navigator.clipboard.writeText(window.location.href);
      alert("Lien copié dans le presse-papier !");
    }
  };

  // derived state
  const isAccepted = quote.status === 'Accepted' || quote.status === 'accepte';
  const isRejected = quote.status === 'Rejected' || quote.status === 'refuse';
  const canAct = !isAccepted && !isRejected;

  // Entreprise (company) header — real values from the devis, falling back to
  // the Koji defaults when a field is missing (e.g. older devis with no logo).
  const company = quote.company ?? {};
  const companyName = (company.name && company.name.trim()) || 'Koji';
  const companyEmailDisplay =
    (company.email && company.email.trim()) || 'contact@koji.com';
  const companyLogo = (company.logo && company.logo.trim()) || '';

  // Real totals come straight from the generator. We display them as-is instead
  // of recomputing TVA from a single field (which previously double-taxed).
  const totalHT = quote.totalHT ?? quote.total ?? 0;
  const totalTTC = quote.totalTTC ?? quote.total ?? 0;
  const tvaRate = quote.tvaRate ?? 20;
  const tvaAmount = totalTTC - totalHT;

  // Mirror the mobile devis layout: group line items by room, then by famille
  // (lot) inside each room, computing the room subtotal as we go.
  const rooms = quote.items.reduce<
    Record<string, { lines: typeof quote.items; total: number }>
  >((acc, item) => {
    const key = item.room || 'Pièce';
    (acc[key] ||= { lines: [], total: 0 });
    acc[key].lines.push(item);
    acc[key].total += (item.quantity || 0) * (item.unitPrice || 0);
    return acc;
  }, {});

  const roomEntries = Object.entries(rooms).map(([name, { lines, total }]) => {
    const byFamille = lines.reduce<Record<string, typeof quote.items>>((acc, line) => {
      const fam = line.famille && line.famille.trim() ? line.famille : 'Général';
      (acc[fam] ||= []).push(line);
      return acc;
    }, {});
    return { name, total, byFamille };
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* --- Top Header Card (Mobile Style) --- */}
        <Card className="p-6 border-none shadow-sm bg-white overflow-hidden relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none uppercase tracking-wider text-xs font-bold px-2 py-1">
                  {isAccepted ? 'Accepté' : isRejected ? 'Refusé' : 'En attente'}
                </Badge>
                <span className="text-xs font-bold text-accent tracking-wider uppercase">DEVIS N° {quote.quoteNumber || quote.id.substring(0, 8)}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-primary">
                {isAccepted ? 'Devis Accepté' : isRejected ? 'Devis Refusé' : 'Devis prêt'}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Validité : {quote.validUntil && quote.validUntil !== 'N/A' ? quote.validUntil : '30 jours'}
              </p>
            </div>
          </div>
        </Card>

        {/* --- Tabs: Devis · Suivi des travaux · Messages --- */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {([
            ['devis', 'Devis'],
            ['suivi', 'Suivi des travaux'],
            ['messages', 'Messages'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex-1 rounded-lg px-2 sm:px-4 py-2.5 text-xs sm:text-sm leading-tight font-semibold transition-colors ${
                activeTab === key
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ===================== SUIVI DES TRAVAUX ===================== */}
        {activeTab === 'suivi' && (
          <SuiviSection quote={quote} />
        )}

        {/* ===================== MESSAGES ===================== */}
        {activeTab === 'messages' && (
          <MessagesSection
            quote={quote}
            newComment={newComment}
            setNewComment={setNewComment}
            pendingFiles={pendingFiles}
            removeFile={removeFile}
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            handleSubmitComment={handleSubmitComment}
            isSending={isSending}
          />
        )}

        {/* ===================== DEVIS ===================== */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${activeTab === 'devis' ? '' : 'hidden'}`}>

          {/* --- LEFT COLUMN (Document) --- */}
          <div className="md:col-span-2 space-y-6">

            {/* Quote Document Card — mirrors the mobile devis layout */}
            <Card className="relative p-4 sm:p-6 md:p-8 bg-white border-none space-y-6 overflow-hidden" id="quote-document">
              {/* Koji logo watermark in the background */}
              <div className="koji-watermark pointer-events-none absolute inset-0 flex items-center justify-center select-none">
                <img src="/koji-mark.svg" alt="" aria-hidden className="w-2/3 max-w-[420px] opacity-[0.05]" />
              </div>

              {/* Everything sits above the watermark — mirrors the koji-main PDF */}
              <div className="relative z-10 space-y-6">
                {/* Top line: "Le {date}" (left) · Devis n° + Version (right) */}
                <div className="flex justify-between items-start gap-4">
                  <p className="text-[11px] text-muted-foreground">Le {formatDate(quote.issuedDate)}</p>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: NAVY }}>
                      Devis n° : {quote.quoteNumber || quote.id.substring(0, 8).toUpperCase()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Version N° : {quote.version || '01'}</p>
                  </div>
                </div>

                {/* Identity row: company logo LEFT + info ↔ client RIGHT.
                    Stacks vertically on phone so nothing gets squeezed. */}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-4 sm:gap-6">
                  <div className="flex items-start gap-3">
                    {companyLogo ? (
                      <img src={companyLogo} alt={companyName} className="h-12 w-12 rounded-md object-contain shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: NAVY }}>
                        <img src="/koji-mark.svg" alt={companyName} className="h-7 w-7" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-bold text-base" style={{ color: NAVY }}>{companyName}</h3>
                      {company.address && company.address.trim() && (
                        <p className="text-[11px] text-muted-foreground whitespace-pre-line break-words">{company.address}</p>
                      )}
                      {company.phone && company.phone.trim() && (
                        <p className="text-[11px] text-muted-foreground">{company.phone}</p>
                      )}
                      {companyEmailDisplay && (
                        <p className="text-[11px] text-muted-foreground break-words">{companyEmailDisplay}</p>
                      )}
                    </div>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <p className="text-[9px] font-bold tracking-wide" style={{ color: GOLD }}>CLIENT</p>
                    <p className="font-bold text-sm" style={{ color: NAVY }}>{quote.clientName}</p>
                    {quote.clientEmail && <p className="text-[11px] text-muted-foreground break-words">{quote.clientEmail}</p>}
                  </div>
                </div>

                {/* Adresse du chantier */}
                {quote.projectTitle && (
                  <p className="text-xs" style={{ color: NAVY }}>
                    <span className="font-bold" style={{ color: GOLD }}>Adresse du chantier : </span>
                    <span className="font-semibold">{quote.projectTitle}</span>
                  </p>
                )}

                {/* Validité */}
                <p className="text-[11px] text-muted-foreground">
                  Validité du devis : {quote.validUntil && quote.validUntil !== 'N/A' ? quote.validUntil : '30 jours'}
                </p>

                {/* Section heading directly above the table */}
                <h4 className="text-sm font-bold" style={{ color: NAVY }}>Description des travaux</h4>

                {/* Single table header — full columns on ≥sm (and in the PDF),
                    simplified on phone. Flex (not grid): html2canvas renders
                    grid rows empty in the downloaded PDF. */}
                <div className="rounded-t-md overflow-hidden">
                  {/* Desktop / tablet / PDF header */}
                  <div className={`${pdfMode ? 'flex' : 'hidden sm:flex'} px-3 py-2 text-[10px] font-bold text-white`} style={{ backgroundColor: NAVY }}>
                    <span className="w-1/2">DÉSIGNATION</span>
                    <span className="w-[10%] text-center">QTÉ</span>
                    <span className="w-[10%] text-center">UNITÉ</span>
                    <span className="w-[15%] text-center">P.UNIT HT</span>
                    <span className="w-[15%] text-right">TOTAL HT</span>
                  </div>
                  {/* Phone header */}
                  <div className={`${pdfMode ? 'hidden' : 'flex sm:hidden'} justify-between px-3 py-2 text-[10px] font-bold text-white`} style={{ backgroundColor: NAVY }}>
                    <span>DÉSIGNATION</span>
                    <span>TOTAL HT</span>
                  </div>
                </div>

                {/* ONE single table: each pièce (salon…) is a row group, its
                    lines below. No colored bands — just the colored pièce word,
                    matching the koji-main PDF. */}
                <div className="border-x border-b border-[#E2E8F0] rounded-b-md overflow-hidden -mt-6">
                  {roomEntries.map((room) => (
                    <div key={room.name}>
                      {/* Pièce name — colored bold word, no background band */}
                      <div className="px-3 py-2 border-t border-[#F1F5F9]">
                        <span className="text-[13px] font-bold" style={{ color: GOLD }}>{roomLabel(room.name)}</span>
                      </div>
                      {Object.entries(room.byFamille).map(([fam, lines]) =>
                        lines.map((item, idx) => {
                          const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
                          const breakdown = lineBreakdown(item);
                          return (
                            <div key={`${fam}-${idx}`} className="px-3 py-2.5 border-t border-[#F1F5F9]">
                              {/* ≥sm / PDF : aligned table row (flex — PDF-safe) */}
                              <div className={`${pdfMode ? 'flex' : 'hidden sm:flex'} items-start`}>
                                <div className="w-1/2 pr-2">
                                  <span className="text-[12px] font-semibold" style={{ color: NAVY }}>{item.description}</span>
                                  {breakdown.length > 0 && (
                                    <div className="mt-0.5 space-y-0.5">
                                      {breakdown.map((p, i) => (
                                        <p key={i} className="text-[10px]" style={{ color: '#94A3B8' }}>{p}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="w-[10%] text-center text-[11px]" style={{ color: '#64748B' }}>{fmtNum(item.quantity)}</span>
                                <span className="w-[10%] text-center text-[11px]" style={{ color: '#64748B' }}>{item.unit || 'u'}</span>
                                <span className="w-[15%] text-center text-[11px]" style={{ color: '#64748B' }}>{fmtNum(item.unitPrice)} €</span>
                                <span className="w-[15%] text-right text-[12px] font-bold" style={{ color: NAVY }}>{fmtNum(lineTotal)} €</span>
                              </div>

                              {/* phone : stacked card — designation on top, then a
                                  Qté · Unité · PU row, with the total on the right */}
                              <div className={pdfMode ? 'hidden' : 'sm:hidden'}>
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[12px] font-semibold flex-1" style={{ color: NAVY }}>{item.description}</span>
                                  <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: NAVY }}>{fmtNum(lineTotal)} €</span>
                                </div>
                                {breakdown.length > 0 && (
                                  <div className="mt-0.5 space-y-0.5">
                                    {breakdown.map((p, i) => (
                                      <p key={i} className="text-[10px]" style={{ color: '#94A3B8' }}>{p}</p>
                                    ))}
                                  </div>
                                )}
                                <p className="text-[11px] mt-1" style={{ color: '#64748B' }}>
                                  {fmtNum(item.quantity)} {item.unit || 'u'} × {fmtNum(item.unitPrice)} € HT
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ))}
                  {roomEntries.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">Aucune tâche ajoutée.</p>
                  )}
                </div>

                {/* Totals — uses the real values from the generator */}
                <div className="rounded-2xl border border-[#E2E8F0] overflow-hidden">
                  <div className="h-px mx-4 my-2" style={{ backgroundColor: NAVY }} />
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-sm font-bold" style={{ color: NAVY }}>TOTAL DEVIS HT</span>
                    <span className="text-base font-bold" style={{ color: NAVY }}>{fmtNum(totalHT)} €</span>
                  </div>
                  <div className="h-px bg-[#E2E8F0] mx-4" />
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-[13px] text-muted-foreground">TVA {tvaRate}%</span>
                    <span className="text-[13px] font-bold text-muted-foreground">{fmtNum(tvaAmount)} €</span>
                  </div>
                  <div className="m-4 rounded-xl px-4 py-3 flex justify-between items-center" style={{ backgroundColor: NAVY }}>
                    <span className="font-bold text-white">TOTAL TTC</span>
                    <span className="font-black text-2xl" style={{ color: '#EAD8B1' }}>{fmtNum(totalTTC)} €</span>
                  </div>
                  <p className="text-[11px] text-center text-muted-foreground pb-3">Payable à la commande</p>
                </div>

                {/* ── Informations de paiement — same block as the app's devis ── */}
                <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
                  <h4 className="text-sm font-bold" style={{ color: NAVY }}>Informations de paiement</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    <p className="text-[12px] break-words">
                      <span style={{ color: '#2563EB' }}>IBAN : </span>
                      <span style={{ color: NAVY }}>{company.iban && company.iban.trim() ? company.iban : 'À compléter'}</span>
                    </p>
                    <p className="text-[12px]">
                      <span style={{ color: '#2563EB' }}>BIC/SWIFT : </span>
                      <span style={{ color: NAVY }}>{company.bic && company.bic.trim() ? company.bic : 'À compléter'}</span>
                    </p>
                    <p className="text-[12px]">
                      <span style={{ color: '#2563EB' }}>Titulaire du compte : </span>
                      <span style={{ color: NAVY }}>{companyName}</span>
                    </p>
                  </div>
                </div>

                {/* ── Conditions de règlement ── */}
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold" style={{ color: NAVY }}>Conditions de règlement</h4>
                  <p className="text-[12px]">
                    <span style={{ color: '#2563EB' }}>Délai de paiement : </span>
                    <span style={{ color: NAVY }}>30 jours</span>
                  </p>
                  <p className="text-[12px]">
                    <span style={{ color: '#2563EB' }}>Validité du devis : </span>
                    <span style={{ color: NAVY }}>{quote.validUntil && quote.validUntil !== 'N/A' ? quote.validUntil : '30 jours'}</span>
                  </p>
                </div>

                {/* Signature Display */}
                {isAccepted && quote.signature && (
                  <div className="mt-6 pt-6 border-t border-dashed border-[#E2E8F0]">
                    <p className="text-[9px] font-bold tracking-wide uppercase mb-3" style={{ color: GOLD }}>Approbation client</p>
                    <div className="relative h-24 w-full md:w-64 border rounded-xl bg-white overflow-hidden">
                      <Image src={quote.signature} alt="Signature" fill className="object-contain p-4" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Signé le {quote.signedAt ? formatDate(quote.signedAt) : 'Date inconnue'}</p>
                  </div>
                )}

                {/* ── Footer — mirrors the koji-main PDF: "Edited by Koji" +
                    logo LEFT · company legal CENTER · page RIGHT. Stacks and
                    centers on phone. ── */}
                <div className="pt-3 mt-2 border-t border-[#E2E8F0] flex flex-col items-center gap-2 text-center sm:grid sm:grid-cols-3 sm:items-start sm:text-left">
                  {/* Left — Edited by Koji */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Edited by</span>
                    <img src="/koji-mark.svg" alt="" aria-hidden className="h-3 w-3" />
                    <span className="text-[10px] font-bold" style={{ color: GOLD }}>Koji</span>
                  </div>

                  {/* Center — company legal line (name – SAS · Capital · TVA · SIRET) */}
                  <div className="text-center space-y-0.5">
                    <p className="text-[9px] text-muted-foreground">
                      {[
                        company.formeJuridique && company.formeJuridique.trim()
                          ? `${companyName} – ${company.formeJuridique}`
                          : companyName,
                        company.capital && company.capital.trim() ? `Capital : ${company.capital}` : null,
                      ].filter(Boolean).join('  ·  ')}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {[
                        company.tva && company.tva.trim() ? `TVA : ${company.tva}` : null,
                        company.siret && company.siret.trim() ? `SIRET : ${company.siret}` : null,
                      ].filter(Boolean).join('  ·  ')}
                    </p>
                  </div>

                  {/* Right — page indicator (desktop only) */}
                  <p className="hidden sm:block text-[9px] text-muted-foreground text-right">Page 1 / 1</p>
                </div>
              </div>{/* /relative z-10 */}
            </Card>
            {/* Discussion moved to the "Messages" tab (see MessagesSection). */}
          </div>

          {/* --- RIGHT COLUMN (Actions & Info) --- */}
          <div className="flex flex-col gap-6 mobile-actions-order">

            {/* 1. PDF actions — compact card (the old big white preview
                placeholder above these buttons was removed). */}
            <Card className="p-4 border bg-white shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center shrink-0 border border-red-100">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-primary truncate text-sm">Devis-{quote.quoteNumber || quote.id.substring(0, 8)}.pdf</p>
                  <p className="text-xs text-muted-foreground">Document PDF</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="w-full text-xs" onClick={handleShare}>
                  <Share2 className="mr-2 h-3 w-3" /> Partager
                </Button>
                <Button variant="secondary" className="w-full text-xs" onClick={handleDownload}>
                  <Download className="mr-2 h-3 w-3" /> Télécharger
                </Button>
              </div>
            </Card>

            {/* 2. Primary Actions */}
            {canAct && (
              <Card className="p-6 bg-white border-none shadow-sm space-y-4">
                <h3 className="font-bold text-lg text-primary">Actions</h3>
                <div className="space-y-3">
                  <Button
                    onClick={() => setIsSignModalOpen(true)}
                    className="w-full h-14 text-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    Accepter & Signer
                  </Button>
                  <Button
                    onClick={handleReject}
                    variant="outline"
                    className="w-full h-12 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                  >
                    Refuser le devis
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimer
                </Button>
              </Card>
            )}

            {isAccepted && (
              <Card className="p-6 bg-green-50 border border-green-100 text-center space-y-4">
                <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-green-800">Devis Signé</h3>
                  <p className="text-sm text-green-700 mt-1">Merci pour votre confiance.</p>
                </div>
              </Card>
            )}

            {/* 3. Date Picker (If needed) */}
            <Card className="p-6 bg-white border-none shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                <h3 className="font-bold text-primary">Date souhaitée</h3>
              </div>
              <div className="space-y-2">
                <input
                  type="date"
                  className="w-full h-12 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-sans"
                  style={{ colorScheme: 'light' }}
                  value={quote.startDate || ''}
                  onChange={handleStartDateChange}
                />
                <p className="text-xs text-muted-foreground">Date indicative de début de chantier.</p>
              </div>
            </Card>

          </div>
        </div>

        <SignatureModal
          open={isSignModalOpen}
          onClose={() => setIsSignModalOpen(false)}
          onConfirm={handleSign}
        />
      </div>

      {/* Mobile-order styling adjustment via CSS if needed, but Grid order handles it mostly. 
          For true mobile reordering where Actions comes first, we can use flex-col-reverse or 'order' utilities.
      */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-actions-order {
            order: -1;
          }
        }
      `}</style>
    </div>
  );
}

// ── Suivi des travaux ────────────────────────────────────────────────────────
// The works to follow for this chantier = the devis tasks (quote.items),
// grouped by room. These are the prestations the artisan will carry out.
function SuiviSection({ quote }: { quote: Quote }) {
  const rooms = (quote.items ?? []).reduce<Record<string, QuoteLineItem[]>>(
    (acc, item) => {
      const room = item.room || 'Travaux';
      (acc[room] = acc[room] || []).push(item);
      return acc;
    },
    {}
  );
  const roomNames = Object.keys(rooms);
  const total = quote.items?.length ?? 0;

  return (
    <div className="space-y-5">
      <Card className="p-6 border-none shadow-sm bg-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#F0F4FF] text-[#1D5FE1] flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Suivi des travaux</h3>
            <p className="text-xs text-gray-500">{total} prestation{total > 1 ? 's' : ''} prévue{total > 1 ? 's' : ''}</p>
          </div>
        </div>
      </Card>

      {roomNames.length === 0 ? (
        <Card className="p-10 border-none shadow-sm bg-white text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm font-semibold text-gray-500 mt-3">Aucune tâche pour le moment</p>
          <p className="text-xs text-gray-400 mt-1">Le suivi apparaîtra ici dès que votre artisan l&apos;aura démarré.</p>
        </Card>
      ) : (
        roomNames.map((room) => (
          <Card key={room} className="p-6 border-none shadow-sm bg-white">
            <h4 className="text-sm font-bold text-primary mb-3">{room}</h4>
            <div className="divide-y divide-gray-50">
              {rooms[room].map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-3">
                  <Circle className="w-5 h-5 text-[#1D5FE1] shrink-0" />
                  <span className="text-sm flex-1 text-gray-900">{t.description}</span>
                  {t.quantity ? (
                    <span className="text-xs text-gray-400 shrink-0">
                      {t.quantity}{t.unit ? ` ${t.unit}` : ''}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ── Messages (Discussion) ────────────────────────────────────────────────────
function MessagesSection({
  quote,
  newComment,
  setNewComment,
  pendingFiles,
  removeFile,
  fileInputRef,
  handleFileSelect,
  handleSubmitComment,
  isSending,
}: {
  quote: Quote;
  newComment: string;
  setNewComment: (v: string) => void;
  pendingFiles: File[];
  removeFile: (i: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmitComment: () => void;
  isSending: boolean;
}) {
  return (
    <Card className="p-6 border-none shadow-sm space-y-6 bg-white">
      <h3 className="font-bold text-lg text-primary">Discussion avec votre artisan</h3>
      <div className="space-y-6">
        {(quote.comments ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun message pour le moment. Écrivez à votre artisan ci-dessous.</p>
        )}
        {quote.comments?.map((comment) => (
          <div key={comment.id} className="flex gap-4">
            <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
              {comment.author.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-primary">{comment.author}</span>
                <span className="text-xs text-muted-foreground">{formatDate(comment.date)}</span>
              </div>
              <div className="bg-background p-3 rounded-lg text-sm text-primary/80">
                {comment.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-4">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 px-1">
            {pendingFiles.map((file, idx) => (
              <div key={idx} className="relative group bg-gray-50 border border-gray-200 rounded-lg p-2 flex items-center gap-2 pr-6">
                {file.type.startsWith('image/') ? (
                  <div className="h-8 w-8 relative rounded overflow-hidden flex-shrink-0">
                    <img src={URL.createObjectURL(file)} alt="preview" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <FileIcon className="h-5 w-5 text-gray-400" />
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[100px]">{file.name}</span>
                  <span className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Textarea
              placeholder="Écrire un message..."
              className="min-h-[80px] bg-background border-border focus:border-accent pr-10"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isSending}
            />
            <input
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              className="absolute bottom-2 right-2 p-2 rounded-full text-gray-400 hover:text-accent hover:bg-gray-100 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              title="Ajouter un fichier"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          </div>

          <Button
            size="icon"
            className="h-[80px] w-[80px] shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-50"
            onClick={handleSubmitComment}
            disabled={isSending || (!newComment.trim() && pendingFiles.length === 0)}
            title="Envoyer"
            aria-label="Envoyer"
          >
            {isSending ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
