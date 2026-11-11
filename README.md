# Sewer Inspection

A React and shadcn inspection workspace served by Bun, with MariaDB for accounts, organizations, projects, assets, and inspection history.

## Run locally

Use Bun 1.4.4 or newer and a MariaDB release that supports native UUID columns (10.7 or newer). Create an empty database and a database user, then copy `.env.example` to `.env` and set `DATABASE_URL`. URL-encode special characters in credentials.

```sh
bun install
bun run db/setup.ts init
bun dev
```

Open http://localhost:3000. Register to create an account and an organization, then sign in. New accounts start with their own organization. Existing users see the organizations they already belong to.

## Use an existing database

Restore a backup into an isolated MariaDB database and point `DATABASE_URL` there first. Run the additive migration below, sign in with a legacy account, and verify organization membership, projects, asset data, and inspection history before switching traffic. The migration creates only the session table. For an existing database, use `migrate` as the setup mode.

```sh
bun run db/setup.ts migrate
bun start
```

Users sign in again after cutover. A successful legacy sign-in upgrades that user's password hash to Argon2id. The old .NET app cannot authenticate users with upgraded hashes or accounts created by Bun. Keep a pre-cutover backup and account for password changes in any rollback plan.

In production, serve the app over HTTPS and set `PUBLIC_ORIGIN` to its external origin when using a reverse proxy. `HOST` and `PORT` control the listen address. The runtime database account needs CRUD privileges on the application tables. Run schema setup with an account that can create tables in the selected database.

## Checks

```sh
bun check
bun test
bun run build
```

Set `TEST_DATABASE_URL` to an empty, disposable MariaDB database to include integration tests. The tests initialize its schema and populate it with test records.
