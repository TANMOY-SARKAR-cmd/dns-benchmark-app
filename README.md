# DNS Benchmark

A hybrid architecture DNS benchmarking application. Test multiple public DNS providers instantly from your browser using both native UDP and DNS-over-HTTPS (DoH).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/TANMOY-SARKAR-cmd/dns-benchmark-app)

## Architecture

**Frontend:**
- React + Vite
- Runs benchmark UI
- Runs personal monitoring

**Backend:**
- Vercel Serverless Functions
- UDP DNS testing
- DoH testing
- Daily cron job

**Database:**
- Supabase PostgreSQL
- Stores benchmark results
- Stores monitor results
- Stores leaderboard
- Stores user preferences

**Monitoring:**
- Personal monitors run in browser
- Global stats computed from all user data
- Daily cron computes leaderboard

## Features

- **Hybrid Architecture:** Uses Vercel serverless backend for UDP/DoH testing and React frontend for benchmarking.
- **Authentication:** Secure user accounts via Supabase.
- **Multiple Providers:** Tests Cloudflare, Google, Quad9, AdGuard, and OpenDNS simultaneously.
- **Real-time Leaderboard:** See global average latencies, success rates, and scores.
- **Personal Monitoring:** Run monitors directly in your browser.
- **History Tracking:** View your recent benchmark runs.
- **Daily Cron Job:** Automatically aggregates data and computes global leaderboard stats.
- **Dark Mode Support:** Automatic system preference detection with manual toggle.

## Screenshots

_(Placeholder for screenshots - Add screenshots of the benchmark interface, leaderboard, and live logs here)_

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Vercel Serverless Functions (Node.js)
- **Database & Authentication:** Supabase PostgreSQL
- **Charts:** Recharts

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project.
2. Run the full database schema located at [`updated-supabase-schema.sql`](./updated-supabase-schema.sql) in your Supabase SQL Editor to set up all tables, indexes, and RLS policies.
3. Get your Project URL and Anon Key from the Supabase dashboard.

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Local Development

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm run dev
```

Build for production:

```bash
pnpm run build
```

## Vercel Deployment

1. Click the "Deploy with Vercel" button above or import the repository in your Vercel dashboard.
2. Set the Environment Variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
3. Set the Framework Preset to "Vite".
4. Deploy!

## License

MIT
