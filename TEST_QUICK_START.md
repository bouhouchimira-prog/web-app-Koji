# Quick Start Testing

Fast track to verify everything works.

---

## ⚡ 5-Minute Setup

```bash
# 1. Setup environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 2. Verify setup
node scripts/test-setup.js

# 3. Start dev servers
npm run dev                      # Main app (port 3000)
# In another terminal:
cd worker && npm run dev         # Worker app (port 3000)

# 4. Test in browser
# Main: http://localhost:3000
# Worker: http://localhost:3000 (or different port if configured)
```

If `test-setup.js` shows ✅ all tests passed, you're ready to test!

---

## 🧪 Quick Tests

### Main App (3 minutes)

1. **Login**
   - Go to http://localhost:3000
   - Login with your credentials
   - ✅ Redirected to dashboard

2. **View Projects**
   - Projects list loads
   - Click on a project
   - ✅ Details show correctly

3. **Create Project**
   - Click "Nouveau projet"
   - Fill form
   - ✅ New project appears in list

4. **Check Network**
   - Open DevTools → Network
   - Refresh projects
   - Look for `/api/projects`
   - ✅ Response shows data from Supabase (not JSON file)

### Worker App (3 minutes)

1. **Create Test Worker** (in Supabase)

   ```bash
   # Generate password hash
   node -e "console.log(require('crypto').createHash('sha256').update('password123').digest('hex'))"
   ```

   In Supabase SQL Editor:
   ```sql
   INSERT INTO workers (first_name, last_name, email, password_hash, trade, status)
   VALUES ('Test', 'Worker', 'test@example.com', 'HASH_FROM_ABOVE', 'Plombier', 'active');
   ```

2. **Login to Worker App**
   - Go to http://localhost:3000
   - Enter: test@example.com / password123
   - ✅ Redirected to dashboard

3. **View Tasks**
   - Dashboard loads
   - (No tasks shown if none assigned yet, that's OK)
   - Check console for errors
   - ✅ No red errors

---

## ✅ Verification Checklist

Quick mental checklist:

- [ ] `test-setup.js` passes
- [ ] Main app loads without 404s
- [ ] Can login successfully
- [ ] Projects/tasks load from network tab
- [ ] Worker app login works
- [ ] No red errors in console
- [ ] No SQL errors in Supabase logs

If all ✅, you're good to proceed with full testing!

---

## 📊 What's Actually Happening

### Main App Flow

```
Browser
  ↓
Login (email/password)
  ↓ [getAuth() → Supabase JWT token in HttpOnly cookie]
Dashboard
  ↓
GET /api/projects [sends JWT token]
  ↓ [getAuth() extracts token from cookie]
Supabase Query (with RLS)
  ↓ [RLS checks: can this user see these projects?]
✅ Returns only user's projects
```

### Worker App Flow

```
Browser
  ↓
Login (email/password)
  ↓ [POST /api/auth/worker-login → getWorkerByEmail()]
Supabase Query (find worker by email)
  ↓ [Verify password]
✅ Return token + store in localStorage
  ↓
Dashboard
  ↓
GET /api/worker/tasks?workerId=xxx
  ↓ [getWorkerTasks() → Supabase query]
✅ Returns worker's assigned tasks
```

---

## 🐛 Quick Fixes

### App won't start
```bash
npm install
npm run build  # Check for errors
npm run dev
```

### "Cannot find module"
```bash
# From root:
npm install

# From worker/:
cd worker && npm install
```

### No data showing
- Check DevTools → Network → `/api/...` responses
- If 401/403: credentials issue
- If 500: server error (check terminal logs)

### Worker login fails
- Check password hash matches database
- Verify worker record exists in Supabase
- Check email is exact match

---

## 🚀 Next Steps After Testing

1. ✅ All tests pass → commit & push
2. ✅ Deploy to staging for team review
3. ✅ Deploy to production
4. ✅ Monitor Supabase logs for issues

---

## 📞 Need Help?

1. Check TEST_CHECKLIST.md for detailed tests
2. Check SUPABASE_SETUP.md for configuration
3. Check WORKER_DEPLOYMENT.md for worker setup
4. Check logs: `npm run dev` shows errors in terminal

Logs are your best friend!
