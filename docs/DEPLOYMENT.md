# Deployment Guide: Vercel & Supabase

SwimTrack is designed to deploy seamlessly to Vercel Hobby with zero backend servers or paid infrastructure.

## Step 1: Create Supabase Project
1. Sign in to [Supabase](https://supabase.com).
2. Create a new project (e.g. `swimtrack-prod`).
3. Open the **SQL Editor** in the Supabase Dashboard.
4. Paste and execute the contents of `supabase/migrations/20260101000000_swimtrack_schema.sql`.
5. Under **Authentication > Users**, invite or add your single administrator email.
6. Note your Administrator `User UID` and your project API keys (Project URL, anon public key, service role key).

## Step 2: Configure Resend
1. Sign in to [Resend](https://resend.com).
2. Generate an API Key under **API Keys**.
3. Verify your custom sending domain, or use the default sandbox `onboarding@resend.dev` for testing.

## Step 3: Deploy to Vercel
1. Push your repository to GitHub.
2. Import the repository into your [Vercel Dashboard](https://vercel.com).
3. Under **Environment Variables**, provide:
   ```env
   NEXT_PUBLIC_APP_URL="https://your-swimtrack.vercel.app"
   NEXT_PUBLIC_TIMEZONE="Asia/Colombo"
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ADMIN_EMAIL="admin@yourdomain.com"
   ADMIN_USER_ID="your-supabase-auth-user-id"
   RESEND_API_KEY="re_your_api_key"
   RESEND_FROM_EMAIL="SwimTrack <notifications@yourdomain.com>"
   CRON_SECRET="your-high-entropy-cron-secret"
   ```
4. Click **Deploy**.

## Step 4: Verify Cron Setup
Vercel will automatically read `vercel.json` and schedule the daily reminder runner at 02:30 UTC (~8:00 AM Asia/Colombo) with automatic `CRON_SECRET` injection.

