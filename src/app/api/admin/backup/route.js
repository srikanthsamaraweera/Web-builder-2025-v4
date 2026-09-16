import JSZip from "jszip";
import { promises as fs } from "node:fs";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCsvFromRows, gatherHeadersFromRows, getTimestampSuffix } from "@/lib/backupUtils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const STORAGE_LIST_LIMIT = 1000;
const AUTH_PAGE_SIZE = 1000;
const STORAGE_DOWNLOAD_CONCURRENCY = 8;
const TABLES = [
  "profiles",
  "sites",
  "subscription_payments",
  "stripe_webhook_events",
  "site_inquiry_deliveries",
];

async function requireAdmin(request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return { ok: false };
  const token = auth.slice(7);
  const { data: udata, error: uerr } = await supabaseAdmin.auth.getUser(token);
  if (uerr || !udata?.user) return { ok: false };
  const uid = udata.user.id;
  const { data: prof } = await supabaseAdmin.from("profiles").select("role").eq("id", uid).single();
  if ((prof?.role || "USER") !== "ADMIN") return { ok: false };
  return { ok: true };
}

const safeArchivePath = (value) =>
  String(value)
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

async function listStorageFiles(bucketId) {
  const files = [];
  const prefixes = [""];
  while (prefixes.length > 0) {
    const prefix = prefixes.pop();
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabaseAdmin.storage.from(bucketId).list(prefix, {
        limit: STORAGE_LIST_LIMIT,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new Error(`Failed to list storage path "${bucketId}/${prefix}": ${error.message}`);
      }
      if (!data?.length) break;
      for (const entry of data) {
        if (!entry || typeof entry.name !== "string") continue;
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) files.push(fullPath);
        else prefixes.push(fullPath);
      }
      hasMore = data.length === STORAGE_LIST_LIMIT;
      offset += data.length;
    }
  }
  return files;
}

async function fetchTableRows(table) {
  const { data, error } = await supabaseAdmin.from(table).select("*");
  if (error) throw new Error(`Failed to fetch "${table}" table: ${error.message}`);
  return data ?? [];
}

async function fetchAuthUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: AUTH_PAGE_SIZE,
    });
    if (error) throw new Error(`Failed to export authentication users: ${error.message}`);
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < AUTH_PAGE_SIZE) break;
    page += 1;
  }
  return users;
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function addSchemaMigrations(zip) {
  const migrationsPath = path.join(process.cwd(), "supabase", "migrations");
  const migrationFolder = zip.folder("schema/migrations");
  if (!migrationFolder) throw new Error("Unable to initialize schema archive structure.");

  const filenames = (await fs.readdir(migrationsPath))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of filenames) {
    migrationFolder.file(filename, await fs.readFile(path.join(migrationsPath, filename)));
  }
  return filenames;
}

async function addRecoveryScript(zip) {
  const scriptPath = path.join(process.cwd(), "recovery", "RESTORE.mjs");
  zip.file("RESTORE.mjs", await fs.readFile(scriptPath));
}

const recoveryGuide = `# Backup recovery notes

This archive is an application-level export, created with the Supabase service role.

Included:
- JSON and CSV exports of every application table listed in manifest.json
- Supabase Auth user metadata (including IDs and identities, but not password hashes)
- Bucket metadata and every downloadable object from every Storage bucket
- Ordered SQL migrations needed to recreate the database schema, functions, triggers, indexes, and RLS policies

Recovery order:
1. Create a replacement Supabase project.
2. Apply every SQL file in schema/migrations in filename order.
3. Set NEW_SUPABASE_URL and NEW_SUPABASE_SERVICE_ROLE_KEY locally, then run node RESTORE.mjs.
4. Review RESTORE-REPORT.json and auth/USER-ID-MAPPING-COMPLETED.csv.
5. Send password-reset emails to restored users; password hashes are not available through the Supabase Admin API.
6. Reconfigure project secrets, Stripe webhooks, authentication redirects/providers, email templates, and SMTP.
7. Reconcile subscription state against Stripe before reopening the application.

Keep this archive private. It contains personal data, authentication metadata, payment references, and uploaded files.
`;

const recoverySteps = `LANKAN WEB DIRECTORY - DISASTER RECOVERY STEPS
=================================================

IMPORTANT
---------
Keep this ZIP private. It contains personal data, authentication metadata,
payment references, and uploaded files.

This package must be used together with:
- The application's Git repository
- A secure copy of the production environment variables
- Access to Stripe, Brevo, Turnstile, the hosting provider, and the domain/DNS

Supabase does not provide user password hashes through its Admin API. Users
must therefore receive password-reset emails after recovery.


1. CREATE A REPLACEMENT SUPABASE PROJECT
----------------------------------------
Create a new Supabase project and securely record its project URL, anon key,
service-role key, and database connection details.


2. RECREATE THE DATABASE SCHEMA
-------------------------------
In the new project's SQL Editor, run every .sql file found in
schema/migrations in ascending filename order. Begin with:

20260401000000_create_core_tables.sql

Do not skip files or change their order.


3. RECREATE AUTHENTICATION USERS
--------------------------------
Do not recreate users manually for a normal recovery. RESTORE.mjs reads
auth/users.json, creates or matches every user through the new project's
Supabase Admin API, assigns a random inaccessible temporary password to new
accounts, and records the UUID mapping automatically.

auth/USER-ID-MAPPING.csv is included only as an audit/fallback worksheet. The
completed mapping is written to auth/USER-ID-MAPPING-COMPLETED.csv.


4. RUN THE AUTOMATED RESTORE SCRIPT
-----------------------------------
Install Node.js 20 or newer, extract this ZIP, open a terminal in the extracted
folder, and set these environment variables without putting them in the ZIP:

NEW_SUPABASE_URL=https://YOUR-NEW-PROJECT.supabase.co
NEW_SUPABASE_SERVICE_ROLE_KEY=YOUR-NEW-SERVICE-ROLE-KEY

Then run:

node RESTORE.mjs

The script automatically creates or matches users by email, records every old
and new UUID in auth/USER-ID-MAPPING-COMPLETED.csv, remaps dependent database
values and Storage paths, imports all tables in dependency order, uploads all
files, and writes RESTORE-REPORT.json.

The automated remapping covers:

- profiles.id
- sites.owner
- sites.approved_by (when present)
- subscription_payments.user_id
- The first folder segment of Storage object paths

Do not run multiple restore processes simultaneously. The script can safely
match users already created by an earlier interrupted run and upserts database
rows and Storage objects where supported.


5. DATABASE RESTORE ORDER USED BY THE SCRIPT
--------------------------------------------
RESTORE.mjs imports JSON data in this exact order:

1. database/profiles.json
2. database/sites.json
3. database/subscription_payments.json
4. database/stripe_webhook_events.json
5. database/site_inquiry_deliveries.json

The numeric IDs in subscription_payments regenerate because the application
does not use them as foreign keys. Never place the service-role key in browser
code, in this ZIP, or in source control.


6. STORAGE RESTORE PERFORMED BY THE SCRIPT
------------------------------------------
The schema migrations create and configure the site-assets bucket. RESTORE.mjs
uploads all objects under storage/files/site-assets and automatically remaps
the user-UUID folder. storage/files.json contains the original path and
archive-path index. storage/buckets.json contains bucket metadata.


7. CONFIGURE THE DEPLOYMENT
---------------------------
Deploy the Git repository and configure the production environment variables.
Update all Supabase values to those of the replacement project, including:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- PG_DUMP_URL, if used

Also restore the Stripe, Brevo, Turnstile, application URL, pricing, legal,
and other application environment variables from the secure secrets copy.


8. RECONFIGURE SUPABASE SETTINGS
--------------------------------
Manually restore settings that are not included in this ZIP:

- Site URL and allowed redirect URLs
- Authentication providers
- SMTP/email delivery configuration
- Authentication email templates
- Any other project-level settings


9. RECONFIGURE EXTERNAL SERVICES
--------------------------------
- Change the Stripe webhook destination to the restored production URL.
- Store the new Stripe webhook signing secret in the deployment.
- Verify Brevo sender/domain settings.
- Verify Turnstile allowed hostnames and keys.
- Reconcile subscription state with Stripe before reopening the application.


10. SEND PASSWORD-RESET EMAILS
------------------------------
Send password-reset links to all restored users. Do not send temporary
passwords by email.


11. VERIFY THE RESTORED APPLICATION
-----------------------------------
Before changing DNS or reopening the service, test:

- Password reset and user login
- Correct profile and website ownership
- Admin access
- Public website pages
- All logos, hero images, and gallery images
- Website editing and new uploads
- Inquiry delivery
- Stripe Checkout and Customer Portal
- Stripe webhook processing
- Backup download

Compare restored totals with manifest.json, including table row counts,
authentication-user count, bucket count, and Storage-file count.


12. REOPEN PRODUCTION
---------------------
Only after all checks pass, update the production domain/DNS and reopen the
application. Keep the original backup unchanged until the restored service
has been operating successfully and another verified backup has been made.
`;

export async function POST(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return Response.json({ error: "forbidden" }, { status: 403 });

    const createdAt = new Date();
    const zip = new JSZip();
    const databaseFolder = zip.folder("database");
    const storageFolder = zip.folder("storage");
    const authFolder = zip.folder("auth");
    if (!databaseFolder || !storageFolder || !authFolder) {
      throw new Error("Unable to initialize backup archive structure.");
    }

    const manifest = {
      formatVersion: 3,
      createdAt: createdAt.toISOString(),
      recoveryScript: "RESTORE.mjs",
      tables: {},
      authUsers: 0,
      storageBuckets: [],
      storageFiles: 0,
      schemaMigrations: [],
      limitations: [
        "Authentication password hashes are not available through the Supabase Admin API.",
        "Supabase project settings, secrets, authentication providers, email templates, and logs are not exportable through this archive.",
        "Stripe remains the source of truth for subscription and payment reconciliation.",
      ],
    };

    manifest.schemaMigrations = await addSchemaMigrations(zip);
    await addRecoveryScript(zip);

    const tableExports = await Promise.all(
      TABLES.map(async (table) => ({ table, rows: await fetchTableRows(table) }))
    );
    for (const { table, rows } of tableExports) {
      const headers = gatherHeadersFromRows(rows);
      databaseFolder.file(`${table}.json`, JSON.stringify(rows, null, 2));
      databaseFolder.file(`${table}.csv`, buildCsvFromRows(rows, headers));
      manifest.tables[table] = { rows: rows.length, formats: ["json", "csv"] };
    }

    const authUsers = await fetchAuthUsers();
    authFolder.file("users.json", JSON.stringify(authUsers, null, 2));
    authFolder.file("users.csv", buildCsvFromRows(authUsers, gatherHeadersFromRows(authUsers)));
    const userIdMapping = authUsers.map((user) => ({
      email: user.email ?? "",
      old_user_uuid: user.id,
      new_user_uuid: "",
    }));
    authFolder.file(
      "USER-ID-MAPPING.csv",
      buildCsvFromRows(userIdMapping, ["email", "old_user_uuid", "new_user_uuid"])
    );
    manifest.authUsers = authUsers.length;

    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
    if (bucketError) throw new Error(`Failed to list storage buckets: ${bucketError.message}`);
    storageFolder.file("buckets.json", JSON.stringify(buckets ?? [], null, 2));

    const bucketFiles = await Promise.all(
      (buckets ?? []).map(async (bucket) => ({
        bucketId: bucket.id,
        paths: await listStorageFiles(bucket.id),
      }))
    );

    const filesToDownload = [];
    for (const { bucketId, paths } of bucketFiles) {
      manifest.storageBuckets.push({ id: bucketId, files: paths.length });
      for (const filePath of paths) {
        filesToDownload.push({ bucketId, filePath });
      }
    }

    const storageIndex = await mapWithConcurrency(
      filesToDownload,
      STORAGE_DOWNLOAD_CONCURRENCY,
      async ({ bucketId, filePath }) => {
        const { data, error } = await supabaseAdmin.storage.from(bucketId).download(filePath);
        if (error) throw new Error(`Failed to download "${bucketId}/${filePath}": ${error.message}`);
        const archivePath = `files/${safeArchivePath(bucketId)}/${safeArchivePath(filePath)}`;
        storageFolder.file(archivePath, Buffer.from(await data.arrayBuffer()));
        return { bucket: bucketId, path: filePath, archivePath: `storage/${archivePath}` };
      }
    );
    storageFolder.file("files.json", JSON.stringify(storageIndex, null, 2));
    manifest.storageFiles = storageIndex.length;

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("RECOVERY.md", recoveryGuide);
    zip.file("RECOVERY-STEPS.txt", recoverySteps);

    const filename = `site-backup-${getTimestampSuffix(createdAt)}.zip`;
    const archive = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(archive, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Admin backup failed", error);
    return Response.json({ error: error.message || "backup_failed" }, { status: 500 });
  }
}
