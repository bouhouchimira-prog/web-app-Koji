'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

export type UserRow = {
  id: string
  email: string
  profession: string | null
  is_pro: boolean | null
  business_info: { companyName?: string; siret?: string } | null
  created_at: string
}

function initials(user: UserRow) {
  return user.email.slice(0, 2).toUpperCase()
}

// Refonte (25 oct) : `first_name`/`last_name` n'existent pas dans la table
// `users` (toujours undefined, repli silencieux sur l'email) — retire
// cette tentative, affiche directement l'email.
export default function UsersClientPage({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [filter, setFilter] = useState<'all' | 'pro' | 'standard'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const [formData, setFormData] = useState({ email: '', password: '', profession: '', is_pro: false })

  const proCount = users.filter((u) => u.is_pro).length
  const filteredUsers = users.filter((u) => {
    if (filter === 'pro') return !!u.is_pro
    if (filter === 'standard') return !u.is_pro
    return true
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création')
      setUsers([data.user, ...users])
      setIsModalOpen(false)
      setFormData({ email: '', password: '', profession: '', is_pro: false })
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Utilisateurs</h1>
          <p className="text-[14px] text-gray-500 mt-1">{users.length} comptes, dont {proCount} professionnels.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="h-11 px-5 rounded-xl bg-[#16233F] text-white text-[14px] font-bold">+ Ajouter un utilisateur</button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`text-[13px] font-semibold px-3.5 py-2.5 rounded-full border transition-colors ${filter === 'all' ? 'bg-[#16233F] text-white border-[#16233F]' : 'bg-white text-gray-500 border-[#EDEDF3]'}`}
        >
          Tous · {users.length}
        </button>
        <button
          onClick={() => setFilter('pro')}
          className={`text-[13px] font-semibold px-3.5 py-2.5 rounded-full border transition-colors ${filter === 'pro' ? 'bg-[#16233F] text-white border-[#16233F]' : 'bg-white text-gray-500 border-[#EDEDF3]'}`}
        >
          Pro · {proCount}
        </button>
        <button
          onClick={() => setFilter('standard')}
          className={`text-[13px] font-semibold px-3.5 py-2.5 rounded-full border transition-colors ${filter === 'standard' ? 'bg-[#16233F] text-white border-[#16233F]' : 'bg-white text-gray-500 border-[#EDEDF3]'}`}
        >
          Standard · {users.length - proCount}
        </button>
      </div>

      <div className="bg-white border border-[#EDEDF3] rounded-[18px] overflow-hidden">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#F1F2F6]">
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Utilisateur</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Profession</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Statut</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Entreprise</th>
              <th className="px-5 py-4 text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">Inscription</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F6F6FA]">
            {filteredUsers.map((user) => (
              <tr key={user.id} onClick={() => router.push(`/dashboard/users/${user.id}`)} className="cursor-pointer hover:bg-gray-50/60 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#EDEFFB] text-[#16233F] text-[13px] font-extrabold flex items-center justify-center shrink-0">
                      {initials(user)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-[#1E2430] truncate">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-[14px] font-semibold text-[#1E2430]">{user.profession || '—'}</td>
                <td className="px-5 py-4">
                  {user.is_pro ? (
                    <span className="text-[12px] font-bold px-3 py-1 rounded-xl bg-[#E8ECFD] text-[#3B5BDB]">PRO</span>
                  ) : (
                    <span className="text-[12px] font-bold px-3 py-1 rounded-xl bg-[#F0F1F5] text-gray-500">STANDARD</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {user.business_info?.companyName ? (
                    <div>
                      <div className="text-[14px] font-bold text-[#1E2430] truncate">{user.business_info.companyName}</div>
                      {user.business_info.siret && <div className="text-[12.5px] text-gray-500 mt-0.5">SIRET {user.business_info.siret}</div>}
                    </div>
                  ) : <span className="text-[14px] text-gray-400">—</span>}
                </td>
                <td className="px-5 py-4 text-[14px] text-gray-500">
                  {new Date(user.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-500">Aucun utilisateur trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0E172C]/40 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold font-outfit text-[#0E172C]">Ajouter un utilisateur</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-[#0E172C]">
                <div className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">✕</div>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <p className="text-[13px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Email</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F]" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Mot de passe provisoire</label>
                <input type="text" required minLength={6} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F]" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Profession</label>
                <input value={formData.profession} onChange={e => setFormData({ ...formData, profession: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F]" placeholder="ex. Peintre" />
              </div>
              <label className="flex items-center gap-2 text-[14px] font-semibold text-[#0E172C]">
                <input type="checkbox" checked={formData.is_pro} onChange={e => setFormData({ ...formData, is_pro: e.target.checked })} />
                Compte professionnel (Pro)
              </label>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-[#0E172C] font-bold hover:bg-gray-100 rounded-xl transition-colors text-[14px]">Annuler</button>
                <button type="submit" disabled={loading} className="bg-[#16233F] hover:bg-[#0D1830] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-[#16233F]/20 disabled:opacity-70 transition-all flex items-center gap-2 text-[14px]">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Créer le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
