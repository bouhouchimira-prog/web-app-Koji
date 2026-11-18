#!/usr/bin/env node

/**
 * Migrate JSON database to Supabase
 * Usage: node scripts/migrate-to-supabase.js
 *
 * Requirements:
 * 1. Set environment variables in .env.local:
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *    - SUPABASE_SERVICE_ROLE_KEY
 *
 * 2. Run Supabase migrations first:
 *    supabase db push
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read JSON database
const dbPath = path.join(__dirname, '../data/koji-db.json');
const rawDb = fs.readFileSync(dbPath, 'utf-8');
const db = JSON.parse(rawDb);

console.log('📦 Starting migration to Supabase...\n');

async function migrate() {
  try {
    // 1. Migrate users
    if (db.users && db.users.length > 0) {
      console.log(`📍 Migrating ${db.users.length} users...`);
      for (const user of db.users) {
        const { error } = await supabase
          .from('users')
          .upsert(
            {
              id: user.id,
              email: user.email,
              password_hash: user.password_hash,
              first_name: user.firstName || user.first_name,
              last_name: user.lastName || user.last_name,
              company_name: user.companyName || user.company_name,
              is_admin: user.isAdmin || false,
              created_at: user.createdAt,
              updated_at: user.updatedAt || new Date().toISOString(),
            },
            { onConflict: 'email' }
          );
        if (error) console.warn('  ⚠️ User error:', error.message);
      }
      console.log('  ✅ Users migrated\n');
    }

    // 2. Migrate projects
    if (db.projects && db.projects.length > 0) {
      console.log(`📍 Migrating ${db.projects.length} projects...`);
      for (const proj of db.projects) {
        const { error } = await supabase
          .from('projects')
          .upsert({
            id: proj.id,
            user_id: proj.userId,
            name: proj.name,
            description: proj.description,
            address: proj.address,
            status: proj.status || 'active',
            created_at: proj.createdAt,
            updated_at: proj.updatedAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Project error:', error.message);
      }
      console.log('  ✅ Projects migrated\n');
    }

    // 3. Migrate quotes
    if (db.quotes && db.quotes.length > 0) {
      console.log(`📍 Migrating ${db.quotes.length} quotes...`);
      for (const quote of db.quotes) {
        const { error } = await supabase
          .from('quotes')
          .upsert({
            id: quote.id,
            user_id: quote.userId,
            project_id: quote.projectId,
            title: quote.title,
            description: quote.description,
            status: quote.status || 'draft',
            total_amount: quote.totalAmount,
            currency: quote.currency || 'EUR',
            created_at: quote.createdAt,
            updated_at: quote.updatedAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Quote error:', error.message);
      }
      console.log('  ✅ Quotes migrated\n');
    }

    // 4. Migrate quote items
    if (db.quoteItems && db.quoteItems.length > 0) {
      console.log(`📍 Migrating ${db.quoteItems.length} quote items...`);
      for (const item of db.quoteItems) {
        const { error } = await supabase
          .from('quote_items')
          .upsert({
            id: item.id,
            quote_id: item.quoteId,
            code: item.code,
            label: item.label,
            unit: item.unit,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
            created_at: item.createdAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Quote item error:', error.message);
      }
      console.log('  ✅ Quote items migrated\n');
    }

    // 5. Migrate tasks
    if (db.tasks && db.tasks.length > 0) {
      console.log(`📍 Migrating ${db.tasks.length} tasks...`);
      for (const task of db.tasks) {
        const { error } = await supabase
          .from('tasks')
          .upsert({
            id: task.id,
            user_id: task.userId,
            project_id: task.projectId,
            quote_id: task.quoteId,
            code: task.code,
            label: task.label,
            status: task.status || 'À faire',
            done: task.done || false,
            due_date: task.dueDate,
            start_date: task.startDate,
            end_date: task.endDate,
            duration_hours: task.durationHours,
            estimated_hours: task.estimatedHours,
            worker_ids: task.workerIds || [],
            assigned_to: task.assignedTo,
            created_at: task.createdAt,
            updated_at: task.updatedAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Task error:', error.message);
      }
      console.log('  ✅ Tasks migrated\n');
    }

    // 6. Migrate workers
    if (db.workers && db.workers.length > 0) {
      console.log(`📍 Migrating ${db.workers.length} workers...`);
      for (const worker of db.workers) {
        const { error } = await supabase
          .from('workers')
          .upsert({
            id: worker.id,
            user_id: worker.userId,
            first_name: worker.firstName,
            last_name: worker.lastName,
            email: worker.email,
            phone: worker.phone,
            trade: worker.trade,
            status: worker.status || 'active',
            created_at: worker.createdAt,
            updated_at: worker.updatedAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Worker error:', error.message);
      }
      console.log('  ✅ Workers migrated\n');
    }

    // 7. Migrate invoices
    if (db.invoices && db.invoices.length > 0) {
      console.log(`📍 Migrating ${db.invoices.length} invoices...`);
      for (const inv of db.invoices) {
        const { error } = await supabase
          .from('invoices')
          .upsert({
            id: inv.id,
            user_id: inv.userId,
            quote_id: inv.quoteId,
            invoice_number: inv.invoiceNumber,
            amount: inv.amount,
            status: inv.status || 'draft',
            due_date: inv.dueDate,
            created_at: inv.createdAt,
            updated_at: inv.updatedAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Invoice error:', error.message);
      }
      console.log('  ✅ Invoices migrated\n');
    }

    // 8. Migrate supplies
    if (db.supplies && db.supplies.length > 0) {
      console.log(`📍 Migrating ${db.supplies.length} supplies...`);
      for (const supply of db.supplies) {
        const { error } = await supabase
          .from('supplies')
          .upsert({
            id: supply.id,
            user_id: supply.userId,
            name: supply.name,
            description: supply.description,
            quantity: supply.quantity,
            unit_price: supply.unitPrice,
            supplier_id: supply.supplierId,
            created_at: supply.createdAt,
            updated_at: supply.updatedAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Supply error:', error.message);
      }
      console.log('  ✅ Supplies migrated\n');
    }

    // 9. Migrate suppliers
    if (db.suppliers && db.suppliers.length > 0) {
      console.log(`📍 Migrating ${db.suppliers.length} suppliers...`);
      for (const supplier of db.suppliers) {
        const { error } = await supabase
          .from('suppliers')
          .upsert({
            id: supplier.id,
            user_id: supplier.userId,
            name: supplier.name,
            contact_name: supplier.contactName,
            email: supplier.email,
            phone: supplier.phone,
            address: supplier.address,
            created_at: supplier.createdAt,
            updated_at: supplier.updatedAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Supplier error:', error.message);
      }
      console.log('  ✅ Suppliers migrated\n');
    }

    // 10. Migrate notifications
    if (db.notifications && db.notifications.length > 0) {
      console.log(`📍 Migrating ${db.notifications.length} notifications...`);
      for (const notif of db.notifications) {
        const { error } = await supabase
          .from('notifications')
          .upsert({
            id: notif.id,
            user_id: notif.userId,
            title: notif.title,
            message: notif.message,
            read: notif.read || false,
            created_at: notif.createdAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Notification error:', error.message);
      }
      console.log('  ✅ Notifications migrated\n');
    }

    // 11. Migrate calendar events
    if (db.calendarEvents && db.calendarEvents.length > 0) {
      console.log(`📍 Migrating ${db.calendarEvents.length} calendar events...`);
      for (const event of db.calendarEvents) {
        const { error } = await supabase
          .from('calendar_events')
          .upsert({
            id: event.id,
            user_id: event.userId,
            title: event.title,
            description: event.description,
            start_time: event.startTime,
            end_time: event.endTime,
            location: event.location,
            created_at: event.createdAt,
            updated_at: event.updatedAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Calendar event error:', error.message);
      }
      console.log('  ✅ Calendar events migrated\n');
    }

    // 12. Migrate project documents
    if (db.projectDocuments && db.projectDocuments.length > 0) {
      console.log(`📍 Migrating ${db.projectDocuments.length} project documents...`);
      for (const doc of db.projectDocuments) {
        const { error } = await supabase
          .from('project_documents')
          .upsert({
            id: doc.id,
            project_id: doc.projectId,
            file_name: doc.fileName,
            file_url: doc.fileUrl,
            created_at: doc.createdAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ Project document error:', error.message);
      }
      console.log('  ✅ Project documents migrated\n');
    }

    // 13. Migrate history
    if (db.history && db.history.length > 0) {
      console.log(`📍 Migrating ${db.history.length} history entries...`);
      for (const entry of db.history) {
        const { error } = await supabase
          .from('history')
          .upsert({
            id: entry.id,
            user_id: entry.userId,
            action: entry.action,
            entity_type: entry.entityType,
            entity_id: entry.entityId,
            changes: entry.changes,
            created_at: entry.createdAt || new Date().toISOString(),
          });
        if (error) console.warn('  ⚠️ History error:', error.message);
      }
      console.log('  ✅ History migrated\n');
    }

    console.log('✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Update your API routes to use Supabase instead of JSON');
    console.log('2. Test all features locally');
    console.log('3. Deploy to production');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
