import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCsvFromRows, gatherHeadersFromRows, getTimestampSuffix } from "@/lib/backupUtils";

export const dynamic = "force-dynamic";

const SITE_ASSETS_BUCKET = "site-assets";
const STORAGE_LIST_LIMIT = 1000;

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

async function listStorageFiles() {
  const files = [];
  const prefixes = [""];
  while (prefixes.length > 0) {
    const prefix = prefixes.pop();
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabaseAdmin.storage
        .from(SITE_ASSETS_BUCKET)
        .list(prefix, {
          limit: STORAGE_LIST_LIMIT,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
      if (error) {
        throw new Error(`Failed to list storage path "${prefix || '/'}": ${error.message}`);
      }
      if (!data || data.length === 0) {
        hasMore = false;
        continue;
      }
      data.forEach((entry) => {
        if (!entry || typeof entry.name !== "string") return;
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) {
          files.push(fullPath);
        } else {
          prefixes.push(fullPath);
        }
      });
      if (data.length < STORAGE_LIST_LIMIT) {
        hasMore = false;
      } else {
        offset += data.length;
      }
    }
  }
  return files;
}

async function fetchTableRows(table) {
  const { data, error } = await supabaseAdmin.from(table).select("*");
  if (error) throw new Error(`Failed to fetch "${table}" table: ${error.message}`);
  return data ?? [];
}

async function fetchTableColumns(table) {
  const { data, error } = await supabaseAdmin
    .from("information_schema.columns")
    .select("column_name, ordinal_position")
    .eq("table_schema", "public")
    .eq("table_name", table)
    .order("ordinal_position", { ascending: true });
  if (error) throw new Error(`Failed to fetch column metadata for "${table}": ${error.message}`);
  return data?.map((item) => item.column_name) ?? [];
}

export async function POST(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return Response.json({ error: "forbidden" }, { status: 403 });

    const zip = new JSZip();
    const storageFolder = zip.folder("storage");
    const databaseFolder = zip.folder("database");
    if (!storageFolder || !databaseFolder) {
      throw new Error("Unable to initialize backup archive structure.");
    }

    const storageFiles = await listStorageFiles();
    for (let index = 0; index < storageFiles.length; index += 1) {
      const filePath = storageFiles[index];
      const { data, error } = await supabaseAdmin.storage.from(SITE_ASSETS_BUCKET).download(filePath);
      if (error) throw new Error(`Failed to download "${filePath}": ${error.message}`);
      const arrayBuffer = await data.arrayBuffer();
      storageFolder.file(filePath, Buffer.from(arrayBuffer));
    }

    const tables = ["sites", "profiles"];
    for (const table of tables) {
      const rows = await fetchTableRows(table);
      let headers = gatherHeadersFromRows(rows);
      if (headers.length === 0) {
        headers = await fetchTableColumns(table);
      }
      if (headers.length === 0) {
        throw new Error(`Unable to determine columns for the "${table}" table.`);
      }
      const csv = buildCsvFromRows(rows, headers);
      databaseFolder.file(`${table}.csv`, csv);
    }

    const filename = `site-backup-${getTimestampSuffix(new Date())}.zip`;
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
