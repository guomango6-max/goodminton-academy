import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { publicHealthPayload } from '@/lib/public-health.mjs';

export async function GET() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(publicHealthPayload(false));
  }

  const { error } = await supabase
    .from('student_submissions')
    .select('id')
    .limit(1);

  return NextResponse.json(publicHealthPayload(!error));
}
