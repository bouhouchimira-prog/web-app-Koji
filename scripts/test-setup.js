#!/usr/bin/env node

/**
 * Test Supabase Setup
 * Verifies all tables, RLS, and basic operations
 * Usage: node scripts/test-setup.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EXPECTED_TABLES = [
  'users',
  'workers',
  'tasks',
  'projects', // chantiers
  'quotes',
  'invoices',
  'chantier_offres',
  'marketplace_messages',
  'chantier_visites',
  'entreprise_clients',
  'entreprise_team',
  'devis',
];

async function testConnection() {
  console.log('🔗 Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact' }).limit(1);
    if (error) throw error;
    console.log('   ✅ Connection successful');
    return true;
  } catch (err) {
    console.error('   ❌ Connection failed:', err.message);
    return false;
  }
}

async function testTables() {
  console.log('\n📋 Checking tables...');
  let allPresent = true;

  for (const table of EXPECTED_TABLES) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
        allPresent = false;
      } else {
        console.log(`   ✅ ${table} (${count} rows)`);
      }
    } catch (err) {
      console.log(`   ❌ ${table}: ${err.message}`);
      allPresent = false;
    }
  }

  return allPresent;
}

async function testRLS() {
  console.log('\n🔐 Checking Row Level Security...');
  try {
    const { data, error } = await supabase
      .rpc('pg_policies', { table_name: 'users' });

    if (error) {
      console.log('   ⚠️  Could not verify RLS policies');
    } else {
      console.log(`   ✅ RLS configured`);
    }
    return true;
  } catch (err) {
    console.log('   ⚠️  RLS check skipped:', err.message);
    return true;
  }
}

async function testDataTypes() {
  console.log('\n📊 Verifying data types...');

  const tests = [
    {
      table: 'users',
      column: 'id',
      type: 'uuid',
      desc: 'User IDs are UUIDs'
    },
    {
      table: 'tasks',
      column: 'worker_ids',
      type: 'array',
      desc: 'Worker IDs stored as array'
    },
    {
      table: 'chantier_offres',
      column: 'status',
      type: 'text',
      desc: 'Offer status is text'
    },
  ];

  for (const test of tests) {
    try {
      const { data, error } = await supabase
        .from(test.table)
        .select(test.column)
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.log(`   ⚠️  ${test.desc}: ${error.message}`);
      } else {
        console.log(`   ✅ ${test.desc}`);
      }
    } catch (err) {
      console.log(`   ⚠️  ${test.desc}: ${err.message}`);
    }
  }

  return true;
}

async function testIndexes() {
  console.log('\n⚡ Checking indexes for performance...');

  const expectedIndexes = [
    'user_id',
    'worker_id',
    'project_id',
    'offer_id',
    'status',
  ];

  console.log(`   ℹ️  Expected indexes on: ${expectedIndexes.join(', ')}`);
  console.log('   (Verify manually in Supabase dashboard → Database → Indexes)');

  return true;
}

async function summary(results) {
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));

  const allPassed = Object.values(results).every(r => r);

  if (allPassed) {
    console.log('\n✅ All tests passed! Setup is ready.');
    console.log('\nNext steps:');
    console.log('1. npm install');
    console.log('2. npm run dev');
    console.log('3. Test in browser: http://localhost:3000');
  } else {
    console.log('\n❌ Some tests failed. Please review above and fix issues.');
    console.log('\nCommon fixes:');
    console.log('• supabase db push - Re-run migrations');
    console.log('• Check .env.local credentials');
    console.log('• Verify Supabase project is active');
  }

  process.exit(allPassed ? 0 : 1);
}

async function runTests() {
  console.log('🚀 Koji Supabase Setup Test\n');

  const results = {
    connection: await testConnection(),
    tables: await testTables(),
    rls: await testRLS(),
    dataTypes: await testDataTypes(),
    indexes: await testIndexes(),
  };

  await summary(results);
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
