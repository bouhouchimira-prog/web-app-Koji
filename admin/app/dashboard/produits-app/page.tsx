
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import ProductsClientPage from './ProductsClientPage'
import { exigerBackOffice } from '@/lib/require-admin'

export default async function ProductsPage() {
  await exigerBackOffice()
  const cookieStore = await cookies()
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

  // Fetch products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  return <ProductsClientPage initialProducts={products || []} />
}
