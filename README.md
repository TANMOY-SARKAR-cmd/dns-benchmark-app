# DNS Benchmark & Smart Proxy App

A full-stack DNS benchmarking dashboard and DNS proxy server.

This application measures DNS resolution times across popular public DNS providers and functions as a local DNS proxy (similar to Pi-hole) that intelligently routes your DNS queries to the fastest available upstream provider based on real-time benchmarks.

## Features

- **DNS Benchmarking Dashboard:** Test resolution latency for multiple domains across providers (Google, Cloudflare, Quad9, OpenDNS, AdGuard).
- **Smart DNS Proxy:** A raw UDP proxy server (port 53) that forwards DNS packets intelligently.
- **Auto-Routing:** Background worker periodically tests upstream providers and auto-updates the proxy configuration.
- **DNS Caching:** Implements intelligent caching to drastically reduce repetitive query latency.
- **Real-Time Analytics:** Powered by Supabase, the dashboard gives you a live look at your DNS query logs, cache hit rates, and latency metrics.

## Setup & Installation

### 1. Supabase Configuration

This project requires a Supabase database for persistent storage and real-time dashboard updates.

1. Create a new Supabase project.
2. Navigate to the **SQL Editor** in your Supabase dashboard and run the following schema:

```sql
-- Create proxy config table
CREATE TABLE proxy_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  is_enabled integer DEFAULT 0,
  fastest_provider text DEFAULT 'Google DNS',
  auto_routing_enabled boolean DEFAULT true,
  cache_ttl integer DEFAULT 3600,
  proxy_port integer DEFAULT 53,
  updated_at timestamp with time zone DEFAULT now()
);

-- Ensure there is always a default config row for ease of use
INSERT INTO proxy_config (user_id, is_enabled) VALUES ('default', 0);

-- Create proxy stats table
CREATE TABLE proxy_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  total_queries integer DEFAULT 0,
  cache_hits integer DEFAULT 0,
  cache_misses integer DEFAULT 0,
  active_provider text,
  updated_at timestamp with time zone DEFAULT now()
);

INSERT INTO proxy_stats (user_id) VALUES ('default');

-- Create dns queries log table
CREATE TABLE dns_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  domain text NOT NULL,
  record_type text,
  client_ip text,
  upstream_provider text NOT NULL,
  latency_ms integer,
  cached boolean DEFAULT false,
  status text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create benchmark results table
CREATE TABLE benchmark_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  domain text NOT NULL,
  provider text NOT NULL,
  latency_ms integer,
  tested_at timestamp with time zone DEFAULT now()
);

-- Setup Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE proxy_config;
ALTER PUBLICATION supabase_realtime ADD TABLE proxy_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE dns_queries;
ALTER PUBLICATION supabase_realtime ADD TABLE benchmark_results;

-- Enable RLS
ALTER TABLE proxy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public all proxy_config" ON proxy_config FOR ALL USING (true);
CREATE POLICY "Public all proxy_stats" ON proxy_stats FOR ALL USING (true);
CREATE POLICY "Public all dns_queries" ON dns_queries FOR ALL USING (true);
CREATE POLICY "Public all benchmark_results" ON benchmark_results FOR ALL USING (true);
```

### 2. Environment Variables

Create a `.env` file in the root directory and populate it with your Supabase credentials:

```env
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### 3. Running the App

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the development server (runs both frontend and backend):

   ```bash
   pnpm dev
   ```

3. Open the dashboard at `http://localhost:3000`.

### 4. Configuring Your Devices

To use the smart proxy, enable the proxy from the dashboard and point your device's DNS settings to the server IP (default `127.0.0.1` for local testing).

- **macOS:** System Settings > Network > Wi-Fi/Ethernet > Details > DNS > Add `127.0.0.1`.
- **Windows:** Settings > Network & Internet > Properties > DNS server assignment > Edit > Add `127.0.0.1`.
- **Linux:** Edit `/etc/resolv.conf` to add `nameserver 127.0.0.1`.

### 5. DNS Proxy Port Note
The smart proxy server defaults to port `5353` for non-root users because port 53 requires administrator or root privileges. If you want to use the standard DNS port (53) without running the application as root, you can forward port 53 to 5353 on your machine:

**Linux (using iptables):**
```bash
sudo iptables -t nat -A PREROUTING -p udp --dport 53 -j REDIRECT --to-port 5353
sudo iptables -t nat -A PREROUTING -p tcp --dport 53 -j REDIRECT --to-port 5353
```

**macOS (using pfctl):**
1. Create a file `/etc/pf.anchors/dns.forwarding` with:
   ```pf
   rdr pass on lo0 inet proto udp from any to any port 53 -> 127.0.0.1 port 5353
   rdr pass on lo0 inet proto tcp from any to any port 53 -> 127.0.0.1 port 5353
   ```
2. Enable it:
   ```bash
   sudo pfctl -ef /etc/pf.anchors/dns.forwarding
   ```
