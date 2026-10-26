'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Edit2, Trash2, Image as ImageIcon, Loader2
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface Product {
  id: string
  name: string
  price_ht: number
  unit: string
  category: string
  brand: string
  image_url: string
  packaging: string
  created_at: string
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter()
  const supabase = createClient()

  // Edition (25 oct) : le bouton "Modifier" n'avait aucun onClick avant ce
  // changement. Reprend le meme geste create/edit que ProductsClientPage.tsx,
  // juste localise ici puisque cette page n'a pas acces a l'etat de la liste.
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [formData, setFormData] = useState({
    name: product.name,
    price_ht: String(product.price_ht ?? ''),
    unit: product.unit || 'u',
    category: product.category || 'Materiaux',
    brand: product.brand || '',
    image_url: product.image_url || '',
    packaging: product.packaging || ''
  })

  const handleDelete = async () => {
    if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return
    await supabase.from('products').delete().eq('id', product.id)
    router.push('/dashboard/products')
    router.refresh()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setUploadingImage(true)
    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const filePath = `${Math.random()}.${fileExt}`
    try {
      const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('products').getPublicUrl(filePath)
      setFormData({ ...formData, image_url: data.publicUrl })
    } catch (error) {
      alert("Erreur lors du téléchargement de l'image !")
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
        price_ht: parseFloat(formData.price_ht),
        unit: formData.unit,
        category: formData.category,
        brand: formData.brand,
        image_url: formData.image_url,
        packaging: formData.packaging
      }
      const { error } = await supabase.from('products').update(payload).eq('id', product.id)
      if (error) throw error
      setIsModalOpen(false)
      router.refresh()
    } catch (err) {
      alert(`Erreur lors de l'enregistrement du produit : ${(err as any).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 pb-10 relative">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/dashboard/products" className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[#EDEDF3] text-gray-500 hover:text-[#16233F] transition-colors shadow-sm">
           <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </Link>
        <h1 className="text-[26px] font-extrabold text-[#16233F] tracking-tight">Produits</h1>
      </div>

      {/* Product Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mt-6">
        <div className="max-w-3xl">
          <div className="flex items-center flex-wrap gap-4 mb-3">
            <h2 className="text-[36px] font-bold text-[#0E172C] font-outfit leading-none tracking-tight">{product.name}</h2>
            {product.category && (
              <span className="bg-gray-50 text-[#0E172C] px-2.5 py-1 rounded-sm text-[10px] font-extrabold tracking-widest uppercase">
                {product.category}
              </span>
            )}
          </div>
          {product.packaging && (
            <p className="text-[15px] font-medium text-gray-500 leading-relaxed max-w-2xl mt-4">
              {product.packaging}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 mt-2 lg:mt-0">
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#16233F] hover:bg-[#0D1830] text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-[#16233F]/20 transition-all text-[13px]">
            <Edit2 className="w-4 h-4" />
            Modifier
          </button>
          <button onClick={handleDelete} className="w-11 h-11 flex items-center justify-center rounded-xl border border-gray-200 text-[#D93036] hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm bg-white">
            <Trash2 className="w-[18px] h-[18px] stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Meta Row — uniquement des vraies infos (25 oct : retire le badge
          "En Stock" et la "Promotion -15%" inventes, ainsi que le SKU
          fictif "ED-PR-250-SATIN" utilise en repli). */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-1.5">Catégorie</span>
          <span className="text-[15px] font-bold text-[#0E172C] capitalize">{product.category || '—'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-1.5">Marque</span>
          <span className="text-[14px] font-bold text-[#16233F] tracking-wide uppercase">{product.brand || '—'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-1.5">Prix Base (HT)</span>
          <span className="text-[15px] font-bold text-[#0E172C] font-outfit">{Number(product.price_ht).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € /{product.unit}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-1.5">Ajouté le</span>
          <span className="text-[15px] font-bold text-[#16233F]">
            {product.created_at ? new Date(product.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          </span>
        </div>
      </div>

      {/* Main Grid — retire "Ventes recentes" (fausses ventes codees en dur),
          "Stock"/"Ajuster l'inventaire" (aucune colonne de stock dans
          `products`) et la carte "Analyse" (statistique inventee) : ces
          blocs n'avaient aucune donnee reelle derriere. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-10">
        <div className="xl:col-span-2 space-y-8">
          {product.packaging || product.brand ? (
            <div className="bg-white rounded-[1.5rem] p-8 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <h3 className="font-bold text-[15px] text-[#0E172C] mb-4 tracking-tight">Conditionnement / Détails</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed font-medium">
                {product.packaging || `Marque : ${product.brand}`}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="font-bold text-[13px] text-[#0E172C] tracking-widest uppercase mb-5 px-1">Image</h3>
            {product.image_url ? (
              <div className="aspect-square bg-gray-50 rounded-[1.2rem] flex items-center justify-center overflow-hidden border border-gray-100">
                <img src={product.image_url} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square bg-gray-50 rounded-[1.2rem] flex flex-col items-center justify-center border border-gray-100 text-gray-300">
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-[11px] font-bold uppercase tracking-widest">Aucune image</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0E172C]/40 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
              <h2 className="text-xl font-bold font-outfit text-[#0E172C]">Modifier le produit</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-[#0E172C]">
                <div className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">✕</div>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Nom du Produit</label>
                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" />
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
                    <input value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Prix (HT)</label>
                      <input type="number" step="0.01" required value={formData.price_ht} onChange={e => setFormData({ ...formData, price_ht: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" />
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
                    <input value={formData.packaging} onChange={e => setFormData({ ...formData, packaging: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16233F]/20 focus:border-[#16233F] text-[14px]" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#0E172C] mb-1.5">Image du Produit</label>
                    <div className="flex gap-2 items-center">
                      <label className="flex-1 cursor-pointer">
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
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
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-[#0E172C] font-bold hover:bg-gray-100 rounded-xl transition-colors text-[14px]">Annuler</button>
                <button type="submit" disabled={loading || uploadingImage} className="bg-[#16233F] hover:bg-[#0D1830] text-white px-7 py-2.5 rounded-xl font-bold shadow-lg shadow-[#16233F]/20 disabled:opacity-70 transition-all flex items-center gap-2 text-[14px]">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
