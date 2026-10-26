'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Plus, Search, Trash2, Edit2, Loader2, Package,
  Bell, HelpCircle, Image as ImageIcon, Box, Wrench, PenTool, Layers, Truck
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Fourniture {
  id: string
  name: string
  category: string
  prix_achat_ht: number
  prix_vente_ht: number
  conditionnement: string | null
  barcode: string | null
  image_url: string | null
  source_url: string | null
  fournisseur_id: string | null
  fournisseurs?: { name: string } | null
  created_at: string
}

interface FournisseurOpt {
  id: string
  name: string
}

interface Props {
  initialFournitures: Fourniture[]
  fournisseurs: FournisseurOpt[]
}

const CATEGORIES = ['Matériaux', 'Peinture', 'Enduit', 'Outillage', 'Accessoires', 'Sol', 'Autre']

const empty = {
  name: '',
  category: 'Matériaux',
  prix_achat_ht: '',
  prix_vente_ht: '',
  conditionnement: '',
  barcode: '',
  image_url: '',
  source_url: '',
  fournisseur_id: '',
}

export default function FournituresClientPage({ initialFournitures, fournisseurs }: Props) {
  const [fournitures, setFournitures] = useState(initialFournitures)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterFournisseur, setFilterFournisseur] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [formData, setFormData] = useState(empty)
  const router = useRouter()
  const supabase = createClient()

  const filtered = useMemo(() => {
    return fournitures.filter(f => {
      if (filterFournisseur && f.fournisseur_id !== filterFournisseur) return false
      if (filterCategory && f.category !== filterCategory) return false
      if (!searchTerm) return true
      const s = searchTerm.toLowerCase()
      return (
        f.name.toLowerCase().includes(s) ||
        f.category.toLowerCase().includes(s) ||
        f.conditionnement?.toLowerCase().includes(s) ||
        f.fournisseurs?.name.toLowerCase().includes(s)
      )
    })
  }, [fournitures, searchTerm, filterFournisseur, filterCategory])

  const totalValue = useMemo(
    () => fournitures.reduce((sum, f) => sum + (Number(f.prix_vente_ht) || 0), 0),
    [fournitures]
  )

  const openCreate = () => {
    setEditingId(null)
    setFormData(empty)
    setIsModalOpen(true)
  }

  const openEdit = (f: Fourniture) => {
    setEditingId(f.id)
    setFormData({
      name: f.name || '',
      category: f.category || 'Matériaux',
      prix_achat_ht: String(f.prix_achat_ht ?? ''),
      prix_vente_ht: String(f.prix_vente_ht ?? ''),
      conditionnement: f.conditionnement || '',
      barcode: f.barcode || '',
      image_url: f.image_url || '',
      source_url: f.source_url || '',
      fournisseur_id: f.fournisseur_id || '',
    })
    setIsModalOpen(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setUploadingImage(true)
    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${fileExt}`

    try {
      // Try the dedicated bucket, fall back to "products" which already exists
      let bucket = 'fournitures'
      let { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file)
      if (uploadError) {
        bucket = 'products'
        const fb = await supabase.storage.from(bucket).upload(fileName, file)
        if (fb.error) throw fb.error
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
      setFormData({ ...formData, image_url: data.publicUrl })
    } catch (err: any) {
      alert("Erreur lors du téléchargement de l'image : " + err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        prix_achat_ht: parseFloat(formData.prix_achat_ht) || 0,
        prix_vente_ht: parseFloat(formData.prix_vente_ht) || 0,
        conditionnement: formData.conditionnement || null,
        barcode: formData.barcode || null,
        image_url: formData.image_url || null,
        source_url: formData.source_url || null,
        fournisseur_id: formData.fournisseur_id || null,
      }

      if (editingId) {
        const { data, error } = await supabase
          .from('fournitures')
          .update(payload)
          .eq('id', editingId)
          .select('*, fournisseurs(name)')
          .single()
        if (error) throw error
        setFournitures(fournitures.map(f => f.id === editingId ? data : f))
      } else {
        const { data, error } = await supabase
          .from('fournitures')
          .insert([payload])
          .select('*, fournisseurs(name)')
          .single()
        if (error) throw error
        setFournitures([data, ...fournitures])
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
    if (!confirm('Supprimer cette fourniture ?')) return
    try {
      const { error } = await supabase.from('fournitures').delete().eq('id', id)
      if (error) throw error
      setFournitures(fournitures.filter(f => f.id !== id))
      router.refresh()
    } catch {
      alert('Erreur lors de la suppression')
    }
  }

  const getCategoryIcon = (cat: string) => {
    const c = cat?.toLowerCase() || ''
    if (c.includes('outil')) return <Wrench className="w-[52px] h-[52px] stroke-[#CBD5E1] opacity-70 stroke-[1.5]" />
    if (c.includes('pein')) return <PenTool className="w-[52px] h-[52px] stroke-[#CBD5E1] opacity-70 stroke-[1.5]" />
    if (c.includes('mat')) return <Box className="w-[52px] h-[52px] stroke-[#CBD5E1] opacity-70 stroke-[1.5]" />
    return <Layers className="w-[52px] h-[52px] stroke-[#CBD5E1] opacity-70 stroke-[1.5]" />
  }

  return (
    <div className="space-y-8 pb-10 relative">
      {/* En-tete (25 oct, refonte maquette) : recherche/notifications/compte
          deplacees dans la barre partagee TopBar (components/layout/TopBar.tsx)
          - seul le champ de recherche reste ici car il filtre reellement la
          liste (searchTerm), contrairement au champ decoratif de TopBar. */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Fournitures</h1>
        <div className="relative md:w-72">
          <Search className="w-[15px] h-[15px] text-[#9C9FB0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher une fourniture…"
            className="w-full h-[42px] rounded-xl border border-[#E5E5EC] bg-white pl-9 pr-3.5 text-[14px] text-[#1E2430] placeholder-[#9C9FB0] outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6 mt-6">
        <div>
          <h2 className="text-[16px] font-bold text-[#0E172C] mb-1">Fournitures</h2>
          <p className="text-[14px] font-medium text-gray-500">
            Catalogue complet des fournitures (matériaux, peinture, outillage…).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#16233F] hover:bg-[#0D1830] text-white px-5 py-2.5 rounded-[0.6rem] font-bold flex items-center gap-2 shadow-lg shadow-[#16233F]/20 transition-all text-[14px]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Ajouter une Fourniture
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-[1.2rem] p-6 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <span className="text-[12px] font-bold text-gray-600 tracking-wider uppercase mb-2 block">Total Fournitures</span>
          <span className="text-[32px] font-bold text-[#16233F] font-outfit leading-none">{fournitures.length}</span>
        </div>
        <div className="bg-white rounded-[1.2rem] p-6 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <span className="text-[12px] font-bold text-gray-600 tracking-wider uppercase mb-2 block">Fournisseurs Actifs</span>
          <span className="text-[32px] font-bold text-[#0E172C] font-outfit leading-none">{fournisseurs.length}</span>
        </div>
        <div className="bg-white rounded-[1.2rem] p-6 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
          <span className="text-[12px] font-bold text-gray-600 tracking-wider uppercase mb-2 block">Valeur Catalogue HT</span>
          <span className="text-[32px] font-bold text-[#10B981] font-outfit leading-none">
            {totalValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-2">
        <select
          value={filterFournisseur}
          onChange={e => setFilterFournisseur(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-full text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20"
        >
          <option value="">Tous les fournisseurs</option>
          {fournisseurs.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-full text-[13px] font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20"
        >
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(filterFournisseur || filterCategory || searchTerm) && (
          <button
            onClick={() => { setFilterFournisseur(''); setFilterCategory(''); setSearchTerm('') }}
            className="px-4 py-2 text-[13px] font-bold text-[#16233F] hover:bg-[#EDEFFB] rounded-full transition-colors"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {filtered.map((f) => {
          const margin = f.prix_vente_ht - f.prix_achat_ht
          const marginPct = f.prix_achat_ht > 0 ? (margin / f.prix_achat_ht) * 100 : 0
          return (
            <div
              key={f.id}
              onClick={() => openEdit(f)}
              className="bg-white rounded-[1.2rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-lg transition-all group flex flex-col p-6 cursor-pointer relative"
            >
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                <button onClick={(e) => handleDelete(e, f.id)} className="p-1.5 bg-red-50 text-red-500 rounded-md hover:bg-red-100 transition-colors shadow-sm">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-bold tracking-widest text-[#0E172C] uppercase bg-gray-50 px-2 py-0.5 rounded-sm">{f.category}</span>
                {f.fournisseurs?.name && (
                  <span className="text-[10px] font-semibold text-gray-500 truncate max-w-[100px]" title={f.fournisseurs.name}>
                    {f.fournisseurs.name}
                  </span>
                )}
              </div>

              <div className="flex-1 flex flex-col items-center justify-center py-3 mb-4">
                {f.image_url ? (
                  <div className="w-24 h-24 relative rounded-xl overflow-hidden shadow-sm border border-gray-100">
                    <img src={f.image_url} alt={f.name} className="object-cover w-full h-full" />
                  </div>
                ) : (
                  getCategoryIcon(f.category)
                )}
              </div>

              <div className="mt-auto">
                <h3 className="font-bold text-[#0E172C] text-[14px] leading-tight mb-1.5 line-clamp-2 min-h-[34px]">{f.name}</h3>
                <p className="text-[12px] text-gray-500 line-clamp-1 leading-relaxed mb-3 font-medium">
                  {f.conditionnement || '—'}
                </p>

                <div className="border-t border-gray-50 pt-3 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Achat</span>
                    <span className="text-[13px] font-bold text-gray-700">
                      {Number(f.prix_achat_ht || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Vente</span>
                    <span className="font-outfit font-bold text-[18px] text-[#16233F] leading-none">
                      {Number(f.prix_vente_ht || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                  {f.prix_achat_ht > 0 && (
                    <div className="flex items-baseline justify-end pt-1">
                      <span className={`text-[10px] font-bold ${margin >= 0 ? 'text-[#10B981]' : 'text-[#D93036]'}`}>
                        {margin >= 0 ? '+' : ''}{marginPct.toFixed(0)}% marge
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div
          onClick={openCreate}
          className="border-[2px] border-dashed border-gray-200 rounded-[1.2rem] flex flex-col items-center justify-center cursor-pointer hover:border-[#16233F] hover:bg-[#EDEFFB]/20 transition-all p-8 min-h-[340px] group bg-gray-50/30"
        >
          <div className="w-[52px] h-[52px] rounded-full bg-white border border-gray-100 flex items-center justify-center text-[#16233F] mb-5 shadow-sm group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 stroke-[2]" />
          </div>
          <span className="font-bold text-[#0E172C] text-[15px] mb-1.5">Nouvelle Fourniture</span>
          <span className="text-[13px] font-medium text-gray-500 text-center px-4 leading-relaxed">Ajouter au catalogue</span>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-[14px] font-medium">
          Aucune fourniture trouvée.
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0E172C]/40 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
              <h2 className="text-xl font-bold font-outfit text-[#0E172C]">
                {editingId ? 'Modifier la Fourniture' : 'Ajouter une Fourniture'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-[#0E172C]">
                <div className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">✕</div>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Nom de la Fourniture *</label>
                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="ex. Peinture Tollens 10L" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Catégorie</label>
                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Fournisseur</label>
                    <select value={formData.fournisseur_id} onChange={e => setFormData({ ...formData, fournisseur_id: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]">
                      <option value="">— Aucun (Divers) —</option>
                      {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Conditionnement</label>
                    <input value={formData.conditionnement} onChange={e => setFormData({ ...formData, conditionnement: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="ex. Pot de 10 L" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Prix d'Achat HT (€)</label>
                      <input type="number" step="0.01" value={formData.prix_achat_ht} onChange={e => setFormData({ ...formData, prix_achat_ht: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Prix de Vente HT (€) *</label>
                      <input type="number" step="0.01" required value={formData.prix_vente_ht} onChange={e => setFormData({ ...formData, prix_vente_ht: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Code-Barre</label>
                    <input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="EAN13..." />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">URL Source (catalogue)</label>
                    <input value={formData.source_url} onChange={e => setFormData({ ...formData, source_url: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Image</label>
                    <div className="flex gap-2 items-center">
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 border-dashed rounded-xl text-gray-500 hover:bg-[#F0F4FF] hover:border-[#16233F] transition-colors flex items-center justify-center gap-2">
                          {uploadingImage ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-[#16233F]" />
                              <span className="text-[13px] font-medium text-[#16233F]">Chargement...</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-4 h-4 text-gray-400" />
                              <span className="text-[13px] font-medium">Cliquer pour charger</span>
                            </>
                          )}
                        </div>
                      </label>
                      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-200 shrink-0 overflow-hidden relative shadow-sm">
                        {formData.image_url ? (
                          <img src={formData.image_url} alt="Aperçu" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-gray-300" />
                        )}
                      </div>
                    </div>
                    <input
                      value={formData.image_url}
                      onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                      className="mt-2 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#16233F]/20"
                      placeholder="ou coller une URL d'image"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-3 sticky bottom-0 bg-white z-10 border-t border-gray-50 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-[#0E172C] font-bold hover:bg-gray-100 rounded-xl transition-colors text-[14px]">Annuler</button>
                <button
                  type="submit"
                  disabled={loading || uploadingImage}
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
