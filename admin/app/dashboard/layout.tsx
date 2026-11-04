
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

  // Acces reserve aux comptes admin (flag is_admin, migration 0004).
  // Fallback sur la liste d'emails historiques si la colonne n'existe pas
  // encore (migration non appliquee).
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (profile && typeof profile.is_admin === 'boolean') {
      isAdmin = profile.is_admin;
    } else {
      isAdmin = user.email === 'ablexpertrenov@gmail.com' || user.email === 'bouhouchimira@gmail.com';
    }
  }
  if (!user || !isAdmin) {
    if (user) await supabase.auth.signOut()
    redirect('/auth/login')
  }

  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  )
}
