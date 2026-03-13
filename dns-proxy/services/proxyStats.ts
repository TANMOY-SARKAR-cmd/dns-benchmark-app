import { supabase } from '../supabaseClient';

export async function incrementProxyStat(
  userId: string,
  type: 'total' | 'cache_hit' | 'cache_miss',
  activeProvider?: string
) {
  try {
    // This could be optimized using a Postgres function, but for simplicity we fetch and update
    const { data: stats, error: fetchError } = await supabase
      .from('proxy_stats')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is not found
      console.error('Failed to fetch proxy stats:', fetchError);
      return;
    }

    const currentStats = stats || { total_queries: 0, cache_hits: 0, cache_misses: 0 };

    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (type === 'total') updatePayload.total_queries = currentStats.total_queries + 1;
    if (type === 'cache_hit') updatePayload.cache_hits = currentStats.cache_hits + 1;
    if (type === 'cache_miss') updatePayload.cache_misses = currentStats.cache_misses + 1;
    if (activeProvider) updatePayload.active_provider = activeProvider;

    if (stats) {
      await supabase.from('proxy_stats').update(updatePayload).eq('user_id', userId);
    } else {
      await supabase.from('proxy_stats').insert({ user_id: userId, ...updatePayload });
    }
  } catch (err) {
    console.error('Exception updating proxy stats:', err);
  }
}

export async function getProxyStats(userId: string) {
  const { data, error } = await supabase
    .from('proxy_stats')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get proxy stats:', error);
  }

  return data || null;
}
