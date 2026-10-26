'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Send, Paperclip, Loader2, FileText, ChevronLeft, X } from 'lucide-react';
import { useClientStore } from '@/store/clientStore';
import { fetchClientQuotesByEmail, type QuoteRecord } from '@/lib/quotesRepository';

interface Attachment {
  id: string;
  original_name?: string;
  mime_type?: string;
  signedUrl?: string | null;
}

interface ApiMessage {
  id: string;
  text: string;
  author_name?: string;
  author_email?: string;
  created_at: string;
  attachments?: Attachment[];
}

function formatTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function MessagesPage() {
  const user = useClientStore((s) => s.user);
  const authReady = useClientStore((s) => s.authReady);

  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [activeQuote, setActiveQuote] = useState<QuoteRecord | null>(null);

  // Load the client's devis (one conversation per devis).
  useEffect(() => {
    if (!authReady || !user?.email) return;
    let cancelled = false;
    setLoadingQuotes(true);
    fetchClientQuotesByEmail(user.email)
      .then((data) => { if (!cancelled) setQuotes(data); })
      .catch(() => { if (!cancelled) setQuotes([]); })
      .finally(() => { if (!cancelled) setLoadingQuotes(false); });
    return () => { cancelled = true; };
  }, [authReady, user?.email]);

  return (
    <div className="flex flex-col h-screen">
      <Header title="Messages" subtitle="Échangez avec votre artisan, devis par devis." />

      <div className="flex-1 flex min-h-0 px-10 pb-6 gap-6">
        {/* Conversation list */}
        <aside
          className={`${activeQuote ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 shrink-0 bg-white border border-gray-100 rounded-2xl overflow-hidden`}
        >
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Vos devis</p>
            <p className="text-xs text-gray-500">Sélectionnez une conversation</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingQuotes ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : quotes.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <FileText className="w-9 h-9 text-gray-300 mx-auto" />
                <p className="text-sm font-semibold text-gray-500 mt-3">Aucun devis</p>
                <p className="text-xs text-gray-400 mt-1">Vos conversations apparaîtront ici.</p>
              </div>
            ) : (
              quotes.map((q) => {
                const active = activeQuote?.id === q.id;
                const artisan = q.company?.name || 'Votre artisan';
                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveQuote(q)}
                    className={`w-full text-left px-5 py-4 border-b border-gray-50 transition-colors ${
                      active ? 'bg-[#F0F4FF]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-bold text-gray-900 truncate">{artisan}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">Devis #{q.reference}</p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className="flex-1 flex flex-col bg-gray-50/50 border border-gray-100 rounded-2xl overflow-hidden min-h-0">
          {activeQuote ? (
            <Thread
              quote={activeQuote}
              clientName={user?.name || 'Client'}
              clientEmail={user?.email || ''}
              onBack={() => setActiveQuote(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="h-14 w-14 rounded-2xl bg-[#F0F4FF] flex items-center justify-center text-[#1D5FE1] mb-4">
                <Send className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-gray-900">Sélectionnez un devis</p>
              <p className="text-sm text-gray-500 mt-1 max-w-xs">
                Choisissez une conversation à gauche pour échanger avec votre artisan.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Thread({
  quote,
  clientName,
  clientEmail,
  onBack,
}: {
  quote: QuoteRecord;
  clientName: string;
  clientEmail: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const artisan = quote.company?.name || 'Votre artisan';
  const artisanInitials = artisan
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'A';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/messages`);
      if (res.ok) {
        setMessages(await res.json());
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [quote.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const isMine = (m: ApiMessage) =>
    (m.author_email || '').trim().toLowerCase() === clientEmail.trim().toLowerCase();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if ((!text && files.length === 0) || sending) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('authorName', clientName);
      formData.append('authorEmail', clientEmail);
      files.forEach((f) => formData.append('files', f));

      const res = await fetch(`/api/quotes/${quote.id}/messages`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('send failed');

      setInput('');
      setFiles([]);
      await load();
    } catch {
      // Keep the typed text so the user can retry.
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Retour"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#1D5FE1] to-[#0E172C] flex items-center justify-center text-white font-bold text-sm">
            {artisanInitials}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{artisan}</p>
            <p className="text-xs text-gray-500">Devis #{quote.reference}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-semibold text-gray-500">Aucun message</p>
            <p className="text-xs text-gray-400 mt-1">Posez une question à votre artisan.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = isMine(m);
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-md px-4 py-3 rounded-2xl ${
                    mine
                      ? 'bg-[#1D5FE1] text-white rounded-br-md shadow-md shadow-[#1D5FE1]/20'
                      : 'bg-white text-gray-900 border border-gray-100 rounded-bl-md'
                  }`}
                >
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                      mine ? 'text-white/70' : 'text-gray-400'
                    }`}
                  >
                    {mine ? 'Vous' : m.author_name || artisan}
                  </p>
                  {m.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>}
                  {(m.attachments || []).map((att) => (
                    <a
                      key={att.id}
                      href={att.signedUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-2 flex items-center gap-2 text-xs font-medium underline ${
                        mine ? 'text-white/90' : 'text-[#1D5FE1]'
                      }`}
                    >
                      <Paperclip className="w-3 h-3" /> {att.original_name || 'Pièce jointe'}
                    </a>
                  ))}
                  <p className={`text-[10px] mt-2 ${mine ? 'text-white/60' : 'text-gray-400'}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pending files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pt-3 bg-white border-t border-gray-100">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-700"
            >
              <Paperclip className="w-3 h-3" />
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-gray-700"
                aria-label="Retirer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-3 px-6 py-4 bg-white border-t border-gray-100"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) setFiles((prev) => [...prev, ...picked]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="h-10 w-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-50 transition-colors"
          aria-label="Joindre un fichier"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tapez votre message..."
          className="flex-1 px-4 py-3 bg-gray-50 border border-transparent rounded-full text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#1D5FE1]/30 focus:ring-2 focus:ring-[#1D5FE1]/10 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={sending || (!input.trim() && files.length === 0)}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-[#1D5FE1] hover:bg-blue-700 disabled:opacity-40 text-white shadow-lg shadow-[#1D5FE1]/30 transition-all"
          aria-label="Envoyer"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </>
  );
}
