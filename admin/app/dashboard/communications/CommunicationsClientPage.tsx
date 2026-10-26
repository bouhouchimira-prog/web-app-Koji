'use client'

import { useState } from 'react'
import { Sparkles, CheckCircle2, Bell, Megaphone, Loader2 } from 'lucide-react'

export type EmailSendRow = {
  id: string
  subject: string
  recipients_count: number
  segment: string | null
  sent_at: string
}

const TEMPLATES = [
  { icon: Sparkles, title: 'E-mail de bienvenue', desc: "Envoyé après l'inscription d'un nouvel utilisateur.", status: 'Actif' },
  { icon: CheckCircle2, title: 'Devis signé', desc: 'Confirmation envoyée à l’artisan et au client.', status: 'Actif' },
  { icon: Bell, title: 'Notifications', desc: 'Alertes sur les devis, messages et relances.', status: 'Brouillon' },
]

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'hier' : `il y a ${days} j`
}

export default function CommunicationsClientPage({ totalUsers, proUsers, history }: { totalUsers: number; proUsers: number; history: EmailSendRow[] }) {
  const [segment, setSegment] = useState<'all' | 'pro' | 'standard' | 'custom'>('all')
  const [customEmails, setCustomEmails] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const recipientCount = segment === 'all' ? totalUsers : segment === 'pro' ? proUsers : segment === 'standard' ? totalUsers - proUsers : customEmails.split(',').map((e) => e.trim()).filter(Boolean).length

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      setFeedback({ type: 'error', text: "L'objet et le message sont requis." })
      return
    }
    setSending(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment,
          customEmails: segment === 'custom' ? customEmails.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
          subject,
          message
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi")
      setFeedback({ type: 'ok', text: `Envoyé à ${data.sentCount} destinataire(s).` })
      setSubject('')
      setMessage('')
    } catch (err) {
      setFeedback({ type: 'error', text: (err as Error).message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Communications</h1>
        <p className="text-[14px] text-gray-500 mt-1">Gérez les e-mails automatiques et les envois ciblés.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {TEMPLATES.map((tpl) => (
          <div key={tpl.title} className="bg-white border border-[#EDEDF3] rounded-[18px] p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-[11px] bg-[#EDEFFB] flex items-center justify-center">
                <tpl.icon className="w-[19px] h-[19px] text-[#16233F]" strokeWidth={1.8} />
              </div>
              <span className={`text-[12px] font-bold px-3 py-1 rounded-xl whitespace-nowrap ${tpl.status === 'Actif' ? 'bg-[#E6F5EE] text-[#1E8E5A]' : 'bg-[#F0F1F5] text-gray-500'}`}>
                {tpl.status}
              </span>
            </div>
            <div className="text-[16px] font-extrabold text-[#16233F]">{tpl.title}</div>
            <div className="text-[13.5px] text-gray-500 leading-relaxed min-h-[40px]">{tpl.desc}</div>
            <div className="flex items-center justify-between pt-2.5 border-t border-[#F1F2F6]">
              <span className="text-[12.5px] text-gray-400">Modèle système</span>
              <span className="text-[13.5px] font-bold text-gray-400">Bientôt</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-5 items-start">
        <div className="flex-[1.7] min-w-0 bg-white border border-[#EDEDF3] rounded-[18px] p-6 flex flex-col gap-4">
          <span className="text-[16px] font-extrabold text-[#16233F]">Envoi manuel et ciblé</span>

          {feedback && (
            <p className={`text-[13px] font-semibold rounded-lg px-3 py-2 ${feedback.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {feedback.text}
            </p>
          )}

          <div className="flex gap-3.5">
            <label className="flex-1 min-w-0 flex flex-col gap-1.5">
              <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Destinataires</span>
              <select value={segment} onChange={(e) => setSegment(e.target.value as any)} className="h-[46px] rounded-xl border border-[#E5E5EC] bg-[#FBFBFD] px-3.5 text-[14.5px] outline-none">
                <option value="all">Tous les utilisateurs</option>
                <option value="pro">Entreprises Pro</option>
                <option value="standard">Comptes Standard</option>
                <option value="custom">E-mails personnalisés</option>
              </select>
            </label>
            <label className="flex-1 min-w-0 flex flex-col gap-1.5">
              <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Objet</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-[46px] rounded-xl border border-[#E5E5EC] bg-[#FBFBFD] px-3.5 text-[14.5px] outline-none" placeholder="L'objet de votre message…" />
            </label>
          </div>

          {segment === 'custom' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">E-mails (séparés par une virgule)</span>
              <input value={customEmails} onChange={(e) => setCustomEmails(e.target.value)} className="h-[46px] rounded-xl border border-[#E5E5EC] bg-[#FBFBFD] px-3.5 text-[14.5px] outline-none" placeholder="jean@exemple.fr, marie@exemple.fr" />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="h-[150px] rounded-xl border border-[#E5E5EC] bg-[#FBFBFD] p-3.5 text-[14px] outline-none resize-none" placeholder="Écrivez votre message ici…" />
          </label>

          <div className="flex items-center gap-3.5">
            <span className="flex-1 text-[13.5px] text-gray-500">{recipientCount} destinataire{recipientCount !== 1 ? 's' : ''} sélectionné{recipientCount !== 1 ? 's' : ''}</span>
            <button onClick={handleSend} disabled={sending} className="h-11 px-5 rounded-xl bg-[#16233F] text-white text-[14px] font-bold disabled:opacity-60 flex items-center gap-2">
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              Envoyer maintenant
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <div className="bg-white border border-[#EDEDF3] rounded-[18px] p-6 flex flex-col gap-3">
            <span className="text-[16px] font-extrabold text-[#16233F]">Segments rapides</span>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F6F7FB]">
              <div className="w-[38px] h-[38px] rounded-[11px] bg-[#EDEFFB] flex items-center justify-center shrink-0"><Megaphone className="w-[19px] h-[19px] text-[#16233F]" strokeWidth={1.8} /></div>
              <div className="min-w-0"><div className="text-[14px] font-bold text-[#1E2430] truncate">Tous les utilisateurs</div><div className="text-[12.5px] text-gray-500 mt-0.5 truncate">{totalUsers} membres</div></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F6F7FB]">
              <div className="w-[38px] h-[38px] rounded-[11px] bg-[#EDEFFB] flex items-center justify-center shrink-0"><Sparkles className="w-[19px] h-[19px] text-[#16233F]" strokeWidth={1.8} /></div>
              <div className="min-w-0"><div className="text-[14px] font-bold text-[#1E2430] truncate">Entreprises Pro</div><div className="text-[12.5px] text-gray-500 mt-0.5 truncate">{proUsers} membres</div></div>
            </div>
          </div>

          <div className="bg-white border border-[#EDEDF3] rounded-[18px] p-6 flex flex-col gap-1">
            <span className="text-[16px] font-extrabold text-[#16233F] mb-2">Historique récent</span>
            {history.length === 0 ? (
              <p className="text-[13.5px] text-gray-400 py-2">Aucun envoi pour l'instant.</p>
            ) : history.map((item, idx) => (
              <div key={item.id} className={`flex items-center gap-3 py-2.5 ${idx < history.length - 1 ? 'border-b border-[#F4F4F8]' : ''}`}>
                <span className="w-[9px] h-[9px] rounded-full shrink-0 bg-[#1E8E5A]" />
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-[#1E2430] truncate">{item.subject}</div>
                  <div className="text-[12.5px] text-gray-500 mt-0.5 truncate">Envoyé {timeAgo(item.sent_at)} · {item.recipients_count} destinataire{item.recipients_count !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
