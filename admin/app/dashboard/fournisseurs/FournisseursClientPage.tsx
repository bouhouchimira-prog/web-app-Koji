'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Plus, Search, Trash2, Edit2, Loader2, Truck,
  Bell, HelpCircle, Globe, Phone, MapPin, Package
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Fournisseur {
  id: string
  name: string
  logo_url: string | null
  website: string | null
  phone: string | null
  address: string | null
  city: string | null
  created_at: string
}

interface Props {
  initialFournisseurs: Fournisseur[]
  countMap: Record<string, number>
}

const empty = {
  name: '',
  logo_url: '',
  website: '',
  phone: '',
  address: '',
  city: '',
}

export default function FournisseursClientPage({ initialFournisseurs, countMap }: Props) {
  const [fournisseurs, setFournisseurs] = useState(initialFournisseurs)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState(empty)
  const router = useRouter()
  const supabase = createClient()

  const filtered = fournisseurs.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.city?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openCreate = () => {
    setEditingId(null)
    setFormData(empty)
    setIsModalOpen(true)
  }

  const openEdit = (f: Fournisseur) => {
    setEditingId(f.id)
    setFormData({
      name: f.name || '',
      logo_url: f.logo_url || '',
      website: f.website || '',
      phone: f.phone || '',
      address: f.address || '',
      city: f.city || '',
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        name: formData.name,
        logo_url: formData.logo_url || null,
        website: formData.website || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
      }

      if (editingId) {
        const { data, error } = await supabase
          .from('fournisseurs')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single()
        if (error) throw error
        setFournisseurs(fournisseurs.map(f => f.id === editingId ? data : f))
      } else {
        const { data, error } = await supabase
          .from('fournisseurs')
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        setFournisseurs([data, ...fournisseurs])
      }

      setIsModalOpen(false)
      setFormData(empty)
      setEditingId(null)
      router.refresh()
    } catch (err: any) {
      alert('Erreur : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Supprimer ce fournisseur ? Les fournitures associées seront détachées.')) return
    try {
      const { error } = await supabase.from('fournisseurs').delete().eq('id', id)
      if (error) throw error
      setFournisseurs(fournisseurs.filter(f => f.id !== id))
      router.refresh()
    } catch {
      alert('Erreur lors de la suppression')
    }
  }

  return (
    <div className="space-y-8 pb-10 relative">
      {/* En-tete (25 oct, refonte maquette) : recherche/notifications/compte
          deplacees dans la barre partagee TopBar (components/layout/TopBar.tsx)
          - seul le champ de recherche reste ici car il filtre reellement la
          liste (searchTerm), contrairement au champ decoratif de TopBar. */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Fournisseurs</h1>
        <div className="relative md:w-72">
          <Search className="w-[15px] h-[15px] text-[#9C9FB0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher un fournisseur…"
            className="w-full h-[42px] rounded-xl border border-[#E5E5EC] bg-white pl-9 pr-3.5 text-[14px] text-[#1E2430] placeholder-[#9C9FB0] outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 mt-6">
        <div>
          <h2 className="text-[16px] font-bold text-[#0E172C] mb-1">Fournisseurs</h2>
          <p className="text-[14px] font-medium text-gray-500">
            Annuaire des fournisseurs partenaires (Paris & Île-de-France).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#16233F] hover:bg-[#0D1830] text-white px-5 py-2.5 rounded-[0.6rem] font-bold flex items-center gap-2 shadow-lg shadow-[#16233F]/20 transition-all text-[14px]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Ajouter un Fournisseur
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((f) => (
          <div
            key={f.id}
            onClick={() => openEdit(f)}
            className="bg-white rounded-[1.2rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-lg transition-all group p-6 cursor-pointer relative flex flex-col"
          >
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
              <button onClick={(e) => handleDelete(e, f.id)} className="p-1.5 bg-red-50 text-red-500 rounded-md hover:bg-red-100 transition-colors shadow-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                {f.logo_url ? (
                  <img src={f.logo_url} alt={f.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <Truck className="w-7 h-7 text-gray-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[#0E172C] text-[16px] leading-tight mb-1 truncate">{f.name}</h3>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
                  <Package className="w-3.5 h-3.5" />
                  <span>{countMap[f.id] || 0} fournitures</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-auto pt-4 border-t border-gray-50">
              {f.city && (
                <div className="flex items-center gap-2 text-[13px] text-gray-600">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{f.city}</span>
                </div>
              )}
              {f.phone && (
                <div className="flex items-center gap-2 text-[13px] text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{f.phone}</span>
                </div>
              )}
              {f.website && (
                <div className="flex items-center gap-2 text-[13px] text-[#16233F] font-medium">
                  <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <a href={f.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="truncate hover:underline">
                    {f.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}

        <div
          onClick={openCreate}
          className="border-[2px] border-dashed border-gray-200 rounded-[1.2rem] flex flex-col items-center justify-center cursor-pointer hover:border-[#16233F] hover:bg-[#EDEFFB]/20 transition-all p-8 min-h-[220px] group bg-gray-50/30"
        >
          <div className="w-[52px] h-[52px] rounded-full bg-white border border-gray-100 flex items-center justify-center text-[#16233F] mb-4 shadow-sm group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 stroke-[2]" />
          </div>
          <span className="font-bold text-[#0E172C] text-[15px] mb-1.5">Nouveau Fournisseur</span>
          <span className="text-[13px] font-medium text-gray-500 text-center px-4 leading-relaxed">Ajouter un partenaire au catalogue</span>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0E172C]/40 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
              <h2 className="text-xl font-bold font-outfit text-[#0E172C]">
                {editingId ? 'Modifier le Fournisseur' : 'Ajouter un Fournisseur'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-[#0E172C]">
                <div className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">✕</div>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Nom du Fournisseur *</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="ex. Leroy Merlin" />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">URL du Logo</label>
                <input value={formData.logo_url} onChange={e => setFormData({ ...formData, logo_url: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="https://..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Site Web</label>
                  <input value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Téléphone</label>
                  <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="01 23 45 67 89" />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Adresse</label>
                <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="52 Avenue de Flandre" />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Ville</label>
                <input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="Paris 19e" />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-50 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-[#0E172C] font-bold hover:bg-gray-100 rounded-xl transition-colors text-[14px]">Annuler</button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#16233F] hover:bg-[#0D1830] text-white px-7 py-2.5 rounded-xl font-bold shadow-lg shadow-[#16233F]/20 disabled:opacity-70 transition-all flex items-center gap-2 text-[14px]"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
