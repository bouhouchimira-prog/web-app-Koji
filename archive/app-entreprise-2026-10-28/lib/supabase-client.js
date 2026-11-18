/**
 * Supabase client for server-side API routes
 * Uses service role key for admin operations
 */

const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin = null;

/**
 * Get authenticated Supabase admin client
 */
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing Supabase credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    supabaseAdmin = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  return supabaseAdmin;
}

/**
 * Get user ID from session cookie (from existing auth system)
 * @param {Object} req - Next.js request object
 * @returns {string|null} User ID or null if not authenticated
 */
function getUserIdFromSession(req) {
  const cookie = req.headers.cookie || '';
  const sessionMatch = cookie.match(/koji-session=([^;]+)/);

  if (!sessionMatch) return null;

  // TODO: Verify and decode the session cookie
  // For now, return from query param as before
  return req.query?.userId || req.body?.userId || null;
}

/**
 * Query users by email
 */
async function getUserByEmail(email) {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error; // PGRST116 = no rows
  }

  return data;
}

/**
 * Get all projects for a user
 */
async function getUserProjects(userId) {
  const { data, error } = await getSupabaseAdmin()
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get all quotes for a user
 */
async function getUserQuotes(userId) {
  const { data, error } = await getSupabaseAdmin()
    .from('quotes')
    .select(`
      *,
      quote_items(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get all tasks for a user
 */
async function getUserTasks(userId) {
  const { data, error } = await getSupabaseAdmin()
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get all workers for a user
 */
async function getUserWorkers(userId) {
  const { data, error } = await getSupabaseAdmin()
    .from('workers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get all invoices for a user
 */
async function getUserInvoices(userId) {
  const { data, error } = await getSupabaseAdmin()
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new project
 */
async function createProject(userId, projectData) {
  const { data, error } = await getSupabaseAdmin()
    .from('projects')
    .insert({
      user_id: userId,
      ...projectData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a project
 */
async function updateProject(projectId, projectData) {
  const { data, error } = await getSupabaseAdmin()
    .from('projects')
    .update(projectData)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a project
 */
async function deleteProject(projectId) {
  const { error } = await getSupabaseAdmin()
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Create a new quote
 */
async function createQuote(userId, quoteData) {
  const { data, error } = await getSupabaseAdmin()
    .from('quotes')
    .insert({
      user_id: userId,
      ...quoteData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a quote
 */
async function updateQuote(quoteId, quoteData) {
  const { data, error } = await getSupabaseAdmin()
    .from('quotes')
    .update(quoteData)
    .eq('id', quoteId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a quote
 */
async function deleteQuote(quoteId) {
  const { error } = await getSupabaseAdmin()
    .from('quotes')
    .delete()
    .eq('id', quoteId);

  if (error) throw error;
}

/**
 * Create a new task
 */
async function createTask(userId, taskData) {
  const { data, error } = await getSupabaseAdmin()
    .from('tasks')
    .insert({
      user_id: userId,
      ...taskData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a task
 */
async function updateTask(taskId, taskData) {
  const { data, error } = await getSupabaseAdmin()
    .from('tasks')
    .update(taskData)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marketplace: Get all published offers
 */
async function getMarketplaceOffers(filters = {}) {
  let query = getSupabaseAdmin()
    .from('chantier_offres')
    .select('*')
    .eq('status', 'published');

  if (filters.metier) {
    query = query.ilike('metier', `%${filters.metier}%`);
  }
  if (filters.city) {
    query = query.ilike('city', `%${filters.city}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Marketplace: Get user's own offers
 */
async function getUserOffers(userId) {
  const { data, error } = await getSupabaseAdmin()
    .from('chantier_offres')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Marketplace: Create an offer
 */
async function createOffer(userId, offerData) {
  const { data, error } = await getSupabaseAdmin()
    .from('chantier_offres')
    .insert({
      user_id: userId,
      ...offerData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marketplace: Get messages for an offer
 */
async function getOfferMessages(offerId) {
  const { data, error } = await getSupabaseAdmin()
    .from('marketplace_messages')
    .select(`
      *,
      users:sender_id(first_name, last_name, email)
    `)
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Marketplace: Add message to offer
 */
async function createOfferMessage(offerId, senderId, text) {
  const { data, error } = await getSupabaseAdmin()
    .from('marketplace_messages')
    .insert({
      offer_id: offerId,
      sender_id: senderId,
      text,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marketplace: Request a visite
 */
async function requestVisite(offerId, entrepriseId, consumerId, proposedDatetime, note) {
  const { data, error } = await getSupabaseAdmin()
    .from('chantier_visites')
    .insert({
      offer_id: offerId,
      entreprise_id: entrepriseId,
      consumer_id: consumerId,
      proposed_datetime: proposedDatetime,
      note,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Entreprise: Get all clients
 */
async function getEntrepriseClients(entrepriseId) {
  const { data, error } = await getSupabaseAdmin()
    .from('entreprise_clients')
    .select('*')
    .eq('entreprise_id', entrepriseId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Entreprise: Create a client
 */
async function createEntrepriseClient(entrepriseId, clientData) {
  const { data, error } = await getSupabaseAdmin()
    .from('entreprise_clients')
    .insert({
      entreprise_id: entrepriseId,
      ...clientData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Entreprise: Get team members
 */
async function getEntrepriseTeam(entrepriseId) {
  const { data, error } = await getSupabaseAdmin()
    .from('entreprise_team')
    .select(`
      *,
      users:member_id(first_name, last_name, email)
    `)
    .eq('entreprise_id', entrepriseId);

  if (error) throw error;
  return data || [];
}

/**
 * Entreprise: Get devis
 */
async function getEntrepriseDevis(entrepriseId) {
  const { data, error } = await getSupabaseAdmin()
    .from('devis')
    .select('*')
    .eq('entreprise_id', entrepriseId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Entreprise: Create a devis
 */
async function createDevis(entrepriseId, devisData) {
  const { data, error } = await getSupabaseAdmin()
    .from('devis')
    .insert({
      entreprise_id: entrepriseId,
      ...devisData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  getSupabaseAdmin,
  getUserIdFromSession,
  getUserByEmail,
  getUserProjects,
  getUserQuotes,
  getUserTasks,
  getUserWorkers,
  getUserInvoices,
  createProject,
  updateProject,
  deleteProject,
  createQuote,
  updateQuote,
  deleteQuote,
  createTask,
  updateTask,
  getMarketplaceOffers,
  getUserOffers,
  createOffer,
  getOfferMessages,
  createOfferMessage,
  requestVisite,
  getEntrepriseClients,
  createEntrepriseClient,
  getEntrepriseTeam,
  getEntrepriseDevis,
  createDevis,
};
