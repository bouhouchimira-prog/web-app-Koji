import { supabase } from '@/lib/supabaseClient';

export type QuoteStatusKey = 'pending' | 'signed' | 'expired' | 'draft';

export interface QuoteRoom {
  id: string;
  name: string;
  room_order: number;
  tasks: QuoteTask[];
}

export interface QuoteTask {
  id: string;
  label: string;
  unit_price_ht: number | null;
  total_price_ht: number | null;
  inputs: Record<string, unknown> | null;
  note?: string | null;
}

export interface ClientSnapshot {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  [k: string]: unknown;
}

export interface CompanySnapshot {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  siret?: string;
  [k: string]: unknown;
}

export interface QuoteRecord {
  id: string;
  reference: string;
  status: string;
  total_ht: number;
  total_ttc: number;
  tva_rate: number;
  created_at: string;
  updated_at: string;
  client: ClientSnapshot;
  company: CompanySnapshot;
  quoteNumber: string;
  date: string;
  validity: string;
  siteAddress: string;
  signature_url?: string;
  rooms?: QuoteRoom[];
}

interface RawMetadata {
  client?: ClientSnapshot;
  company?: CompanySnapshot;
  quoteNumber?: string;
  date?: string;
  validity?: string;
  siteAddress?: string;
  signature_url?: string;
  [k: string]: unknown;
}

interface RawQuote {
  id: string;
  reference: string | null;
  status: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  tva_rate: number | null;
  created_at: string;
  updated_at: string;
  metadata: RawMetadata | null;
}

function mapQuote(row: RawQuote): QuoteRecord {
  const meta = row.metadata || {};
  return {
    id: row.id,
    reference: row.reference || meta.quoteNumber || 'N/A',
    status: row.status || 'Draft',
    total_ht: Number(row.total_ht || 0),
    total_ttc: Number(row.total_ttc || 0),
    tva_rate: Number(row.tva_rate || 20),
    created_at: row.created_at,
    updated_at: row.updated_at,
    client: meta.client || {},
    company: meta.company || {},
    quoteNumber: meta.quoteNumber || row.reference || 'N/A',
    date: meta.date || '',
    validity: meta.validity || '',
    siteAddress: meta.siteAddress || '',
    signature_url: meta.signature_url,
  };
}

export function classifyStatus(s: string): QuoteStatusKey {
  const x = (s || '').toLowerCase();
  if (x === 'signed' || x === 'accepted' || x === 'validated' || x.includes('sign') || x.includes('accept')) return 'signed';
  if (x === 'expired' || x.includes('expir')) return 'expired';
  if (x === 'draft') return 'draft';
  return 'pending';
}

export async function fetchUserQuotes(userId: string): Promise<QuoteRecord[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as RawQuote[] | null)?.map(mapQuote) ?? [];
}

/**
 * Fetch every devis addressed to a CLIENT, matched by the client's email.
 *
 * A client account never owns quotes — `quotes.user_id` is the *entreprise*
 * owner. The client is linked only by the email the entreprise typed into
 * `chantiers.client_email` when creating the chantier. Quotes attach to a
 * chantier via `quotes.chantier_id`, so a client finds their devis by:
 *   1. selecting the chantiers whose `client_email` == their login email,
 *   2. loading every quote attached to those chantiers.
 *
 * NOTE: the dashboard previously called `fetchUserQuotes(user.id)`, which
 * filtered by `user_id` and therefore returned NOTHING for a client. This is
 * the correct, email-scoped replacement. Reading the matching rows requires the
 * client RLS policies (see koji-main/supabase/client_access.sql); without them
 * this resolves to an empty list rather than throwing.
 */
export async function fetchClientQuotesByEmail(email: string): Promise<QuoteRecord[]> {
  const clientEmail = (email || '').trim().toLowerCase();
  if (!clientEmail) return [];

  // 1. Chantiers addressed to this client (case-insensitive email match).
  const { data: chantiers, error: chantierError } = await supabase
    .from('chantiers')
    .select('id')
    .ilike('client_email', clientEmail);

  if (chantierError) throw chantierError;

  const chantierIds = (chantiers as Array<{ id: string }> | null)?.map((c) => c.id) ?? [];
  if (chantierIds.length === 0) return [];

  // 2. Quotes attached to those chantiers.
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .in('chantier_id', chantierIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as RawQuote[] | null)?.map(mapQuote) ?? [];
}

// ── Works follow-up (chantier_tasks) ─────────────────────────────────────────

export interface ChantierTask {
  id: string;
  label: string;
  /** Manual checklist tasks carry a done flag; devis tasks never do. */
  is_done: boolean;
  /** Room name when the task comes from the devis (quote_rooms.name). */
  room_name?: string;
  /** true when the task comes from the devis (quote_tasks), false if manual. */
  from_devis: boolean;
}

/** One chantier's works, with a completion ratio for the progress bar. */
export interface ChantierProgress {
  chantierId: string;
  reference: string;
  tasks: ChantierTask[];
  done: number;
  total: number;
  /** 0..1 */
  progress: number;
}

/**
 * The works for every chantier addressed to this client, grouped per chantier.
 *
 * Mirrors koji-main's "À faire" model (chantierAFaireTasksProvider): the tasks
 * are the DEVIS tasks (quotes -> quote_rooms -> quote_tasks), with the manual
 * chantier_tasks checklist merged in and de-duplicated by label. Devis tasks
 * have no is_done in koji-main, so the completion % is computed only from the
 * manual chantier_tasks that are marked done.
 *
 * Matched by email exactly like the devis (chantiers.client_email). Requires the
 * client RLS policies; without them this returns an empty list.
 */
export async function fetchClientTasksByEmail(email: string): Promise<ChantierProgress[]> {
  const clientEmail = (email || '').trim().toLowerCase();
  if (!clientEmail) return [];

  const { data: chantiers, error: chantierError } = await supabase
    .from('chantiers')
    .select('id, reference')
    .ilike('client_email', clientEmail);
  if (chantierError) throw chantierError;

  const rows = (chantiers as Array<{ id: string; reference: string | null }> | null) ?? [];
  if (rows.length === 0) return [];

  const result: ChantierProgress[] = [];
  for (const c of rows) {
    const tasks = await tasksForChantier(c.id);
    const manual = tasks.filter((t) => !t.from_devis);
    // koji-main shows a checkbox/progress only on the manual checklist; devis
    // tasks have no completion state. Base the % on the manual tasks; if there
    // are none, fall back to "0 of N devis tasks" so the card still renders.
    const total = manual.length > 0 ? manual.length : tasks.length;
    const done = manual.filter((t) => t.is_done).length;
    result.push({
      chantierId: c.id,
      reference: c.reference || 'Chantier',
      tasks,
      done,
      total,
      progress: total === 0 ? 0 : done / total,
    });
  }
  return result;
}

/**
 * Devis tasks (quote_rooms -> quote_tasks) for a chantier, plus the manual
 * chantier_tasks, merged and de-duped by label — the same merge koji-main's
 * chantierAFaireTasksProvider performs.
 */
async function tasksForChantier(chantierId: string): Promise<ChantierTask[]> {
  // Devis tasks: take the newest quote on this chantier that actually has tasks.
  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, created_at')
    .eq('chantier_id', chantierId)
    .order('created_at', { ascending: false });

  const devisTasks: ChantierTask[] = [];
  for (const q of (quotes as Array<{ id: string }> | null) ?? []) {
    const { data: roomsData } = await supabase
      .from('quote_rooms')
      .select('id, name, room_order, quote_tasks(id, label, created_at)')
      .eq('quote_id', q.id)
      .order('room_order', { ascending: true });

    const rooms =
      (roomsData as Array<{
        id: string;
        name: string | null;
        quote_tasks: Array<{ id: string; label: string | null }> | null;
      }> | null) ?? [];

    for (const room of rooms) {
      for (const t of room.quote_tasks ?? []) {
        devisTasks.push({
          id: t.id,
          label: t.label || 'Tâche',
          is_done: false,
          room_name: room.name || undefined,
          from_devis: true,
        });
      }
    }
    // First (newest) quote that has tasks wins — same rule as koji-main.
    if (devisTasks.length > 0) break;
  }

  // Manual chantier_tasks checklist.
  const { data: manualData } = await supabase
    .from('chantier_tasks')
    .select('id, label, is_done, created_at')
    .eq('chantier_id', chantierId)
    .order('created_at', { ascending: true });

  const seen = new Set(devisTasks.map((t) => t.label.trim().toLowerCase()));
  const merged: ChantierTask[] = [...devisTasks];
  for (const t of (manualData as Array<{ id: string; label: string | null; is_done: boolean }> | null) ?? []) {
    const label = (t.label || '').trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    merged.push({ id: t.id, label, is_done: t.is_done, from_devis: false });
  }
  return merged;
}

export async function fetchQuoteById(quoteId: string): Promise<QuoteRecord | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const quote = mapQuote(data as RawQuote);

  const { data: rooms } = await supabase
    .from('quote_rooms')
    .select('id, name, room_order, quote_tasks(id, label, unit_price_ht, total_price_ht, inputs, note)')
    .eq('quote_id', quoteId)
    .order('room_order', { ascending: true });

  if (rooms) {
    quote.rooms = (rooms as Array<{ id: string; name: string; room_order: number; quote_tasks: QuoteTask[] }>).map((r) => ({
      id: r.id,
      name: r.name,
      room_order: r.room_order,
      tasks: r.quote_tasks || [],
    }));
  }

  return quote;
}

export async function submitSignature(params: {
  quoteId: string;
  userId: string;
  clientName: string;
  signatureDataUrl: string;
}): Promise<string> {
  const { quoteId, userId, clientName, signatureDataUrl } = params;

  const blob = await (await fetch(signatureDataUrl)).blob();
  const fileName = `${quoteId}_signature_${Date.now()}.png`;
  const path = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('signatures')
    .upload(path, blob, { contentType: 'image/png', upsert: false });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from('signatures').getPublicUrl(path);
  const fileUrl = pub.publicUrl;

  const { error: insertError } = await supabase.from('signatures').insert({
    user_id: userId,
    quote_id: quoteId,
    client_name: clientName,
    signature_url: fileUrl,
  });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from('quotes')
    .update({ status: 'signed', updated_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (updateError) throw updateError;

  return fileUrl;
}

export async function fetchSignatureForQuote(quoteId: string): Promise<string | null> {
  const { data } = await supabase
    .from('signatures')
    .select('signature_url')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.signature_url ?? null;
}
