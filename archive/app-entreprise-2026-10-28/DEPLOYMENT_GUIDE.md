# Koji Deployment & Integration Guide

Complete guide for frontend, backend, and QA teams to deploy and test the new Marketplace and Entreprise app features.

---

## 1️⃣ PULL CODE FROM GITHUB

### Web App (koji-web)
```bash
cd ~/Desktop/koji-web
git fetch origin
git checkout feat/entreprise-app-phase-6
git pull origin feat/entreprise-app-phase-6
npm install
```

### Mobile App (Flutter - Koji)
```bash
cd ~/Desktop/koji
git fetch origin
git checkout two-apps-design
git pull origin two-apps-design
flutter pub get
```

**Verify commits are present:**
```bash
git log --oneline -10
```

Should show:
- Web: `92c9c0b` and earlier
- Mobile: `bfa0f27` (latest), `6ff41ec`, `1baeac3`, etc.

---

## 2️⃣ FRONTEND: LOCAL TESTING

### Web App (Next.js)
```bash
cd ~/Desktop/koji-web
npm run dev
# Visit http://localhost:3000/client/marketplace
```

**Test Marketplace (Phase 1+2):**
- [ ] Navigate to /client/marketplace
- [ ] Click "Créer un projet" → SSE streaming works
- [ ] Create a marketplace listing
- [ ] Request RDV (visite) on an offer
- [ ] Send message in offer thread
- [ ] Initiate payment (Stripe WebView)

**Test Entreprise App (Web):**
- [ ] Navigate to /entreprise
- [ ] View dashboard KPIs
- [ ] Create/view devis
- [ ] Manage clients
- [ ] View team members
- [ ] Check facturation, profil, paramètres

### Mobile App (Flutter)
```bash
cd ~/Desktop/koji
flutter run
# Or target specific device:
flutter run -d chrome        # Web (testing only)
flutter run -d windows       # Windows desktop
```

**Test Marketplace (Phase 1+2):**
- [ ] Navigate to /client/marketplace
- [ ] Tap "Créer un projet" → SSE streaming
- [ ] See marketplace offers list
- [ ] Request RDV
- [ ] Send messages
- [ ] Initiate payment

**Test Entreprise App (Phase 3-5):**
- [ ] Navigate to /entreprise
- [ ] View dashboard with KPIs
- [ ] Tap through all 7 main screens:
  - Accueil (home)
  - Devis
  - Clients
  - Équipe
  - Facturation
  - Profil
  - Paramètres
- [ ] Test responsive layout (desktop drawer vs mobile bottom nav)
- [ ] Test Devis IA (Phase 4): conversational flow
- [ ] Check advanced features (Phase 5): Planning, Archives, Marketplace, etc.

**Build Test:**
```bash
flutter analyze        # Should show 0 errors
flutter test          # Run unit tests
```

---

## 3️⃣ BACKEND: SUPABASE INTEGRATION

### Database Schemas (SQL)

Create these tables in your Supabase PostgreSQL database:

#### Marketplace Offers
```sql
CREATE TABLE chantier_offres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  metier TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city TEXT,
  postal_code TEXT,
  lat FLOAT8,
  lon FLOAT8,
  status TEXT DEFAULT 'published', -- published, completed, cancelled
  budget NUMERIC,
  estimated_days INT,
  photos JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chantier_offres_user_id ON chantier_offres(user_id);
CREATE INDEX idx_chantier_offres_status ON chantier_offres(status);
```

#### Marketplace Offer Messages
```sql
CREATE TABLE marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES chantier_offres(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_marketplace_messages_offer_id ON marketplace_messages(offer_id);
CREATE INDEX idx_marketplace_messages_sender_id ON marketplace_messages(sender_id);
```

#### RDV (Appointments)
```sql
CREATE TABLE chantier_visites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES chantier_offres(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES auth.users(id),
  consumer_id UUID NOT NULL REFERENCES auth.users(id),
  proposed_datetime TIMESTAMP NOT NULL,
  confirmed_datetime TIMESTAMP,
  status TEXT DEFAULT 'pending', -- pending, accepted, declined, completed
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chantier_visites_offer_id ON chantier_visites(offer_id);
CREATE INDEX idx_chantier_visites_status ON chantier_visites(status);
```

#### Entreprise Clients
```sql
CREATE TABLE entreprise_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entreprise_clients_entreprise_id ON entreprise_clients(entreprise_id);
```

#### Entreprise Team Members
```sql
CREATE TABLE entreprise_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES auth.users(id),
  member_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT DEFAULT 'employee', -- employee, manager, admin
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entreprise_team_entreprise_id ON entreprise_team(entreprise_id);
```

#### Devis (Quotes)
```sql
CREATE TABLE devis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID REFERENCES entreprise_clients(id),
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft', -- draft, sent, signed, rejected, expired
  total_amount NUMERIC,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_devis_entreprise_id ON devis(entreprise_id);
CREATE INDEX idx_devis_status ON devis(status);
```

### Enable Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE chantier_offres ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantier_visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;

-- chantier_offres: users can only see/edit their own
CREATE POLICY "Users can view their own offers"
  ON chantier_offres FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create offers"
  ON chantier_offres FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add similar policies for other tables
```

### API Route Updates

Update these files to use Supabase:
- `/app/api/chantier-offres/route.js` → Query chantier_offres table
- `/app/api/marketplace/offres/[id]/messages` → Query marketplace_messages
- `/app/api/marketplace/offres/[id]/visite` → Query chantier_visites
- `/app/api/entreprise/clients/route.js` → Query entreprise_clients
- `/app/api/entreprise/equipe/route.js` → Query entreprise_team
- `/app/api/entreprise/devis/route.js` → Query devis table

---

## 4️⃣ QA: COMPLETE WORKFLOW TESTING

### Test Plan

#### Phase 1: Marketplace Publishing
**Scenario:** Consumer publishes a marketplace listing with IA assistance

1. **Open Web App** → Navigate to /client/marketplace/new
2. **Start IA Chat:**
   - [ ] "Bonjour" initiates conversation
   - [ ] IA responds with streaming text (SSE)
   - [ ] Multiple turns accumulate correctly
3. **Review Details:**
   - [ ] Recap shows collected information
   - [ ] Address geocoding works
   - [ ] Photos can be added
4. **Publish:**
   - [ ] Listing appears in marketplace
   - [ ] Data saved to Supabase

#### Phase 2: RDV Booking (Phase 1)
**Scenario:** Entreprise books an appointment on a marketplace offer

1. **Find Offer:**
   - [ ] Open /client/marketplace/{offerId}
   - [ ] See offer details
2. **Request RDV:**
   - [ ] Click "Demander une visite"
   - [ ] Select date/time
   - [ ] Add optional note
3. **Save:**
   - [ ] RDV created in chantier_visites table
   - [ ] Notification sent to entreprise

#### Phase 3: Messaging (Phase 2)
**Scenario:** Consumer and entreprise exchange messages on an offer

1. **Open Chat:**
   - [ ] /client/marketplace/{offerId}/messages
2. **Send Message:**
   - [ ] Type and send
   - [ ] Message appears in thread
   - [ ] Data saved to marketplace_messages table
3. **Load History:**
   - [ ] Reload page
   - [ ] Previous messages load correctly
4. **Multiple Users:**
   - [ ] Consumer can see entreprise replies
   - [ ] Entreprise can see consumer replies

#### Phase 4: Payment (Phase 2)
**Scenario:** Consumer pays for a marketplace transaction

1. **Open Payment:**
   - [ ] /client/marketplace/{offerId}/payment/review
2. **Stripe Checkout:**
   - [ ] WebView loads Stripe Checkout
   - [ ] Can enter test card
3. **Complete Payment:**
   - [ ] Use Stripe test card: 4242 4242 4242 4242
   - [ ] Complete transaction
4. **Validation:**
   - [ ] Payment status updates
   - [ ] Notification sent to both parties

#### Phase 5: Entreprise App Dashboard (Phase 3)
**Scenario:** Entreprise user accesses the app

1. **Login:**
   - [ ] Auth works (email/password or Google)
2. **Dashboard:**
   - [ ] KPIs display correct data
   - [ ] Quick action buttons work
   - [ ] Recent activity shows
3. **Navigation:**
   - [ ] All 7 screens accessible
   - [ ] Navigation responsive (drawer on desktop, bottom nav on mobile)

#### Phase 6: Entreprise Devis IA (Phase 4)
**Scenario:** Entreprise creates a devis with IA assistance

1. **Start IA Chat:**
   - [ ] /entreprise/devis/ia/new
   - [ ] Conversational flow works
   - [ ] SSE streaming displays responses
2. **Create Devis:**
   - [ ] Recap phase shows collected info
   - [ ] Can finalize and save
3. **View in List:**
   - [ ] /entreprise/devis shows new devis
   - [ ] Can view details and PDF

#### Phase 7: Advanced Features (Phase 5)
**Scenario:** Entreprise uses additional features

1. **Planning:**
   - [ ] /entreprise/planning shows schedule
2. **Archives:**
   - [ ] /entreprise/archives shows past projects
3. **Marketplace:**
   - [ ] /entreprise/marketplace shows opportunities
4. **Comptabilité:**
   - [ ] /entreprise/comptabilite shows financial summary

### Test Results Checklist

- [ ] All Phase 1-2 marketplace features work end-to-end
- [ ] All Phase 3-5 entreprise app screens functional
- [ ] IA streaming (Phase 4) displays correctly
- [ ] Supabase queries return correct data
- [ ] RLS policies enforce data isolation
- [ ] Mobile and desktop responsive layouts work
- [ ] Error handling displays user-friendly messages
- [ ] All 17 unit tests pass
- [ ] No console errors or warnings

### Test Environment

**Web:**
- Browser: Chrome/Safari/Firefox
- Server: `npm run dev` (localhost:3000)

**Mobile:**
- Device: Physical phone or emulator
- Server: `flutter run`

**Database:**
- Supabase local or staging instance
- Tables created per schema above
- RLS policies enabled

---

## 🚀 READY TO DEPLOY

Once all tests pass:

1. **Code Review:** Submit PR with all commits
2. **Staging Test:** Deploy to staging environment
3. **Production Deploy:** Follow your standard deployment process
4. **Monitor:** Check error logs and performance metrics

---

**Need Help?**
- Frontend issues: Check `/AGENTS.md` for Next.js specifics
- Mobile issues: Check Flutter docs (version 3.x+)
- Database issues: Check Supabase docs
- API issues: Check route implementations in `/app/api/*`

---

**Status:**
- ✅ Code: Tested and pushed to GitHub
- ✅ Tests: 17 passing (12 web + 5 mobile)
- ✅ Compilation: 0 errors
- ⏳ Integration: Awaiting Supabase schema creation
- ⏳ QA: Ready for manual testing
