import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const admin = await requireAdminSession()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await request.json()
  const { email, password, profession, is_pro } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const { data: row, error: insertError } = await supabase
    .from('users')
    .insert([{
      id: created.user.id,
      email,
      profession: profession || null,
      is_pro: !!is_pro
    }])
    .select()
    .single()

  if (insertError) {
    // Le compte Auth a ete cree mais pas la ligne `users` — on le retire
    // pour ne pas laisser un compte orphelin impossible a recreer (meme
    // email bloque par Supabase Auth).
    await supabase.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({ user: row })
}
