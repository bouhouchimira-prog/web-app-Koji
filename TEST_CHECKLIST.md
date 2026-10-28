# Testing Checklist

Complete testing guide before production deployment.

---

## 🔧 Setup Local Testing

### 1. Supabase Credentials

**Create `.env.local` at koji-web root:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

Get these from: https://app.supabase.com → Project Settings → API

### 2. Install Dependencies

```bash
npm install
npm install -g supabase
cd worker && npm install && cd ..
```

### 3. Supabase Local Setup

```bash
# Initialize (if not done)
supabase init

# Link to your project
supabase link --project-ref xxxxx

# Push migrations
supabase db push

# Verify tables created
supabase db list
```

Expected tables:
- users
- workers
- tasks
- projects (chantiers)
- quotes
- invoices
- chantier_offres (marketplace)
- marketplace_messages
- chantier_visites
- entreprise_clients
- entreprise_team
- devis

### 4. Migrate Data (Optional)

If you have existing JSON data:

```bash
node scripts/migrate-to-supabase.js
```

Expected output:
```
📦 Starting migration...
📍 Migrating X users...
  ✅ Users migrated
📍 Migrating X projects...
  ✅ Projects migrated
... (more tables) ...
✅ Migration complete!
```

---

## 🧪 Test Main App

### Start Dev Server

```bash
npm run dev
# Visit http://localhost:3000
```

### Test Authentication

- [ ] Login with existing user credentials
- [ ] Session cookie stored (check DevTools → Application → Cookies)
- [ ] Logout clears session
- [ ] Redirect to login on expired session

### Test Projects

```bash
# Test GET /api/projects
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/projects
```

Expected:
- [ ] Returns user's projects from Supabase (not JSON file)
- [ ] Only shows projects for authenticated user (RLS working)
- [ ] Response format matches frontend expectations

### Test Quotes

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/quotes
```

- [ ] Returns user's quotes
- [ ] Includes quote items (nested)
- [ ] RLS prevents seeing other users' quotes

### Test Dashboard

- [ ] Projects list loads
- [ ] Quotes list loads
- [ ] Can create new project
- [ ] Can create new quote
- [ ] Can view project details
- [ ] Can edit project
- [ ] Can delete project

---

## 👷 Test Worker App

### Start Worker Server

```bash
cd worker
npm run dev
# Visit http://localhost:3000 (or configured port)
```

### Test Login

**Create test worker in Supabase first:**

```sql
-- Run in Supabase SQL Editor
INSERT INTO workers (first_name, last_name, email, password_hash, trade, status)
VALUES (
  'Jean',
  'Dupont',
  'jean@example.com',
  '...',  -- SHA256 hash of password (see below)
  'Plombier',
  'active'
);
```

Generate password hash:
```bash
node -e "console.log(require('crypto').createHash('sha256').update('password123').digest('hex'))"
```

**Test Login:**

- [ ] Go to http://localhost:3000/login
- [ ] Enter email and password
- [ ] Successfully authenticates
- [ ] Redirected to dashboard
- [ ] Token stored in localStorage

### Test Dashboard

- [ ] Dashboard shows "Bienvenue, [Name]"
- [ ] Assigned tasks display
- [ ] Can click "Voir détails" on a task

### Test Task API

```bash
# Get tasks for worker
curl http://localhost:3000/api/worker/tasks?workerId=WORKER_ID

# Get single task
curl http://localhost:3000/api/worker/tasks/TASK_ID

# Update task status
curl -X PATCH http://localhost:3000/api/worker/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status":"En cours","done":false}'
```

Expected:
- [ ] GET /tasks returns array of tasks
- [ ] GET /tasks/[id] returns single task with project details
- [ ] PATCH /tasks/[id] updates task status in Supabase
- [ ] Status updates immediately

---

## 🔐 Test Security

### Row Level Security (RLS)

**Test 1: User A cannot see User B's data**

```bash
# Login as User A, get their projects
TOKEN_A=$(curl -X POST http://localhost:3000/api/auth/login ...)
curl -H "Bearer $TOKEN_A" http://localhost:3000/api/projects
# Should only show User A's projects

# Try to query User B's data
curl -H "Bearer $TOKEN_A" "http://localhost:3000/api/projects?userId=USER_B_ID"
# Should return empty or 403 (RLS enforced by Supabase)
```

- [ ] RLS prevents cross-user data access
- [ ] Returns empty array, not error

**Test 2: Invalid token rejected**

```bash
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:3000/api/projects
```

- [ ] Returns 401 or empty data
- [ ] No sensitive info leaked

**Test 3: Missing auth returns nothing**

```bash
curl http://localhost:3000/api/projects
```

- [ ] Returns empty array (safe default)
- [ ] Not 500 error

---

## 📊 Test Data Integrity

### Verify Database

```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM workers;
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM projects;

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;
```

Expected:
- [ ] Row security is true for all tables
- [ ] Data counts match expectations
- [ ] No orphaned records

---

## ⚡ Performance Tests

### Response Times

```bash
time curl http://localhost:3000/api/projects
```

Target:
- [ ] < 200ms for list queries
- [ ] < 500ms for heavy joins

### Concurrent Requests

```bash
# Test 10 parallel requests
for i in {1..10}; do
  curl -s http://localhost:3000/api/projects &
done
wait
```

- [ ] All succeed (no rate limits hit)
- [ ] No connection pool errors

---

## 🚀 Pre-Production Checklist

- [ ] Supabase project created
- [ ] All migrations run (`supabase db push`)
- [ ] Data migrated from JSON (if applicable)
- [ ] Main app tests pass
- [ ] Worker app tests pass
- [ ] Security tests pass
- [ ] No console errors
- [ ] Credentials in environment (not hardcoded)
- [ ] RLS policies verified
- [ ] CORS headers correct
- [ ] Error handling works

---

## 📝 Notes

- Keep `.env.local` out of git (use `.env.example`)
- Test tokens expire: refresh before retesting
- Worker needs tasks assigned in tasks table with their ID in worker_ids array
- Passwords stored as SHA256 (TODO: upgrade to bcrypt before production)

---

## ❓ Troubleshooting

### "Missing Supabase credentials"

```bash
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

Restart dev server after updating `.env.local`

### "No such table"

```bash
supabase db push
```

Re-run migrations.

### "Permission denied" (RLS)

Ensure token is valid and user has permissions:
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'projects';
```

### Worker login fails

Check password hash:
```bash
node -e "console.log(require('crypto').createHash('sha256').update('TEST_PASSWORD').digest('hex'))"
```

Compare with value in database.

---

## Next Steps

1. ✅ Complete all checklist items
2. ✅ Fix any failures
3. ✅ Document any custom setup needed
4. 🚀 Ready for production deployment
