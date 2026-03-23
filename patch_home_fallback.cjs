const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

code = code.replace(
  `        if (failedProviders.length > 0) {
          const fallbackResults = await Promise.all(
            failedProviders.map(async provider => {
              try {
                toast.warning(
                  \`Backend failed for \${provider.name}, using fallback\`
                );
                const fallbackResult = await measureClientDoH(provider, domain);
                return { provider, result: fallbackResult };
              } catch (error) {
                return { provider, result: "Error" as const };
              }
            })
          );

          for (const { provider, result } of fallbackResults) {
            results[domain][provider.name] = result;
            if (result === "Error" || result.successRate === 0) {
              toast.error(
                \`All methods failed for \${provider.name} on \${domain}\`
              );
            }
          }
        }`,
  `        if (failedProviders.length > 0) {
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
          );

          let totalFailed = 0;
          for (const { provider, result } of fallbackResults) {
            results[domain][provider.name] = result;
            if (result === "Error" || result.successRate === 0) {
              totalFailed++;
            }
          }
          if (totalFailed > 0) {
            toast.error(
              \`All methods failed for \${totalFailed} provider(s) on \${domain}\`
            );
          }
        }`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
