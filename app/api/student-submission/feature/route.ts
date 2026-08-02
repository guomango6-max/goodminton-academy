// Feature / un-feature a student submission for the peer wall.
//
// POST    — coach marks a submission as featured (requires coach token).
// DELETE  — either coach un-features, OR the student themselves takes their own
//           submission down (requires the credential matching the record's
//           student_id; no coach approval needed — psychological safety floor).

import { NextResponse } from 'next/server';
import { isPeerFeedCategory } from '@/lib/peer-feed-types';
import { resolveStudentLogin } from '@/lib/student-login';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getCoachToken(req: Request, body: { token?: string } | null) {
  return cleanText(req.headers.get('x-goodminton-coach-token')) || cleanText(body?.token);
}

function isCoachAuthorized(provided: string) {
  const expected = cleanText(process.env.GOODMINTON_COACH_ACTION_TOKEN);
  return Boolean(expected) && provided === expected;
}

type FeaturePayload = {
  token?: string;
  recordId?: string;
  angle?: string;
  category?: string;
  tier?: string;
};

// Coach-wide list of recent submissions with their featured state, so the
// coach page can pick what to put on the wall. Token-gated: this is the one
// view that pairs a student_id with their submission text.
export async function GET(req: Request) {
  if (!isCoachAuthorized(getCoachToken(req, null))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ submissions: [] });
  }

  const { data, error } = await supabase
    .from('student_history_records')
    .select(
      'external_id, student_id, record_type, title, happened_at, created_at, featured, featured_angle, featured_category, featured_tier, coach_feedback',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[peer-wall-list-error]', error);
    return NextResponse.json({ error: 'Failed to load submissions.' }, { status: 502 });
  }

  return NextResponse.json({ submissions: data || [] });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as FeaturePayload | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  if (!isCoachAuthorized(getCoachToken(req, body))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const recordId = cleanText(body.recordId);
  if (!recordId) {
    return NextResponse.json({ error: 'Missing recordId.' }, { status: 400 });
  }

  const angle = cleanText(body.angle);
  if (!angle) {
    return NextResponse.json({ error: 'Coach angle (导读) is required.' }, { status: 400 });
  }
  if (angle.length > 280) {
    return NextResponse.json({ error: 'Coach angle is too long (max 280 chars).' }, { status: 400 });
  }

  const category = cleanText(body.category);
  if (!isPeerFeedCategory(category)) {
    return NextResponse.json(
      { error: 'category must be one of correction | drill_seed | honest_stuck | good_question.' },
      { status: 400 },
    );
  }

  const tier = cleanText(body.tier).slice(0, 8); // 'C2', 'B1', 'A2', etc — short.

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const { error, data } = await supabase
    .from('student_history_records')
    .update({
      featured: true,
      featured_at: new Date().toISOString(),
      featured_angle: angle,
      featured_category: category,
      featured_tier: tier || null,
    })
    .eq('external_id', recordId)
    .select('external_id')
    .maybeSingle();

  if (error) {
    console.error('[peer-wall-feature-error]', error);
    return NextResponse.json({ error: 'Failed to feature submission.' }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, recordId: data.external_id });
}

type UnfeaturePayload = {
  token?: string;
  recordId?: string;
  credential?: string;   // student self-unfeature path
  studentId?: string;
  accessCode?: string;
};

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as UnfeaturePayload | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const recordId = cleanText(body.recordId);
  if (!recordId) {
    return NextResponse.json({ error: 'Missing recordId.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  // Path A: coach token → allowed to un-feature any record.
  if (isCoachAuthorized(getCoachToken(req, body))) {
    const { error } = await supabase
      .from('student_history_records')
      .update({ featured: false })
      .eq('external_id', recordId);

    if (error) {
      console.error('[peer-wall-unfeature-coach-error]', error);
      return NextResponse.json({ error: 'Failed to un-feature submission.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, by: 'coach' });
  }

  // Path B: student credential → allowed only on their own record.
  const { studentId } = body.credential
    ? resolveStudentLogin(body.credential)
    : resolveStudentLogin(body.studentId, body.accessCode);

  if (!studentId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // Verify ownership before mutating — defense in depth.
  const { data: row, error: lookupError } = await supabase
    .from('student_history_records')
    .select('external_id, student_id')
    .eq('external_id', recordId)
    .maybeSingle();

  if (lookupError) {
    console.error('[peer-wall-unfeature-lookup-error]', lookupError);
    return NextResponse.json({ error: 'Failed to verify submission.' }, { status: 502 });
  }
  if (!row || row.student_id !== studentId) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  }

  const { error } = await supabase
    .from('student_history_records')
    .update({ featured: false })
    .eq('external_id', recordId);

  if (error) {
    console.error('[peer-wall-unfeature-student-error]', error);
    return NextResponse.json({ error: 'Failed to un-feature submission.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, by: 'student' });
}
