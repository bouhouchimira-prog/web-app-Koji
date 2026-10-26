import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { Quote, QuoteStatus } from '@/types';
import { supabase } from '@/lib/supabaseClient';

interface ClientUser {
  id: string;
  name: string;
  email: string;
  company: string;
}

interface ClientState {
  isAuthenticated: boolean;
  authReady: boolean;
  user: ClientUser | null;
  quotes: Quote[];
  isLoading: boolean;
  error: string | null;
  initAuth: () => Promise<void>;
  setUserFromSession: (sessionUser: User | null) => void;
  logout: () => Promise<void>;
  fetchQuote: (id: string, email?: string) => Promise<void>;
  updateQuoteStatus: (id: string, status: QuoteStatus, signature?: string) => Promise<void>;
  updateQuoteStartDate: (id: string, date: string) => Promise<void>;
  addQuoteMessage: (id: string, text: string, files: File[]) => Promise<void>;
}

export const useClientStore = create<ClientState>((set, get) => ({
  isAuthenticated: false,
  authReady: false,
  user: null,
  quotes: [],
  isLoading: false,
  error: null,

  setUserFromSession: (sessionUser) => {
    if (!sessionUser) {
      set({ isAuthenticated: false, user: null, authReady: true });
      return;
    }
    const meta = sessionUser.user_metadata || {};
    set({
      isAuthenticated: true,
      authReady: true,
      user: {
        id: sessionUser.id,
        email: sessionUser.email || '',
        name: meta.name || sessionUser.email?.split('@')[0] || 'Client',
        company: meta.company || '',
      },
    });
  },

  initAuth: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      get().setUserFromSession(data.session?.user ?? null);
    } catch (e) {
      console.warn('initAuth getSession failed', e);
      get().setUserFromSession(null);
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      get().setUserFromSession(session?.user ?? null);
    });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ isAuthenticated: false, user: null });
  },

  fetchQuote: async (id: string, email?: string) => {
    set({ isLoading: true, error: null });
    try {
      // Always go through the RPC. It authorizes by id+email when email is provided,
      // and by id alone (unguessable UUID) when it is empty — which matches links
      // generated before client email was reliably attached.
      const response = await supabase.rpc('get_quote_for_client', {
        p_quote_id: id,
        p_email: email ?? ''
      });

      let data = response.data;
      const error = response.error;

      if (Array.isArray(data)) {
        data = data[0];
      }


      if (error) throw error;
      if (!data) throw new Error("Quote not found or access denied.");

      // Fetch messages from API
      let comments = [];
      try {
        const msgRes = await fetch(`/api/quotes/${id}/messages`);
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          comments = msgData.map((msg: any) => ({
            id: msg.id,
            text: msg.text,
            author: msg.author_name || 'Inconnu',
            author_email: msg.author_email,
            date: msg.created_at,
            attachments: (msg.attachments || []).map((att: any) => ({
              id: att.id,
              bucket_id: att.bucket_id,
              file_path: att.file_path,
              mime_type: att.mime_type,
              file_size: att.file_size,
              original_name: att.original_name,
              signedUrl: att.signedUrl
            }))
          }));
        }
      } catch (e) {
        console.error("Failed to fetch messages", e);
      }

      const metadata = data.metadata || {};
      const client = metadata.client || {};
      let items: any[] = [];
      
      if (data.quote_rooms && data.quote_rooms.length > 0) {
        data.quote_rooms.forEach((room: any) => {
          if (room.quote_tasks && room.quote_tasks.length > 0) {
            room.quote_tasks.forEach((task: any) => {
              // The generator stores the per-unit labour price in unit_price_ht
              // and the per-unit materials price in total_price_ht. The line's
              // unit price is the sum of the two; the line total is unit × qty.
              // (For a "forfait" line, the whole flat price rides in
              // unit_price_ht at quantity 1, so the same maths still holds.)
              const inputs = task.inputs || {};
              const qty = Number(inputs.quantity ?? task.quantity ?? 1) || 1;
              const moUnit = Number(task.unit_price_ht || 0);
              const fournUnit = Number(task.total_price_ht || 0);
              const unitPrice = moUnit + fournUnit;
              const taux = Number(inputs.tauxHoraire || 0);
              const coeff = Number(inputs.conditionCoeff || 1) || 1;
              items.push({
                id: task.id || task.task_id,
                description: task.label || task.task_name || 'Tâche',
                quantity: qty,
                unitPrice,
                unit: inputs.unite || inputs.unit || 'u',
                room: room.name || undefined,
                famille: inputs.famille || undefined,
                code: inputs.code || undefined,
                forfait: Boolean(inputs.forfaitEnabled) || (fournUnit === 0 && qty === 1 && !inputs.hours),
                moUnitPrice: moUnit,
                fournituresUnitPrice: fournUnit,
                hours: Number(inputs.hours || 0),
                effectiveRate: taux * coeff,
              });
            });
          }
        });
      } else if (data.items && Array.isArray(data.items)) {
        items = data.items;
      } else if (metadata.expenses) {
        Object.values(metadata.expenses).forEach((roomItems: any) => {
          if (Array.isArray(roomItems)) {
            roomItems.forEach((item: any) => {
              items.push({
                id: item.id || '',
                description: item.title || item.label || 'Tâche',
                quantity: item.quantity || 1,
                unitPrice: (item.laborCost || 0) + (item.materialCost || 0),
              });
            });
          }
        });
      }

      // Resolve the real totals computed by the generator. The HT/TTC values are
      // stored explicitly on the quote, so we must NOT re-derive TVA from a single
      // "total" field (the old bug treated TTC as HT and applied 20% again).
      const lineSum = items.reduce(
        (s: number, it: any) => s + Number(it.quantity || 0) * Number(it.unitPrice || 0),
        0
      );
      const tvaRate = Number(data.tva_rate ?? metadata.tva_rate ?? 20) || 20;
      // Prefer stored HT; fall back to the sum of the lines we just built.
      const totalHT = Number(data.total_ht ?? metadata.total_ht ?? 0) || lineSum;
      // Prefer stored TTC; otherwise derive it from HT and the VAT rate.
      const totalTTC =
        Number(data.total_ttc ?? metadata.total_ttc ?? 0) ||
        totalHT * (1 + tvaRate / 100);

      const company = metadata.company || {};
      const mappedQuote: Quote = {
        id: data.id,
        // Handle both camelCase (from accessors/views) and snake_case (raw tables)
        clientName: client.name || data.client_name || data.clientName || 'Client Inconnu',
        clientEmail: client.email || data.client_email || data.clientEmail || '',
        company: {
          name: company.name || '',
          email: company.email || '',
          phone: company.phone || '',
          address: company.address || '',
          siret: company.siret || '',
          rcs: company.rcs || '',
          tva: company.tva || '',
          formeJuridique: company.formeJuridique || '',
          capital: company.capital || '',
          iban: company.iban || '',
          bic: company.bic || '',
          logo: company.logo || '',
        },
        quoteNumber: metadata.quoteNumber || data.reference || '',
        version: metadata.version ? String(metadata.version) : '01',
        projectTitle: metadata.siteAddress || data.project_title || data.projectTitle || 'Projet Koji',
        status: data.status,
        issuedDate: metadata.date || data.created_at || data.issuedDate,
        validUntil: metadata.validity || data.valid_until || data.validUntil || 'N/A',
        startDate: data.start_date || data.startDate,
        items: items,
        totalHT,
        totalTTC,
        tvaRate,
        // Keep `total` as TTC for any legacy reader.
        total: totalTTC,
        signature: data.signature_data || data.signature,
        signedAt: data.signed_at || data.signedAt,
        comments: comments
      };
      set({ quotes: [mappedQuote] });

    } catch (err: any) {
      console.error('Error fetching quote:', err);
      let errorMessage = 'An error occurred';

      if (typeof err === 'object' && err !== null) {
        if ('message' in err) {
          errorMessage = err.message;
        } else if ('error_description' in err) {
          errorMessage = err.error_description;
        } else {
          errorMessage = JSON.stringify(err);
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      set({ error: errorMessage });
    } finally {
      set({ isLoading: false });
    }
  },

  updateQuoteStatus: async (id, status, signature) => {
    const currentQuote = useClientStore.getState().quotes.find(q => q.id === id);

    set((state) => ({
      quotes: state.quotes.map((q) =>
        q.id === id
          ? { ...q, status: signature ? 'accepte' : status, signature, signedAt: signature ? new Date().toISOString() : undefined }
          : q
      ),
    }));

    try {
      if (signature) {
        // Use the secure RPC function for signature submission.
        // The RPC accepts an empty email and falls back to id-only authorization.
        const { data, error } = await supabase.rpc('submit_quote_signature', {
          p_quote_id: id,
          p_email: currentQuote?.clientEmail || '',
          p_signature_data: signature
        });

        if (error) {
          console.error("RPC Error:", error);
          throw error;
        }

        console.log("Signature submitted successfully:", data);
      } else {
        // Direct update for rejection (no signature)
        const { error } = await supabase
          .from('quotes')
          .update({ status })
          .eq('id', id);

        if (error) throw error;
      }
    } catch (error) {
      console.error("Failed to update status in Supabase", error);
    }
  },

  updateQuoteStartDate: async (id, date) => {
    set((state) => ({
      quotes: state.quotes.map((q) =>
        q.id === id ? { ...q, startDate: date } : q
      ),
    }));
    try {
      await supabase.from('quotes').update({
        start_date: date
      }).eq('id', id);
    } catch (error) {
      console.error("Failed to update start date", error);
    }
  },

  addQuoteMessage: async (id, text, files) => {
    try {
      const { user } = get();
      const formData = new FormData();
      formData.append('text', text);
      formData.append('authorName', user?.name || 'Client');
      formData.append('authorEmail', user?.email || '');

      files.forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch(`/api/quotes/${id}/messages`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to send message');

      const newMessage = await res.json();

      // Map back to local state format
      const mappedMessage = {
        id: newMessage.id,
        text: newMessage.text,
        author: newMessage.author_name,
        date: newMessage.created_at,
        attachments: (newMessage.attachments || []).map((att: any) => ({
          id: att.id,
          bucket_id: att.bucket_id,
          file_path: att.file_path,
          mime_type: att.mime_type,
          file_size: att.file_size,
          original_name: att.original_name,
          signedUrl: att.signedUrl
        }))
      };

      set((state) => ({
        quotes: state.quotes.map((q) =>
          q.id === id
            ? { ...q, comments: [...(q.comments || []), mappedMessage] }
            : q
        ),
      }));
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  },
}));

export const initializeQuotes = (quotes: Quote[]) => {
  useClientStore.setState({ quotes });
}
