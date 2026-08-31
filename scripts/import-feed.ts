import "dotenv/config";
import { CONNECTORS, publishRun, rejectRun, stageImport } from "@/lib/import/run";
import { listRemote } from "@/lib/import/connectors/fristads";

/**
 * Run a supplier feed import from the command line.
 *
 *   npm run import -- FRISTADS --file ./sample.csv        stage and show the diff
 *   npm run import -- FRISTADS --file ./sample.csv --publish
 *   npm run import -- --publish-run <uuid>                publish something staged
 *   npm run import -- --reject-run <uuid>
 *
 * Staging is the default and publishing is opt-in, because publishing replaces
 * what a customer's shop sells. Credentials come from the environment; none are
 * accepted as arguments, since anything on a command line ends up in shell
 * history and process listings.
 */

type Args = {
  supplier?: string;
  file?: string;
  limit?: number;
  publish: boolean;
  publishRun?: string;
  rejectRun?: string;
  /** Discover what is on the supplier's server before importing anything. */
  list?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { publish: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") args.file = argv[++i];
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--publish") args.publish = true;
    else if (arg === "--publish-run") args.publishRun = argv[++i];
    else if (arg === "--reject-run") args.rejectRun = argv[++i];
    else if (arg === "--list") {
      // Optional path; defaults to the root.
      const next = argv[i + 1];
      args.list = next && !next.startsWith("--") ? argv[++i] : "/";
    }
    else if (!arg.startsWith("--")) args.supplier = arg.toUpperCase();
  }

  return args;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.publishRun) {
    const result = await publishRun(args.publishRun);
    console.log(
      `Published: ${result.created} created, ${result.updated} updated, ${result.discontinued} discontinued.`,
    );
    return;
  }

  if (args.rejectRun) {
    await rejectRun(args.rejectRun);
    console.log(`Run ${args.rejectRun} rejected. The diff is kept.`);
    return;
  }

  if (args.list !== undefined) {
    console.log(`Listing ${args.list} on the Fristads FTP…`);
    const entries = await listRemote(args.list);
    if (entries.length === 0) {
      console.log("  (empty)");
      return;
    }
    for (const entry of entries) {
      const size = entry.isDirectory
        ? "<dir>"
        : `${(entry.size / 1024).toFixed(0)} KB`;
      console.log(`  ${size.padStart(10)}  ${entry.name}`);
    }
    return;
  }

  if (!args.supplier) {
    console.error(
      `Usage: npm run import -- <SUPPLIER> [--file path] [--limit n] [--publish]\n` +
        `Connectors: ${Object.keys(CONNECTORS).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Staging ${args.supplier}…`);
  const run = await stageImport(args.supplier, {
    file: args.file,
    limit: args.limit,
  });

  console.log(`\nRun    ${run.runId}`);
  console.log(`Source ${run.source}`);
  console.log(
    `\n  ${plural(run.counts.created, "new product", "new products")}` +
      `\n  ${plural(run.counts.updated, "change", "changes")}` +
      `\n  ${plural(run.counts.discontinued, "discontinued", "discontinued")}` +
      `\n  ${plural(run.counts.unchanged, "unchanged", "unchanged")}` +
      (run.skipped > 0 ? `\n  ${plural(run.skipped, "skipped row", "skipped rows")}` : ""),
  );

  const notable = run.changes.filter((c) => c.type !== "unchanged").slice(0, 15);
  if (notable.length > 0) {
    console.log("\nFirst changes:");
    for (const change of notable) {
      console.log(`  [${change.type}] ${change.supplierSku} — ${change.summary}`);
    }
  }

  if (!args.publish) {
    console.log(
      `\nNothing has been published. Review, then:\n` +
        `  npm run import -- --publish-run ${run.runId}`,
    );
    return;
  }

  const result = await publishRun(run.runId);
  console.log(
    `\nPublished: ${result.created} created, ${result.updated} updated, ${result.discontinued} discontinued.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nImport failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
