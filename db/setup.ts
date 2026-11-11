import { SQL } from "bun";

const url = Bun.env.DATABASE_URL;
if (!url || !/^(mysql|mysql2|mariadb):\/\//.test(url) || new URL(url).pathname.length < 2) {
  throw new Error("Set DATABASE_URL to the MariaDB database you want to initialize.");
}

const [mode, ...extra] = Bun.argv.slice(2);
if (extra.length || (mode !== "init" && mode !== "migrate")) {
  throw new Error("Use bun run db/setup.ts init or bun run db/setup.ts migrate.");
}

const db = new SQL(url);
try {
  if (mode === "init") await db.file(import.meta.dir + "/schema.sql").simple();
  await db.file(import.meta.dir + "/migrations/001-bun-sessions.sql").simple();
  console.log("Database setup complete.");
} finally {
  await db.close();
}
