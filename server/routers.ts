import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { testDomains, DNS_PROVIDERS } from "./dns";
import { getDnsProxyConfig, updateDnsProxyConfig, getDnsQueryLogs, getQueryStatsSummary } from "./dnsProxyDb";
import { getDnsProxy } from "./dnsProxy";
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
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return getDnsProxyConfig(ctx.user.id);
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
        if (!ctx.user) throw new Error("Unauthorized");
        const config = await updateDnsProxyConfig(ctx.user.id, input);
        const proxy = getDnsProxy();
        if (config.isEnabled === 1) {
          if (config.fastestProvider) {
            proxy.config.fastestProvider = config.fastestProvider;
          }
          if (config.cacheTtl) {
             proxy.config.cacheTtl = config.cacheTtl;
          }
          await proxy.start().catch(console.error);
        } else {
          await proxy.stop();
        }
        return config;
      }),

    getQueryLogs: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        return getDnsQueryLogs(ctx.user.id, input.limit);
      }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return getQueryStatsSummary(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
