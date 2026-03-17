# Client-side DNS Benchmark – DoH-based

A 100% client-side DNS benchmarking application using DNS-over-HTTPS (DoH). Test multiple public DNS providers instantly from your browser without requiring any backend server.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/TANMOY-SARKAR-cmd/dns-benchmark-app)

## Features

- **Fully Client-Side:** Runs entirely in your browser using DoH (DNS-over-HTTPS). No backend required.
- **Multiple Providers:** Tests Cloudflare, Google, Quad9, AdGuard, and OpenDNS simultaneously.
- **Batch Processing:** Intelligently batches requests to prevent browser throttling.
- **Real-time Leaderboard:** See global average latencies for each provider across all users.
- **Live Logs Stream:** Watch real-time benchmark results from other users around the world.
- **History Tracking:** View your recent benchmark runs on an interactive chart.
- **CSV Export:** Download your test results for offline analysis.
- **Dark Mode Support:** Automatic system preference detection with manual toggle.

## Screenshots

_(Placeholder for screenshots - Add screenshots of the benchmark interface, leaderboard, and live logs here)_

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Database & Realtime:** Supabase
- **Charts:** Recharts
- **Data Processing:** PapaParse

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project.
2. Run the SQL script located at `updated-supabase-schema.sql` in your Supabase SQL Editor.
3. Get your Project URL and Anon Key.

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
