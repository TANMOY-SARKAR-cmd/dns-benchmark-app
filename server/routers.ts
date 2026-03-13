import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { testDomains, DNS_PROVIDERS } from "./dns";
import { getDnsProxy } from "./dnsProxy";
import { getDnsQueryLogs } from "./services/queryLogger";
import { getProxyStats } from "./services/proxyStats";
import { supabase } from "./supabaseClient";
import { z } from "zod";

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
    getConfig: publicProcedure.query(async () => {
      const { data, error } = await supabase
        .from('proxy_config')
        .select('*')
        .eq('user_id', 'default')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error('Failed to get proxy config');
      }

      return data || { is_enabled: 0, fastest_provider: 'Google DNS', proxy_port: 53 };
    }),

    updateConfig: publicProcedure
      .input(
        z.object({
          isEnabled: z.number().optional(),
          fastestProvider: z.string().optional(),
          cacheTtl: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (input.isEnabled !== undefined) updateData.is_enabled = input.isEnabled;
        if (input.fastestProvider !== undefined) updateData.fastest_provider = input.fastestProvider;
        if (input.cacheTtl !== undefined) updateData.cache_ttl = input.cacheTtl;

        const { data: config, error } = await supabase
          .from('proxy_config')
          .update(updateData)
          .eq('user_id', 'default')
          .select()
          .single();

        if (error || !config) {
          throw new Error('Failed to update config');
        }

        const proxy = getDnsProxy();
        if (config.is_enabled === 1) {
          if (config.fastest_provider) {
            proxy.config.fastestProvider = config.fastest_provider;
          }
          if (config.cache_ttl) {
             proxy.config.cacheTtl = config.cache_ttl;
          }
          await proxy.start().catch(console.error);
        } else {
          await proxy.stop();
        }
        return config;
      }),

    getQueryLogs: publicProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ input }) => {
        return getDnsQueryLogs('default', input.limit);
      }),

    getStats: publicProcedure.query(async () => {
      const dbStats = await getProxyStats('default');

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
