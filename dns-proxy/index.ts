import { config } from "dotenv";
config();
import { DnsProxyServer, startBackgroundBenchmark, stopBackgroundBenchmark } from './dnsProxy';
import { supabase } from './supabaseClient';

const proxy = new DnsProxyServer();
let isRunning = false;

async function syncProxyState() {
  const { data: config, error } = await supabase
    .from('proxy_config')
    .select('*')
    .eq('user_id', 'default')
    .single();

  if (error || !config) {
    console.error('Failed to fetch proxy config:', error);
    return;
  }

  // Sync settings
  if (config.fastest_provider) proxy.updateConfig({ fastestProvider: config.fastest_provider });
  if (config.cache_ttl) proxy.updateConfig({ cacheTtl: config.cache_ttl });

  // Handle start/stop
  if (config.is_enabled === 1 && !isRunning) {
    console.log('Starting DNS proxy based on database config...');
    await proxy.start().catch(console.error);
    isRunning = true;
    if (config.auto_routing_enabled !== false) {
      startBackgroundBenchmark(proxy);
    }
  } else if (config.is_enabled === 0 && isRunning) {
    console.log('Stopping DNS proxy based on database config...');
    await proxy.stop();
    stopBackgroundBenchmark();
    isRunning = false;
  }
}

// Initial Sync
syncProxyState();

// Listen for remote config changes
supabase.channel('proxy_config_listener')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'proxy_config' }, (payload) => {
    console.log('Proxy config changed in database. Syncing...');
    syncProxyState();
  })
  .subscribe();

console.log('DNS Proxy Worker running. Listening for config changes...');
