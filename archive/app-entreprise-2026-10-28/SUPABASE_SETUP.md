# Supabase Setup Guide for Koji

Complete instructions to set up Supabase and migrate your JSON database.

---

## 1️⃣ INSTALL SUPABASE CLI

```bash
npm install -g supabase
```

Verify installation:
```bash
supabase --version
```

---

## 2️⃣ CREATE SUPABASE PROJECT

1. Go to https://supabase.com
2. Sign in or create account
3. Create a new project:
   - Project name: `Koji` (or your preference)
   - Region: Choose closest to you (EU: Frankfurt, US: Virginia)
   - Database password: Save securely
4. Wait for project to initialize (~2 minutes)

---

## 3️⃣ GET CREDENTIALS

Once your project is created, go to **Project Settings** → **API**:

Copy these values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

⚠️ **IMPORTANT**: Keep `SUPABASE_SERVICE_ROLE_KEY` secret — never expose in frontend code.

---

## 4️⃣ INITIALIZE SUPABASE LOCALLY

```bash
supabase init
```

This creates `supabase/` directory for your migrations.

---

## 5️⃣ LINK TO YOUR PROJECT

```bash
supabase link --project-ref xxxxx
```

Get your project ref from Supabase dashboard URL: `https://app.supabase.com/project/xxxxx/...`

Provide the database password when prompted.

---

## 6️⃣ PUSH MIGRATIONS TO SUPABASE

```bash
supabase db push
```

This runs the SQL migrations in `supabase/migrations/001_init_schema.sql`:
- Creates all tables
- Sets up indexes
- Configures Row Level Security (RLS)

**Expected output:**
```
✓ Running migrations...
  001_init_schema.sql
✓ Migrations applied
```

---

## 7️⃣ INSTALL DEPENDENCIES

Add Supabase package:

```bash
npm install @supabase/supabase-js
```

---

## 8️⃣ MIGRATE JSON DATA TO SUPABASE

```bash
node scripts/migrate-to-supabase.js
```

**What it does:**
- Reads `data/koji-db.json`
- Inserts all users, projects, quotes, tasks, etc. into Supabase
- Preserves all existing data
- Reports progress for each table

**Expected output:**
```
📦 Starting migration to Supabase...

📍 Migrating 5 users...
  ✅ Users migrated

📍 Migrating 12 projects...
  ✅ Projects migrated

... (more tables) ...

✅ Migration complete!
```

---

## 9️⃣ UPDATE API ROUTES

Your existing routes currently use `lib/db.js` (JSON file).

New Supabase client is ready at `lib/supabase-client.js` with these functions:

```javascript
// Example: Get all projects for user
const { getUserProjects } = require('@/lib/supabase-client');
const projects = await getUserProjects(userId);
```

**Example API route (before → after):**

**Before (JSON):**
```javascript
// app/api/projects/route.js
const { scopedItems } = require('@/lib/db');

export async function GET(req) {
  const userId = req.query.userId;
  const projects = scopedItems(db.projects, userId);
  return Response.json(projects);
}
```

**After (Supabase):**
```javascript
// app/api/projects/route.js
const { getUserProjects } = require('@/lib/supabase-client');

export async function GET(req) {
  const userId = req.query.userId;
  const projects = await getUserProjects(userId);
  return Response.json(projects);
}
```

---

## 🔟 UPDATE .GITIGNORE

Keep your local Supabase data private:

```bash
# .gitignore
supabase/.branches
supabase/.temp
data/koji-db.json  # Keep JSON backup but don't commit
```

---

## 1️⃣1️⃣ TEST LOCALLY

```bash
npm run dev
```

Visit your app:
- Projects should load from Supabase ✅
- Creating new projects should work ✅
- Editing should persist to database ✅
- Multi-user data isolation via RLS ✅

---

## 1️⃣2️⃣ VERIFY DATA IN SUPABASE

Go to Supabase dashboard → **SQL Editor**:

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM quotes;
```

Should show your migrated data.

---

## 1️⃣3️⃣ DEPLOY TO PRODUCTION

### Option A: Supabase Hosted (Recommended)

1. No additional steps needed — your project is already live at `https://xxxxx.supabase.co`
2. Just deploy your Next.js app to Vercel/production

### Option B: Self-Hosted PostgreSQL

If you prefer to host PostgreSQL yourself:
1. Create a PostgreSQL database
2. Run migrations on your database
3. Update `NEXT_PUBLIC_SUPABASE_URL` to your instance

---

## 🔐 SECURITY CHECKLIST

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local` (not `.env.public`)
- [ ] RLS policies are enabled on all tables
- [ ] Test that users can only see their own data
- [ ] API routes verify `userId` from session cookie
- [ ] Never trust userId from query params (always from session)

---

## ⚠️ TROUBLESHOOTING

### "Missing Supabase credentials"

Ensure `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

And restart `npm run dev`.

### Migration script fails

Check:
1. Credentials are correct
2. Database migrations ran successfully (`supabase db push`)
3. JSON file exists at `data/koji-db.json`
4. Run with more details: `DEBUG=* node scripts/migrate-to-supabase.js`

### RLS blocks my queries

If queries return empty:
1. Check RLS policies in Supabase dashboard → **SQL Editor**
2. Ensure policies allow your user's ID
3. Verify `auth.uid()` is being set correctly

---

## 📝 NEXT STEPS

1. ✅ Update all API routes to use Supabase client
2. ✅ Test all features locally
3. ✅ Run full test suite
4. ✅ Deploy to production
5. ✅ Monitor Supabase logs for errors

---

## 📚 USEFUL LINKS

- Supabase Dashboard: https://app.supabase.com
- Supabase JS Client Docs: https://supabase.com/docs/reference/javascript
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
- PostgREST API: https://supabase.com/docs/guides/api
