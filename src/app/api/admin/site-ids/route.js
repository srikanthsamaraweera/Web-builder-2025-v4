import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase admin client is not configured" },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("sites")
      .select("id, owner");

    if (error) {
      console.error("Failed to fetch site ids", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sites: data ?? [] });
  } catch (err) {
    console.error("Unexpected error fetching site ids", err);
    return NextResponse.json(
      { error: "Unexpected error fetching site ids" },
      { status: 500 }
    );
  }
}
