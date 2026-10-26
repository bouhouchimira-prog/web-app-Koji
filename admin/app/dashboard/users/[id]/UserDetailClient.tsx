'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Loader2, ChevronRight, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase'

type User = {
  id: string
  email: string
  profession: string | null
  is_pro: boolean | null
  business_info: { companyName?: string; siret?: string } | null
  created_at: string
}

type Quote = {
  id: string
  client_name: string | null
  total_amount: number | null
  status: string | null
  created_at: string
  signed_at: string | null
}

export default function UserDetailClient({ user, quotes }: { user: User; quotes: Quote[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [profession, setProfession] = useState(user.profession || '')
  const [isPro, setIsPro] = useState(!!user.is_pro)

  const handleSave = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.from('users').update({ profession: profession || null, is_pro: isPro }).eq('id', user.id)
      if (error) throw error
      router.refresh()
    } catch (err) {
      alert(`Erreur lors de l'enregistrement : ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/dashboard/users" className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#EDEDF3] text-gray-500 hover:text-[#16233F] transition-colors shadow-sm">
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </Link>
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Utilisateurs</h1>
      </div>

      <div className="flex items-center gap-4 mt-6">
        <div className="w-16 h-16 rounded-full bg-[#EDEFFB] text-[#16233F] text-[20px] font-extrabold flex items-center justify-center shrink-0">
          {user.email.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-[24px] font-bold text-[#0E172C] font-outfit leading-none">{user.email}</h2>
          <p className="text-[13px] text-gray-500 mt-1.5">
            Inscrit le {new Date(user.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <div className="bg-white rounded-[1.5rem] p-8 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-5">
            <h3 className="font-bold text-[15px] text-[#0E172C] tracking-tight">Informations</h3>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 tracking-widest uppercase mb-1.5">Profession</label>
                <input value={profession} onChange={e => setProfession(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F]" placeholder="ex. Peintre" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 tracking-widest uppercase mb-1.5">Statut</label>
                <select value={isPro ? 'pro' : 'standard'} onChange={e => setIsPro(e.target.value === 'pro')} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F]">
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
            </div>
            {user.business_info?.companyName && (
              <div className="pt-2 border-t border-gray-50">
                <label className="block text-[11px] font-bold text-gray-500 tracking-widest uppercase mb-1.5">Entreprise</label>
                <p className="text-[14px] font-bold text-[#0E172C]">{user.business_info.companyName}</p>
                {user.business_info.siret && <p className="text-[12.5px] text-gray-500 mt-0.5">SIRET {user.business_info.siret}</p>}
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <button onClick={handleSave} disabled={loading} className="bg-[#16233F] hover:bg-[#0D1830] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-[#16233F]/20 disabled:opacity-70 transition-all flex items-center gap-2 text-[14px]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-[17px] text-[#0E172C] mb-5 px-1">Devis ({quotes.length})</h3>
            <div className="bg-white border border-gray-100 rounded-[1.2rem] overflow-hidden">
              {quotes.length === 0 ? (
                <p className="px-6 py-10 text-center text-gray-500 text-[14px]">Aucun devis pour cet utilisateur.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {quotes.map((q) => (
                    <Link key={q.id} href={`/dashboard/quotes/${q.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#F0F4FF] flex items-center justify-center text-[#16233F]"><FileText className="w-4 h-4" /></div>
                        <div>
                          <p className="text-[14px] font-bold text-[#0E172C]">{q.client_name || 'Client sans nom'}</p>
                          <p className="text-[12px] text-gray-400 mt-0.5">{new Date(q.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[14px] font-bold text-[#16233F]">{Number(q.total_amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
