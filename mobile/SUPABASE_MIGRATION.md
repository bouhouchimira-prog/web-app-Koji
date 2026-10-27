# Supabase Migration Guide

## Setup Instructions

### 1. Get Your Supabase Anon Key

1. Go to your Supabase project dashboard: https://hbgqbpyufaajqmedxodg.supabase.co
2. Navigate to **Settings** → **API**
3. Copy the `anon` `public` key
4. Open `lib/core/supabase_config.dart`
5. Replace `YOUR_SUPABASE_ANON_KEY` with your actual anon key

### 2. Create Database Tables

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `supabase_schema.sql` in this project
4. Copy all the SQL code
5. Paste it into the SQL Editor and click **Run**

This will create:
- `users` table with authentication and profile data
- `quotes` table with quote information
- Row Level Security (RLS) policies to protect user data
- Indexes for better performance
- Automatic timestamp updates

### 3. Configure Google Sign-In (Optional)

If you want to use Google Sign-In:

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Enable **Google** provider
3. Add your Google OAuth credentials:
   - Client ID
   - Client Secret
4. Add authorized redirect URIs

### 4. Test the Migration

Run the app and test:
- Email/password sign up
- Email/password sign in
- User profile updates
- Quote creation and retrieval
- Sign out

## Database Schema

### Users Table
- `id` (UUID, primary key, references auth.users)
- `email` (TEXT)
- `is_pro` (BOOLEAN)
- `profession` (TEXT)
- `is_profile_complete` (BOOLEAN)
- `is_business_info_complete` (BOOLEAN)
- `business_info` (JSONB) - stores business details
- `created_at`, `updated_at` (TIMESTAMPTZ)

### Quotes Table
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to users)
- `status` (TEXT, default 'en_cours')
- `client_name`, `client_email`, `client_phone`, `client_address` (TEXT)
- `rooms`, `tasks` (JSONB) - flexible storage for quote data
- `total_amount` (DECIMAL)
- `notes` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

## Migration Changes

### Removed
- `firebase_auth` package
- `firebase_core` package
- `cloud_firestore` package
- `firebase.json` configuration
- `lib/firebase_options.dart`

### Added
- `supabase_flutter` package
- `lib/core/supabase_config.dart`
- `supabase_schema.sql`

### Modified
- `lib/main.dart` - Supabase initialization
- `lib/features/auth/repository/auth_repository.dart` - Supabase Auth
- `lib/features/auth/repository/user_repository.dart` - Supabase Database
- `lib/features/quote/repository/quote_repository.dart` - Supabase Database
- `lib/features/quote/room_task_screen.dart` - Auth reference update

## Key Differences

### Authentication
- Firebase: `UserCredential` → Supabase: `AuthResponse`
- Firebase: `user.uid` → Supabase: `user.id`
- Firebase: `authStateChanges()` → Supabase: `onAuthStateChange`

### Database
- Firestore: NoSQL collections → Supabase: PostgreSQL tables
- Firestore: `FieldValue.serverTimestamp()` → Supabase: `DateTime.now().toIso8601String()`
- Firestore: Nested subcollections → Supabase: Foreign keys
- Firestore: Real-time `.snapshots()` → Supabase: `.stream()`

## Troubleshooting

### "Invalid API key"
- Make sure you've replaced `YOUR_SUPABASE_ANON_KEY` in `supabase_config.dart`

### "Table does not exist"
- Run the SQL schema in Supabase SQL Editor

### "Row Level Security policy violation"
- Check that RLS policies were created correctly
- Ensure user is authenticated before accessing data

### Google Sign-In not working
- Configure Google provider in Supabase dashboard
- Ensure OAuth credentials are correct
