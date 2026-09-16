import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCsvFromRows, gatherHeadersFromRows, getTimestampSuffix } from "@/lib/backupUtils";

export const dynamic = "force-dynamic";

const STORAGE_LIST_LIMIT = 1000;
const AUTH_PAGE_SIZE = 1000;
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

const recoveryGuide = `# Backup recovery notes

This archive is an application-level export, created with the Supabase service role.

Included:
- JSON and CSV exports of every application table listed in manifest.json
- Supabase Auth user metadata (including IDs and identities, but not password hashes)
- Bucket metadata and every downloadable object from every Storage bucket

Recovery order:
1. Create a replacement Supabase project.
2. Apply the SQL migrations from this application's Git repository.
3. Recreate authentication accounts. Password hashes are not available through the Supabase Admin API, so users may need password-reset invitations.
4. Import profiles before dependent rows, then sites, payments, webhook events, and inquiry delivery metadata.
5. Recreate Storage buckets using storage/buckets.json, then upload files using storage/files.json as the path map.
6. Configure RLS policies, secrets, Stripe webhooks, authentication redirects, and SMTP.
7. Reconcile subscription state against Stripe before reopening the application.

Keep this archive private. It contains personal data, authentication metadata, payment references, and uploaded files.
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
      formatVersion: 2,
      createdAt: createdAt.toISOString(),
      tables: {},
      authUsers: 0,
      storageBuckets: [],
      storageFiles: 0,
      limitations: [
        "Authentication password hashes are not available through the Supabase Admin API.",
        "Database schema, functions, triggers, extensions, and RLS policies must be restored from repository migrations.",
        "Stripe remains the source of truth for subscription and payment reconciliation.",
      ],
    };

    for (const table of TABLES) {
      const rows = await fetchTableRows(table);
      const headers = gatherHeadersFromRows(rows);
      databaseFolder.file(`${table}.json`, JSON.stringify(rows, null, 2));
      databaseFolder.file(`${table}.csv`, buildCsvFromRows(rows, headers));
      manifest.tables[table] = { rows: rows.length, formats: ["json", "csv"] };
    }

    const authUsers = await fetchAuthUsers();
    authFolder.file("users.json", JSON.stringify(authUsers, null, 2));
    authFolder.file("users.csv", buildCsvFromRows(authUsers, gatherHeadersFromRows(authUsers)));
    manifest.authUsers = authUsers.length;

    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
    if (bucketError) throw new Error(`Failed to list storage buckets: ${bucketError.message}`);
    storageFolder.file("buckets.json", JSON.stringify(buckets ?? [], null, 2));

    const storageIndex = [];
    for (const bucket of buckets ?? []) {
      const bucketId = bucket.id;
      const paths = await listStorageFiles(bucketId);
      manifest.storageBuckets.push({ id: bucketId, files: paths.length });
      for (const filePath of paths) {
        const { data, error } = await supabaseAdmin.storage.from(bucketId).download(filePath);
        if (error) throw new Error(`Failed to download "${bucketId}/${filePath}": ${error.message}`);
        const archivePath = `files/${safeArchivePath(bucketId)}/${safeArchivePath(filePath)}`;
        storageFolder.file(archivePath, Buffer.from(await data.arrayBuffer()));
        storageIndex.push({ bucket: bucketId, path: filePath, archivePath: `storage/${archivePath}` });
      }
    }
    storageFolder.file("files.json", JSON.stringify(storageIndex, null, 2));
    manifest.storageFiles = storageIndex.length;

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("RECOVERY.md", recoveryGuide);

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
