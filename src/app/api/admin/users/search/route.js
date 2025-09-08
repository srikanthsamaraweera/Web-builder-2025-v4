import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim();
    if (!email) {
      return Response.json({ users: [] }, { status: 200 });
    }

    // Use service role to look up users by email (partial, case-insensitive)
    const { data, error } = await supabaseAdmin
      .schema("auth")
      .from("users")
      .select("id, email")
      .ilike("email", `%${email}%`)
      .limit(20);
    if (error) throw error;
    return Response.json({ users: data ?? [] });
  } catch (e) {
    return Response.json({ users: [], error: "search_failed" }, { status: 500 });
  }
}
