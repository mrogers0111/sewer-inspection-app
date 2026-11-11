import { serve, SQL } from "bun";
import index from "./index.html";
import { createApi } from "./server/api";

const databaseUrl = Bun.env.DATABASE_URL;
if (!databaseUrl || !/^(mysql|mysql2|mariadb):\/\//.test(databaseUrl)) {
  throw new Error("Set DATABASE_URL to a MariaDB connection URL. See README.md.");
}

const production = Bun.env.NODE_ENV === "production";
const publicOrigin = Bun.env.PUBLIC_ORIGIN ? new URL(Bun.env.PUBLIC_ORIGIN).origin : undefined;
const db = new SQL(databaseUrl);
const api = createApi(db, { secure: production, origin: publicOrigin });

const server = serve({
  port: Number(Bun.env.PORT ?? 3000),
  hostname: Bun.env.HOST ?? "127.0.0.1",
  maxRequestBodySize: 512 * 1024,
  routes: { "/api": api, "/api/*": api, "/*": index },
  development: !production && { hmr: true },
});

console.log(`Sewer Inspection is running at ${server.url}`);
