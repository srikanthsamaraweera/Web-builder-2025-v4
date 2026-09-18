import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const SITE_ASSETS_BUCKET = "site-assets";
export const SITE_ASSET_URL_TTL_SECONDS = 60 * 60;

export function siteAssetPaths(site) {
  return [
    site?.logo,
    ...(Array.isArray(site?.hero) ? site.hero : []),
    ...(Array.isArray(site?.gallery) ? site.gallery : []),
  ].filter((path, index, paths) =>
    typeof path === "string" && path.length > 0 && paths.indexOf(path) === index
  );
}

export async function createSiteAssetUrls(site) {
  const paths = siteAssetPaths(site);
  if (paths.length === 0) return {};

  const { data, error } = await supabaseAdmin.storage
    .from(SITE_ASSETS_BUCKET)
    .createSignedUrls(paths, SITE_ASSET_URL_TTL_SECONDS);

  if (error) {
    console.error("Failed to sign site asset URLs", error);
    return {};
  }

  return Object.fromEntries(
    (data || [])
      .filter((item) => item?.path && item?.signedUrl)
      .map((item) => [item.path, item.signedUrl]),
  );
}
