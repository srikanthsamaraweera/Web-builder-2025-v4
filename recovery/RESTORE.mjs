import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backupDirectory = path.dirname(fileURLToPath(import.meta.url));
const supabaseUrl = String(process.env.NEW_SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = String(process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || "");
const batchSize = Math.max(1, Number(process.env.RESTORE_BATCH_SIZE || 100));

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Set NEW_SUPABASE_URL and NEW_SUPABASE_SERVICE_ROLE_KEY before running this script."
  );
  process.exit(1);
}

const serviceHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

const report = {
  startedAt: new Date().toISOString(),
  usersCreated: 0,
  usersMatched: 0,
  tables: {},
  storageUploaded: 0,
  warnings: [],
  failures: [],
};

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(backupDirectory, relativePath), "utf8"));
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 1000)}`);
  }
  return response;
}

async function listExistingUsers() {
  const byEmail = new Map();
  let page = 1;
  while (true) {
    const response = await apiFetch(
      `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`,
      { headers: serviceHeaders }
    );
    const payload = await response.json();
    const users = Array.isArray(payload) ? payload : payload.users || [];
    for (const user of users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user);
    }
    if (users.length < 1000) break;
    page += 1;
  }
  return byEmail;
}

async function createUser(oldUser) {
  const response = await apiFetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...serviceHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: oldUser.email,
      phone: oldUser.phone || undefined,
      password: randomBytes(32).toString("base64url"),
      email_confirm: Boolean(oldUser.email_confirmed_at || oldUser.confirmed_at),
      phone_confirm: Boolean(oldUser.phone_confirmed_at),
      user_metadata: oldUser.user_metadata || {},
      app_metadata: oldUser.app_metadata || {},
    }),
  });
  const payload = await response.json();
  return payload.user || payload;
}

function replaceIds(value, idMap) {
  if (Array.isArray(value)) return value.map((item) => replaceIds(item, idMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceIds(item, idMap)])
    );
  }
  if (typeof value !== "string") return value;
  let result = value;
  for (const [oldId, newId] of idMap) result = result.split(oldId).join(newId);
  return result;
}

async function restoreTable(table, rows, idMap) {
  const remapped = rows.map((row) => replaceIds(row, idMap));
  if (table === "subscription_payments") {
    for (const row of remapped) delete row.id;
  }

  for (let index = 0; index < remapped.length; index += batchSize) {
    const chunk = remapped.slice(index, index + batchSize);
    await apiFetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...serviceHeaders,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
  }
  report.tables[table] = remapped.length;
}

function encodedObjectPath(value) {
  return String(value)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function contentTypeFor(filename) {
  const extension = path.extname(filename).toLowerCase();
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  }[extension] || "application/octet-stream";
}

async function restoreStorage(idMap) {
  const files = await readJson("storage/files.json");
  for (const item of files) {
    const destinationPath = replaceIds(item.path, idMap);
    const localPath = path.join(backupDirectory, ...item.archivePath.split("/"));
    const bytes = await fs.readFile(localPath);
    await apiFetch(
      `${supabaseUrl}/storage/v1/object/${encodeURIComponent(item.bucket)}/${encodedObjectPath(destinationPath)}`,
      {
        method: "POST",
        headers: {
          ...serviceHeaders,
          "Content-Type": contentTypeFor(destinationPath),
          "x-upsert": "true",
        },
        body: bytes,
      }
    );
    report.storageUploaded += 1;
  }
}

async function writeMappingCsv(mappingRows) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = ["email,old_user_uuid,new_user_uuid"];
  for (const row of mappingRows) {
    lines.push([row.email, row.old_user_uuid, row.new_user_uuid].map(escape).join(","));
  }
  await fs.writeFile(
    path.join(backupDirectory, "auth", "USER-ID-MAPPING-COMPLETED.csv"),
    `${lines.join("\n")}\n`
  );
}

async function main() {
  console.log("Starting recovery. Do not interrupt this process.");
  const oldUsers = await readJson("auth/users.json");
  const existingUsers = await listExistingUsers();
  const idMap = new Map();
  const mappingRows = [];

  for (const oldUser of oldUsers) {
    if (!oldUser.email) {
      report.failures.push({ oldUserId: oldUser.id, error: "User has no email address" });
      continue;
    }
    const emailKey = oldUser.email.toLowerCase();
    let newUser = existingUsers.get(emailKey);
    if (newUser) {
      report.usersMatched += 1;
    } else {
      newUser = await createUser(oldUser);
      existingUsers.set(emailKey, newUser);
      report.usersCreated += 1;
    }
    if (!newUser?.id) throw new Error(`No new UUID returned for ${oldUser.email}`);
    idMap.set(oldUser.id, newUser.id);
    mappingRows.push({
      email: oldUser.email,
      old_user_uuid: oldUser.id,
      new_user_uuid: newUser.id,
    });
    console.log(`Mapped ${oldUser.email}`);
  }

  if (idMap.size !== oldUsers.length) {
    throw new Error("Not every authentication user could be mapped. Data import was stopped.");
  }
  await writeMappingCsv(mappingRows);

  const tableOrder = [
    "profiles",
    "sites",
    "subscription_payments",
    "stripe_webhook_events",
    "site_inquiry_deliveries",
  ];
  for (const table of tableOrder) {
    const rows = await readJson(`database/${table}.json`);
    await restoreTable(table, rows, idMap);
    console.log(`Restored ${rows.length} rows to ${table}`);
  }

  await restoreStorage(idMap);
  report.finishedAt = new Date().toISOString();
  report.mappingSha256 = createHash("sha256")
    .update(JSON.stringify(mappingRows))
    .digest("hex");
  await fs.writeFile(
    path.join(backupDirectory, "RESTORE-REPORT.json"),
    JSON.stringify(report, null, 2)
  );
  console.log("Recovery data import completed. Read RESTORE-REPORT.json and run the verification checklist.");
}

main().catch(async (error) => {
  report.finishedAt = new Date().toISOString();
  report.failures.push({ error: error.message });
  await fs
    .writeFile(path.join(backupDirectory, "RESTORE-REPORT.json"), JSON.stringify(report, null, 2))
    .catch(() => {});
  console.error(`Recovery stopped: ${error.message}`);
  process.exitCode = 1;
});
