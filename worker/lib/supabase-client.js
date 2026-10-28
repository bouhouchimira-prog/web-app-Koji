/**
 * Supabase client for worker app
 */

const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase credentials');
    }

    supabaseAdmin = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  return supabaseAdmin;
}

/**
 * Get worker by email
 */
async function getWorkerByEmail(email) {
  const { data, error } = await getSupabaseAdmin()
    .from('workers')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

/**
 * Get worker by ID
 */
async function getWorkerById(workerId) {
  const { data, error } = await getSupabaseAdmin()
    .from('workers')
    .select('*')
    .eq('id', workerId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all tasks assigned to worker
 */
async function getWorkerTasks(workerId) {
  const { data, error } = await getSupabaseAdmin()
    .from('tasks')
    .select(`
      *,
      projects:project_id(name, address),
      quotes:quote_id(title, total_amount)
    `)
    .contains('worker_ids', [workerId])
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get single task detail
 */
async function getTaskById(taskId) {
  const { data, error } = await getSupabaseAdmin()
    .from('tasks')
    .select(`
      *,
      projects:project_id(name, address),
      quotes:quote_id(title, total_amount)
    `)
    .eq('id', taskId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update task status
 */
async function updateTaskStatus(taskId, status, done = false) {
  const { data, error } = await getSupabaseAdmin()
    .from('tasks')
    .update({
      status,
      done,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get worker calendar events
 */
async function getWorkerCalendarEvents(workerId) {
  const { data, error } = await getSupabaseAdmin()
    .from('calendar_events')
    .select('*')
    .eq('user_id', workerId)
    .gte('end_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data || [];
}

module.exports = {
  getSupabaseAdmin,
  getWorkerByEmail,
  getWorkerById,
  getWorkerTasks,
  getTaskById,
  updateTaskStatus,
  getWorkerCalendarEvents,
};
