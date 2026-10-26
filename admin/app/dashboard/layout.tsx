
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase' // Use server-side friendly client if available, but for now client-side check or middleware is common. 
// Actually for layout server component we need server client.
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import DashboardShell from '@/components/layout/DashboardShell'

// Helper to create server client for RSC
async function createClientForServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClientForServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Acces reserve a un seul compte (25 oct, demande d'Amira) - c'est la
  // vraie barriere (verifiee a chaque page /dashboard/*, pas seulement a
  // la connexion) ; la page de connexion fait deja un controle cote
  // client, mais celui-ci est contournable (appel direct a l'API), donc
  // la verification serveur ici reste necessaire. Les policies RLS (voir
  // migration SQL fournie a part) sont la 3e barriere, au niveau de la
  // base elle-meme.
  if (!user || user.email !== 'ablexpertrenov@gmail.com') {
    if (user) await supabase.auth.signOut()
    redirect('/auth/login')
  }

  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  )
}
