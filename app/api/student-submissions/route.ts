import { NextResponse } from 'next/server';
import { resolveStudentLogin } from '@/lib/student-login';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type StudentSubmissionRow = {
  payload?: unknown;
};

type StudentSubmissionLog = {
  id?: string;
  submissionType?: string;
  studentId?: string;
  submittedAt?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    credential?: string;
    studentId?: string;
    accessCode?: string;
  } | null;

  // 2026-08-11 移除限流：按 IP 计数会误伤同网学员，见 forum-profile 同注。
  const { studentId } = body?.credential
    ? resolveStudentLogin(body.credential)
    : resolveStudentLogin(body?.studentId, body?.accessCode);

  if (!studentId) {
    return NextResponse.json({ error: 'Invalid student credential.' }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ submissions: [] });
  }

  const { data, error } = await supabase
    .from('student_submissions')
    .select('payload')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[student-submissions-read-error]', error);
    return NextResponse.json({ error: 'Failed to load submissions.' }, { status: 502 });
  }

  const submissions = (data || [])
    .map((row: StudentSubmissionRow) => row.payload)
    .filter((payload): payload is StudentSubmissionLog => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
      const submission = payload as StudentSubmissionLog;
      return submission.studentId === studentId && typeof submission.submittedAt === 'string';
    });

  return NextResponse.json({ submissions });
}
