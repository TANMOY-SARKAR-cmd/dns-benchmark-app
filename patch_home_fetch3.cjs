const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// The replacement was done twice because I ran the first patch_home earlier which didn't fail to modify but failed after due to CommonJS.
// Let's remove the duplicated logic.
code = code.replace(
  /const udp_percentage = \(stats\.udp \/ Math\.max\(stats\.total, 1\)\) \* 100;\s*const doh_percentage = \(stats\.doh \/ Math\.max\(stats\.total, 1\)\) \* 100;\s*const fallback_percentage = \(stats\.fallback \/ Math\.max\(stats\.total, 1\)\) \* 100;\s*const failure_percentage = \(stats\.failed \/ Math\.max\(stats\.total, 1\)\) \* 100;\s*let stability_status = "Stable";\s*if \(failure_percentage > 20 \|\| fallback_percentage > 30 \|\| \(jitter !== null && jitter > 50\)\) \{\s*stability_status = "Unreliable";\s*\} else if \(failure_percentage > 10 \|\| fallback_percentage > 15 \|\| \(jitter !== null && jitter > 25\)\) \{\s*stability_status = "Unstable";\s*\}/g,
  `const udp_percentage = (stats.udp / Math.max(stats.total, 1)) * 100;
          const doh_percentage = (stats.doh / Math.max(stats.total, 1)) * 100;
          const fallback_percentage = (stats.fallback / Math.max(stats.total, 1)) * 100;
          const failure_percentage = (stats.failed / Math.max(stats.total, 1)) * 100;

          let stability_status = "Stable";
          if (failure_percentage > 20 || fallback_percentage > 30 || (jitter !== null && jitter > 50)) {
            stability_status = "Unreliable";
          } else if (failure_percentage > 10 || fallback_percentage > 15 || (jitter !== null && jitter > 25)) {
            stability_status = "Unstable";
          }`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
