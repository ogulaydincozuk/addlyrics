// Local development PostgreSQL without Docker or a system install.
// Uses the `embedded-postgres` package (PostgreSQL binaries shipped through npm).
// Production must use a managed/hosted PostgreSQL — see docs/DEPLOYMENT.md.
//
//   npm run db:start   → starts PostgreSQL on 127.0.0.1:54329 (keep the terminal open)
//
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const port = Number(process.env.DEV_DB_PORT ?? 54329);
const databaseDir = path.resolve(".data", "postgres");
const databases = ["addlyrics", "addlyrics_test"];

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "addlyrics",
  password: "addlyrics",
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: (err) => console.error("[postgres]", String(err).trim()),
});

const firstRun = !existsSync(path.join(databaseDir, "PG_VERSION"));
if (firstRun) {
  console.log("[dev-db] Initialising data directory:", databaseDir);
  await pg.initialise();
}

await pg.start();

const client = pg.getPgClient("postgres", "127.0.0.1");
await client.connect();
for (const name of databases) {
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (!rowCount) {
    await client.query(`CREATE DATABASE "${name}"`);
    console.log(`[dev-db] Created database ${name}`);
  }
}
await client.end();

console.log(`[dev-db] PostgreSQL is running on postgresql://addlyrics:addlyrics@127.0.0.1:${port}/addlyrics`);
console.log("[dev-db] Press Ctrl+C to stop.");

const shutdown = async () => {
  console.log("\n[dev-db] Stopping PostgreSQL…");
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep the process alive while PostgreSQL runs.
setInterval(() => {}, 1 << 30);
