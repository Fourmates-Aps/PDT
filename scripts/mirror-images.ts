import "dotenv/config";
import {
  mirrorPending,
  mirrorStatus,
  registerCatalogueImages,
} from "@/lib/import/images";

/**
 * Copy supplier images into our own storage.
 *
 *   npm run mirror                 register new URLs, then mirror a batch
 *   npm run mirror -- --all        keep going until nothing is pending
 *   npm run mirror -- --limit 50 --concurrency 12
 *   npm run mirror -- --status     report only, no network calls
 *
 * Safe to run repeatedly and safe to interrupt: work is claimed from the
 * database, so a killed run loses nothing and the next one carries on.
 */

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string, fallback: number) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : fallback;
};

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function report() {
  const s = await mirrorStatus();
  console.log(
    `  ${s.mirrored} mirrored · ${s.pending} pending · ${s.failed} gave up · ${mb(s.bytes)} stored`,
  );
  return s;
}

async function main() {
  if (flag("status")) {
    console.log("Mirror status:");
    await report();
    return;
  }

  const added = await registerCatalogueImages();
  console.log(`Registered ${added} new image URL(s) from the catalogue.`);
  await report();

  const limit = value("limit", 200);
  /*
   * Tunable rather than fixed. Suppliers are not obliged to tolerate us pulling
   * thousands of files at once, and getting rate-limited or blocked would cause
   * the exact problem mirroring exists to prevent — so this stays modest by
   * default and is raised deliberately, watching the failure count.
   */
  const concurrency = value("concurrency", 6);
  let rounds = 0;

  for (;;) {
    const result = await mirrorPending(limit, concurrency);
    if (result.claimed === 0) {
      console.log("\nNothing left to mirror.");
      break;
    }
    rounds++;
    console.log(
      `Round ${rounds}: ${result.mirrored} mirrored, ${result.failed} failed (of ${result.claimed}).`,
    );
    if (!flag("all")) break;
  }

  console.log("\nFinal:");
  const s = await report();

  if (s.failed > 0) {
    console.log(
      `\n${s.failed} image(s) gave up after repeated failures. They keep their\n` +
        `supplier URL, so the page still tries the original and falls back to a\n` +
        `placeholder. Inspect with:\n` +
        `  select source_url, last_error from media_assets where mirrored_at is null and attempts >= 3 limit 20;`,
    );
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("\nMirror failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
