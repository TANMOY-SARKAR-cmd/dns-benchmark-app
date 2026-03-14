import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
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
    // Config is accessed directly via Supabase on frontend
  }),
});

export type AppRouter = typeof appRouter;
