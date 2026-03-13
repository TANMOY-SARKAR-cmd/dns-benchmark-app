import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { supabase } from "./supabaseClient";
import { z } from "zod";

// Move provider config to backend for router usage since dns.ts was moved
export const DNS_PROVIDERS = {
  'Google DNS': '8.8.8.8',
  'Cloudflare DNS': '1.1.1.1',
  'OpenDNS': '208.67.222.222',
  'Quad9 DNS': '9.9.9.9',
  'AdGuard DNS': '94.140.14.14',
} as const;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  dns: router({
    test: publicProcedure
      .input(
        z.object({
          domains: z.array(z.string().min(1)).min(1).max(100),
        })
      )
      .mutation(async ({ input }) => {
        const domains = input.domains
          .map((d) => d.trim().toLowerCase())
          .filter((d) => d.length > 0);

        if (domains.length === 0) {
          throw new Error("No valid domains provided");
        }

        const { testDomains } = await import("../dns-proxy/dns");
        const results = await testDomains(domains);
        return results;
      }),

    providers: publicProcedure.query(() => {
      return Object.entries(DNS_PROVIDERS).map(([name, ip]) => ({
        name,
        ip,
      }));
    }),
  }),

  proxy: router({
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.id.toString();
      const { data, error } = await supabase
        .from('proxy_config')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error('Failed to get proxy config');
      }

      return data || { is_enabled: 0, fastest_provider: 'Google DNS', proxy_port: 53 };
    }),

    updateConfig: protectedProcedure
      .input(
        z.object({
          isEnabled: z.number().optional(),
          fastestProvider: z.string().optional(),
          cacheTtl: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id.toString();
        const updateData: any = { updated_at: new Date().toISOString() };
        if (input.isEnabled !== undefined) updateData.is_enabled = input.isEnabled;
        if (input.fastestProvider !== undefined) updateData.fastest_provider = input.fastestProvider;
        if (input.cacheTtl !== undefined) updateData.cache_ttl = input.cacheTtl;

        const { data: config, error } = await supabase
          .from('proxy_config')
          .update(updateData)
          .eq('user_id', userId)
          .select()
          .single();

        if (error || !config) {
          throw new Error('Failed to update config');
        }

        // Proxy process reacts to this update automatically via Realtime
        return config;
      }),

    getQueryLogs: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ ctx, input }) => {
        const userId = ctx.user.id.toString();
        const { data, error } = await supabase
          .from('dns_queries')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(input.limit);

        if (error) {
          console.error('Failed to get DNS query logs from Supabase:', error);
          return [];
        }

        return data.map(log => ({
          id: log.id,
          userId: log.user_id,
          domain: log.domain,
          provider: log.upstream_provider,
          resolutionTime: log.latency_ms,
          ipAddress: log.client_ip,
          status: log.status,
          cachedResult: log.cached ? 1 : 0,
          createdAt: new Date(log.created_at)
        }));
      }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.id.toString();
      const { data: dbStats, error } = await supabase
        .from('proxy_stats')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .single();

      // Calculate derived stats like cache hit rate
      const total = dbStats?.total_queries || 0;
      const hits = dbStats?.cache_hits || 0;
      const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;

      return {
        totalQueries: total,
        cachedQueries: hits,
        cacheHitRate: hitRate,
        mostUsedProvider: dbStats?.active_provider || 'Google DNS',
        averageResolutionTime: 0 // Will need a separate query to compute avg latency from dns_queries if desired, or can be added to proxyStats
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
