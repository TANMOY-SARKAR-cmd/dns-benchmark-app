import { describe, it, expect, vi } from "vitest";
import { testDomain, testDomains, DNS_PROVIDERS } from "./dns";

describe("DNS Testing Module", () => {
  describe("DNS_PROVIDERS", () => {
    it("should have all required DNS providers", () => {
      expect(DNS_PROVIDERS).toHaveProperty("Google DNS");
      expect(DNS_PROVIDERS).toHaveProperty("Cloudflare DNS");
      expect(DNS_PROVIDERS).toHaveProperty("OpenDNS");
      expect(DNS_PROVIDERS).toHaveProperty("Quad9 DNS");
      expect(DNS_PROVIDERS).toHaveProperty("AdGuard DNS");
    });

    it("should have correct IP addresses for each provider", () => {
      expect(DNS_PROVIDERS["Google DNS"]).toBe("8.8.8.8");
      expect(DNS_PROVIDERS["Cloudflare DNS"]).toBe("1.1.1.1");
      expect(DNS_PROVIDERS["OpenDNS"]).toBe("208.67.222.222");
      expect(DNS_PROVIDERS["Quad9 DNS"]).toBe("9.9.9.9");
      expect(DNS_PROVIDERS["AdGuard DNS"]).toBe("94.140.14.14");
    });
  });

  describe("testDomain", () => {
    it("should return results for all DNS providers", async () => {
      const result = await testDomain("google.com");

      expect(result).toHaveProperty("Google DNS");
      expect(result).toHaveProperty("Cloudflare DNS");
      expect(result).toHaveProperty("OpenDNS");
      expect(result).toHaveProperty("Quad9 DNS");
      expect(result).toHaveProperty("AdGuard DNS");
    });

    it("should return numeric or error string values", async () => {
      const result = await testDomain("google.com");

      Object.values(result).forEach(value => {
        expect(
          typeof value === "number" || value === "Error" || value === "Timeout"
        ).toBe(true);
      });
    });

    it("should call onProgress callback for each provider", async () => {
      const progressCallback = vi.fn();
      await testDomain("google.com", progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(5);
      progressCallback.mock.calls.forEach(([provider, result]) => {
        expect(Object.keys(DNS_PROVIDERS)).toContain(provider);
        expect(
          typeof result === "number" ||
            result === "Error" ||
            result === "Timeout"
        ).toBe(true);
      });
    });
  });

  describe("testDomains", () => {
    it("should return results for multiple domains", async () => {
      const domains = ["google.com", "github.com"];
      const results = await testDomains(domains);

      expect(results).toHaveProperty("google.com");
      expect(results).toHaveProperty("github.com");
    });

    it("should return results for all DNS providers for each domain", async () => {
      const domains = ["google.com"];
      const results = await testDomains(domains);

      const googleResults = results["google.com"];
      expect(googleResults).toHaveProperty("Google DNS");
      expect(googleResults).toHaveProperty("Cloudflare DNS");
      expect(googleResults).toHaveProperty("OpenDNS");
      expect(googleResults).toHaveProperty("Quad9 DNS");
      expect(googleResults).toHaveProperty("AdGuard DNS");
    });

    it("should call onProgress callback with correct parameters", async () => {
      const progressCallback = vi.fn();
      const domains = ["google.com", "github.com"];

      await testDomains(domains, progressCallback);

      // Should be called for each domain * provider combination
      expect(progressCallback.mock.calls.length).toBeGreaterThan(0);

      // Check that callback receives correct parameters
      progressCallback.mock.calls.forEach(
        ([completed, total, domain, provider]) => {
          expect(typeof completed).toBe("number");
          expect(typeof total).toBe("number");
          expect(domains).toContain(domain);
          expect(Object.keys(DNS_PROVIDERS)).toContain(provider);
        }
      );
    });
  });
});
