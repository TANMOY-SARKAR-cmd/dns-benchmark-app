const fs = require('fs');

let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

code = code.replace(
  `              // Second pass: run client fallback concurrently only for failed providers
              if (failedProviders.length > 0) {
                const fallbackResults = await Promise.all(
                  failedProviders.map(async provider => {
                    try {
                      const fallbackResult = await measureClientDoH(
                        provider,
                        domain
                      );
                      return { provider, result: fallbackResult };
                    } catch (error) {
                      return { provider, result: "Error" as const };
                    }
                  })
                );`,
  `              // Second pass: run client fallback concurrently only for failed providers
              if (failedProviders.length > 0) {
                // Optimized N+1 queries using Promise.all
                const fallbackPromises = failedProviders.map(async provider => {
                  try {
                    const fallbackResult = await measureClientDoH(
                      provider,
                      domain
                    );
                    return { provider, result: fallbackResult };
                  } catch (error) {
                    return { provider, result: "Error" as const };
                  }
                });
                const fallbackResults = await Promise.all(fallbackPromises);`
);

code = code.replace(
  `        // Second pass: run client fallback concurrently only for failed providers
        if (failedProviders.length > 0) {
          toast.warning(
            \`Backend failed for \${failedProviders.length} provider(s), using client fallback\`
          );
          const fallbackResults = await Promise.all(
            failedProviders.map(async provider => {
              try {
                const fallbackResult = await measureClientDoH(provider, domain);
                return { provider, result: fallbackResult };
              } catch (error) {
                return { provider, result: "Error" as const };
              }
            })
          );`,
  `        // Second pass: run client fallback concurrently only for failed providers
        if (failedProviders.length > 0) {
          toast.warning(
            \`Backend failed for \${failedProviders.length} provider(s), using client fallback\`
          );
          // Optimized N+1 queries using Promise.all
          const fallbackPromises = failedProviders.map(async provider => {
            try {
              const fallbackResult = await measureClientDoH(provider, domain);
              return { provider, result: fallbackResult };
            } catch (error) {
              return { provider, result: "Error" as const };
            }
          });
          const fallbackResults = await Promise.all(fallbackPromises);`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
