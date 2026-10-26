import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ProductDetailClient from './ProductDetailClient'

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { }
      }
    }
  )

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (!product) {
    redirect('/dashboard/products')
  }

  return <ProductDetailClient product={product} />
}
