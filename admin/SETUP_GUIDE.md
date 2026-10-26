# 🚀 Supabase Setup Guide

## The Problem
You're seeing "Invalid login credentials" because the database tables haven't been created yet in Supabase.

## ✅ Solution - Follow These Steps:

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Sign in to your account
3. Select your project: **hbgqbpyufaajqmedxodg**

### Step 2: Run the SQL Script
1. In the left sidebar, click **SQL Editor**
2. Click **New Query** button (top right)
3. Open the file: `koji-admin/supabase_complete_setup.sql`
4. Copy ALL the contents (Ctrl+A, Ctrl+C)
5. Paste into the Supabase SQL Editor
6. Click **Run** button (or press Ctrl+Enter)
7. Wait for "Success. No rows returned" message

### Step 3: Create Your Admin Account
1. Go back to: http://localhost:3000/auth/signup
2. Enter your email and password
3. Click "Create Account"
4. If email confirmation is enabled, check your email
5. Go to http://localhost:3000/auth/login
6. Sign in with your credentials

### Step 4: You're Done! 🎉
You should now see the beautiful admin dashboard with:
- Overview stats
- Users management
- Quotes management  
- Products management

---

## 📝 What the SQL Script Does:
- Creates `users`, `quotes`, and `products` tables
- Sets up security policies (RLS)
- Creates automatic triggers
- Auto-creates user profile when you sign up

## ❓ Need Help?
If you get any errors when running the SQL, let me know and I'll help you fix them!
