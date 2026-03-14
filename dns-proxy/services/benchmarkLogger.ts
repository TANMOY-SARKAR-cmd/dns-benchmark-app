import { supabase } from '../supabaseClient';

export async function logBenchmarkResult(
  provider: string,
  latencyMs: number
) {
  try {
    const { error } = await supabase.from('benchmark_results').insert({
      provider,
      latency_ms: latencyMs,
    });

    if (error) {
      console.error('Failed to log benchmark to Supabase:', error);
    }
  } catch (err) {
    console.error('Exception logging benchmark:', err);
  }
}
