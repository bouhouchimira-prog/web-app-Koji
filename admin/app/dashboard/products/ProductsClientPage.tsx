'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Plus, Search, Trash2, Edit2, Loader2, Image as ImageIcon,
  Box, Wrench, PenTool, Layers, Tag
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  price_ht: number
  unit: string
  category: string
  brand: string
  image_url: string
  packaging: string
}

export default function ProductsClientPage({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [isModalOpen, setIsModalOpen] = useState(false)
  // Edition (25 oct) : meme modal que la creation, juste pre-remplie et en
  // mode UPDATE quand editingId est pose - avant ce changement il n'y
  // avait aucun moyen de modifier un produit existant (le crayon de
  // chaque carte n'avait pas de onClick).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price_ht: '',
    unit: 'u',
    category: 'Materiaux',
    brand: '',
    image_url: '',
    packaging: ''
  })

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return
    }

    setUploadingImage(true)
    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${fileName}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(filePath)

      setFormData({ ...formData, image_url: data.publicUrl })
    } catch (error) {
      alert('Erreur lors du téléchargement de l\'image !')
      console.error(error)
    } finally {
      setUploadingImage(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setFormData({ name: '', price_ht: '', unit: 'u', category: 'Materiaux', brand: '', image_url: '', packaging: '' })
    setIsModalOpen(true)
  }

  function openEdit(e: React.MouseEvent, product: Product) {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(product.id)
    setFormData({
      name: product.name,
      price_ht: String(product.price_ht ?? ''),
      unit: product.unit || 'u',
      category: product.category || 'Materiaux',
      brand: product.brand || '',
      image_url: product.image_url || '',
      packaging: product.packaging || ''
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        name: formData.name,
        price_ht: parseFloat(formData.price_ht),
        unit: formData.unit,
        category: formData.category,
        brand: formData.brand,
        image_url: formData.image_url,
        packaging: formData.packaging
      }

      if (editingId) {
        const { data, error } = await supabase.from('products').update(payload).eq('id', editingId).select().single()
        if (error) throw error
        setProducts(products.map(p => p.id === editingId ? data : p))
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([{ ...payload, consumption_rule_type: 'fixed', consumption_rule_factor: 1.0 }])
          .select()
          .single()
        if (error) throw error
        setProducts([data, ...products])
      }

      setIsModalOpen(false)
      setEditingId(null)
      router.refresh()
    } catch (err) {
      alert(`Erreur lors de l'enregistrement du produit : ${(err as any).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return

    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      setProducts(products.filter(p => p.id !== id))
      router.refresh()
    } catch (err) {
      alert('Erreur lors de la suppression du produit')
    }
  }

  const getCategoryIcon = (cat: string) => {
    const c = cat?.toLowerCase() || ''
    if (c.includes('outil')) return <Wrench className="w-[52px] h-[52px] text-gray-300 stroke-[#CBD5E1] opacity-70 stroke-[1.5]" />
    if (c.includes('pein')) return <PenTool className="w-[52px] h-[52px] text-gray-300 stroke-[#CBD5E1] opacity-70 stroke-[1.5]" />
    if (c.includes('mat')) return <Box className="w-[52px] h-[52px] text-gray-300 stroke-[#CBD5E1] opacity-70 stroke-[1.5]" />
    return <Layers className="w-[52px] h-[52px] text-gray-300 stroke-[#CBD5E1] opacity-70 stroke-[1.5]" />
  }

  return (
    <div className="space-y-8 pb-10 relative">
      {/* En-tete (25 oct, refonte maquette) : recherche/notifications/compte
          deplacees dans la barre partagee TopBar (components/layout/TopBar.tsx)
          - seul le champ de recherche reste ici car il filtre reellement la
          liste (searchTerm), contrairement au champ decoratif de TopBar. */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Produits</h1>
        <div className="relative md:w-72">
          <Search className="w-[15px] h-[15px] text-[#9C9FB0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher un produit…"
            className="w-full h-[42px] rounded-xl border border-[#E5E5EC] bg-white pl-9 pr-3.5 text-[14px] text-[#1E2430] placeholder-[#9C9FB0] outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 mt-6">
        <div>
          <h2 className="text-[16px] font-bold text-[#0E172C] mb-1">Produits</h2>
          <p className="text-[14px] font-medium text-gray-500">
            Gestion du catalogue éditorial et inventaire.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#16233F] hover:bg-[#0D1830] text-white px-5 py-2.5 rounded-[0.6rem] font-bold flex items-center gap-2 shadow-lg shadow-[#16233F]/20 transition-all text-[14px]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Ajouter un Produit
        </button>
      </div>

      {/* KPI reels (25 oct) - remplace un total fige "1,284" + une
          tendance "+12%" inventee, et une bannière "analyse IA"
          promettant une fonctionnalite qui n'existe pas. */}
      <div className="grid grid-cols-2 gap-4 mb-8 text-[#0E172C] max-w-xl">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-semibold">Total produits</span>
          <span className="text-[26px] font-extrabold text-[#16233F]">{products.length}</span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-semibold">Catégories</span>
          <span className="text-[26px] font-extrabold text-[#16233F]">{new Set(products.map(p => p.category).filter(Boolean)).size}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-[1.2rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-lg transition-all group flex flex-col p-6 cursor-pointer relative">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
              <button onClick={(e) => handleDelete(e, product.id)} className="p-1.5 bg-red-50 text-red-500 rounded-md hover:bg-red-100 transition-colors shadow-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <Link href={`/dashboard/products/${product.id}`} className="flex-1 flex flex-col">
              <div className="flex justify-end mb-6 text-[#0E172C]">
                <span className="text-[9px] font-bold tracking-widest text-[#0E172C] uppercase bg-gray-50 px-2 py-0.5 rounded-sm">{product.category || 'PRODUIT'}</span>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center py-4 mb-6">
                {product.image_url ? (
                  <div className="w-24 h-24 relative rounded-xl overflow-hidden shadow-sm border border-gray-100">
                    <img src={product.image_url} alt={product.name} className="object-cover w-full h-full" />
                  </div>
                ) : (
                  getCategoryIcon(product.category)
                )}
              </div>

              <div className="mt-auto">
                <h3 className="font-bold text-[#0E172C] text-[15px] leading-tight mb-1.5 line-clamp-2 min-h-[36px]">{product.name}</h3>
                <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed h-[40px] mb-4 font-medium">
                  {product.packaging || product.brand || 'Détails de produit non spécifiés'}
                </p>
                
                <div className="flex items-end justify-between mt-6 border-t border-gray-50 pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-outfit font-bold text-[20px] text-[#16233F] leading-none">
                      {Number(product.price_ht || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </span>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">/{product.unit}</span>
                  </div>
                  <button
                    onClick={(e) => openEdit(e, product)}
                    aria-label="Modifier le produit"
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-[#16233F] hover:text-[#16233F] transition-colors shadow-sm bg-white"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Link>
          </div>
        ))}
        
        {/* Add Product Card */}
        <div
          onClick={openCreate}
          className="border-[2px] border-dashed border-gray-200 rounded-[1.2rem] flex flex-col items-center justify-center cursor-pointer hover:border-[#16233F] hover:bg-[#EDEFFB]/20 transition-all p-8 min-h-[340px] group bg-gray-50/30"
        >
          <div className="w-[52px] h-[52px] rounded-full bg-white border border-gray-100 flex items-center justify-center text-[#16233F] mb-5 shadow-sm group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 stroke-[2]" />
          </div>
          <span className="font-bold text-[#0E172C] text-[15px] mb-1.5">Nouveau Produit</span>
          <span className="text-[13px] font-medium text-gray-500 text-center px-4 leading-relaxed">Cliquez pour ajouter manuellement</span>
        </div>
      </div>

      {/* Add Product Modal (Unchanged Layout mostly, just matching styles loosely if ever opened) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0E172C]/40 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
              <h2 className="text-xl font-bold font-outfit text-[#0E172C]">{editingId ? 'Modifier le produit' : 'Ajouter un nouveau produit'}</h2>
              <button onClick={() => { setIsModalOpen(false); setEditingId(null) }} className="text-gray-400 hover:text-[#0E172C]">
                <div className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">✕</div>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Nom du Produit</label>
                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="ex. Peinture Blanche" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Catégorie</label>
                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]">
                      <option value="MATÉRIAUX">Matériaux</option>
                      <option value="PEINTURE">Peinture</option>
                      <option value="ENDUIT">Enduit</option>
                      <option value="OUTILLAGE">Outillage</option>
                      <option value="ACCESSOIRES">Accessoires</option>
                      <option value="SOL">Sol</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Marque</label>
                    <input value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="ex. Tollens" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Prix (HT)</label>
                      <input type="number" step="0.01" required value={formData.price_ht} onChange={e => setFormData({ ...formData, price_ht: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Unité</label>
                      <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]">
                        <option value="u">Unité (u)</option>
                        <option value="kit">Kit</option>
                        <option value="l">Litre (l)</option>
                        <option value="m2">m²</option>
                        <option value="ml">Mètre Linéaire (ml)</option>
                        <option value="kg">Kilogramme (kg)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Conditionnement / Détails</label>
                    <input value={formData.packaging} onChange={e => setFormData({ ...formData, packaging: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" placeholder="ex. Pot de 5L" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Image du Produit</label>
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
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-3 sticky bottom-0 bg-white z-10 border-t border-gray-50 mt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingId(null) }} className="px-5 py-2.5 text-[#0E172C] font-bold hover:bg-gray-100 rounded-xl transition-colors text-[14px]">Annuler</button>
                <button
                  type="submit"
                  disabled={loading || uploadingImage}
                  className="bg-[#16233F] hover:bg-[#0D1830] text-white px-7 py-2.5 rounded-xl font-bold shadow-lg shadow-[#16233F]/20 disabled:opacity-70 transition-all flex items-center gap-2 text-[14px]"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Enregistrer' : 'Ajouter le produit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
