import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug')?.trim();
  const excludeId = searchParams.get('excludeId')?.trim();

  if (!slug || !/^[a-z0-9-]{3,30}$/.test(slug)) {
    return Response.json({ available: false, reason: 'invalid' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin.from('sites').select('id', { count: 'exact', head: true }).eq('slug', slug);
    if (excludeId) query = query.neq('id', excludeId);
    const { count, error } = await query;
    if (error) throw error;
    const available = (count || 0) === 0;
    return Response.json({ available });
  } catch (e) {
    return Response.json({ available: false, error: 'lookup_failed' }, { status: 500 });
  }
}

