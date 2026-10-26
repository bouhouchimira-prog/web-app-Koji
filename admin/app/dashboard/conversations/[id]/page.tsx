import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type ConversationRow = {
  id: string
  kind: 'radar' | 'devis'
  conversation_id: string
  particulier_user_id: string | null
  entreprise_user_id: string | null
  draft_id: string | null
  quote_id: string | null
  turns: { role: 'user' | 'assistant'; text: string }[]
  started_at: string
  updated_at: string
}

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const resolvedParams = await params
  const id = resolvedParams.id

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

  const { data: conversation } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', id)
    .single<ConversationRow>()

  if (!conversation) {
    redirect('/dashboard/conversations')
  }

  const userId = conversation.kind === 'radar' ? conversation.particulier_user_id : conversation.entreprise_user_id

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/conversations"
          className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-[24px] font-bold text-[#0E172C] font-outfit">
            Conversation {conversation.kind === 'radar' ? 'client' : 'entreprise'}
          </h1>
          <p className="text-[13px] text-gray-500 font-medium mt-0.5">
            Démarrée le {new Date(conversation.started_at).toLocaleString('fr-FR')} · {conversation.turns?.length || 0} messages
            {userId ? ` · compte ${userId}` : ''}
            {conversation.quote_id ? ` · devis ${conversation.quote_id}` : ''}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-8 space-y-5 max-w-3xl">
        {(conversation.turns || []).map((turn, index) => (
          <div
            key={index}
            className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3 text-[14px] leading-relaxed whitespace-pre-wrap ${
                turn.role === 'user'
                  ? 'bg-[#0E172C] text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {turn.text}
            </div>
          </div>
        ))}
        {(!conversation.turns || conversation.turns.length === 0) && (
          <p className="text-center text-gray-500 py-8">Conversation vide.</p>
        )}
      </div>
    </div>
  )
}
