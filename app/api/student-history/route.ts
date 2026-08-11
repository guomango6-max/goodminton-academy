import { NextResponse } from 'next/server';
import { resolveStudentLogin } from '@/lib/student-login';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type StudentLessonRecord = {
  id?: string;
  date: string;
  title: string;
  mainContent?: string[];
  focus?: string;
  coachNote: string;
  studentNote: string;
  homeworkDone: number;
  homeworkTotal: number;
  coachFeedback?: string;
  coachLiked?: boolean;
};

type StudentSubmissionLog = {
  id?: string;
  submissionType?: 'lesson' | 'match';
  studentId?: string;
  studentName?: string;
  submittedAt?: string;
  lessonSummary?: {
    date?: string;
    title?: string;
    studentReflection?: string;
    question?: string;
    confidence?: number;
    completedHomework?: string[];
  };
  matchReview?: {
    match?: string;
    score?: string;
    whatWorked?: string;
    nextAdjustment?: string;
    experience?: string;
  };
  coachFeedback?: string;
  coachLiked?: boolean;
};

type StudentSubmissionRow = {
  payload?: unknown;
};

type StudentHistoryRow = {
  external_id: string;
  created_at?: string;
  happened_at?: string | null;
  student_id: string;
  student_name?: string | null;
  record_type: 'lesson_record' | 'lesson_summary' | 'match_review';
  title?: string | null;
  payload?: unknown;
  coach_feedback?: string | null;
  coach_liked?: boolean | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isMissingHistoryTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /student_history_records/i.test(error.message || '');
}

function normalizeSubmissionLog(value: unknown, studentId: string): StudentSubmissionLog | null {
  if (!isObject(value)) return null;
  const submission = value as StudentSubmissionLog;
  if (submission.studentId !== studentId || typeof submission.submittedAt !== 'string') return null;
  if (submission.submissionType !== 'lesson' && submission.submissionType !== 'match') return null;
  return submission;
}

function lessonRecordFromHistory(row: StudentHistoryRow): StudentLessonRecord | null {
  if (!isObject(row.payload)) return null;
  const payload = row.payload;
  const record = isObject(payload.lessonRecord) ? payload.lessonRecord : payload;
  const date = cleanText(record.date) || cleanText(row.happened_at);
  const title = cleanText(record.title) || cleanText(row.title);
  if (!date || !title) return null;

  return {
    id: cleanText(record.id) || row.external_id,
    date,
    title,
    mainContent: Array.isArray(record.mainContent) ? record.mainContent.map(cleanText).filter(Boolean) : undefined,
    focus: cleanText(record.focus),
    coachNote: cleanText(record.coachNote),
    studentNote: cleanText(record.studentNote),
    homeworkDone: Number.isFinite(record.homeworkDone) ? Number(record.homeworkDone) : 0,
    homeworkTotal: Number.isFinite(record.homeworkTotal) ? Number(record.homeworkTotal) : 0,
    coachFeedback: cleanText(row.coach_feedback),
    coachLiked: Boolean(row.coach_liked),
  };
}

function submissionFromHistory(row: StudentHistoryRow): StudentSubmissionLog | null {
  if (!isObject(row.payload)) return null;
  const payload = row.payload;
  const existing = normalizeSubmissionLog(payload.submission, row.student_id) || normalizeSubmissionLog(payload, row.student_id);
  if (existing) {
    return {
      ...existing,
      coachFeedback: cleanText(row.coach_feedback),
      coachLiked: Boolean(row.coach_liked),
    };
  }

  const submittedAt = `${cleanText(row.happened_at) || cleanText(row.created_at) || new Date().toISOString()}T00:00:00.000Z`;
  const base = {
    id: row.external_id,
    studentId: row.student_id,
    studentName: cleanText(row.student_name),
    submittedAt,
  };

  if (row.record_type === 'lesson_summary') {
    const lessonSummary = isObject(payload.lessonSummary) ? payload.lessonSummary : payload;
    return {
      ...base,
      submissionType: 'lesson',
      lessonSummary: {
        date: cleanText(lessonSummary.date) || cleanText(row.happened_at),
        title: cleanText(lessonSummary.title) || cleanText(row.title),
        studentReflection: cleanText(lessonSummary.studentReflection) || cleanText(lessonSummary.coachNote),
        question: cleanText(lessonSummary.question),
        confidence: Number.isFinite(lessonSummary.confidence) ? Number(lessonSummary.confidence) : 0,
        completedHomework: Array.isArray(lessonSummary.completedHomework)
          ? lessonSummary.completedHomework.map(cleanText).filter(Boolean)
          : [],
      },
      matchReview: { match: '', score: '', whatWorked: '', nextAdjustment: '', experience: '' },
      coachFeedback: cleanText(row.coach_feedback),
      coachLiked: Boolean(row.coach_liked),
    };
  }

  if (row.record_type === 'match_review') {
    const matchReview = isObject(payload.matchReview) ? payload.matchReview : payload;
    return {
      ...base,
      submissionType: 'match',
      lessonSummary: { date: '', title: '', studentReflection: '', question: '', confidence: 0, completedHomework: [] },
      matchReview: {
        match: cleanText(matchReview.match) || cleanText(row.title),
        score: cleanText(matchReview.score),
        whatWorked: cleanText(matchReview.whatWorked),
        nextAdjustment: cleanText(matchReview.nextAdjustment),
        experience: cleanText(matchReview.experience),
      },
      coachFeedback: cleanText(row.coach_feedback),
      coachLiked: Boolean(row.coach_liked),
    };
  }

  return null;
}

function mergeSubmissions(primary: StudentSubmissionLog[], secondary: StudentSubmissionLog[]) {
  const seen = new Set<string>();
  return [...primary, ...secondary]
    .filter((log) => {
      const key = log.id || `${log.studentId}-${log.submissionType}-${log.submittedAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => (right.submittedAt || '').localeCompare(left.submittedAt || ''))
    .slice(0, 100);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    credential?: string;
    studentId?: string;
    accessCode?: string;
  } | null;

  const { studentId } = body?.credential
    ? resolveStudentLogin(body.credential)
    : resolveStudentLogin(body?.studentId, body?.accessCode);

  if (!studentId) {
    return NextResponse.json({ error: 'Invalid student credential.' }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ lessonRecords: [], submissions: [] });
  }

  const [submissionResult, historyResult] = await Promise.all([
    supabase
      .from('student_submissions')
      .select('payload')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false })
      .limit(100),
    supabase
      .from('student_history_records')
      .select('*')
      .eq('student_id', studentId)
      .order('happened_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (submissionResult.error) {
    console.error('[student-submissions-read-error]', submissionResult.error);
    return NextResponse.json({ error: 'Failed to load submissions.' }, { status: 502 });
  }

  const submissions = (submissionResult.data || [])
    .map((row: StudentSubmissionRow) => normalizeSubmissionLog(row.payload, studentId))
    .filter((payload): payload is StudentSubmissionLog => Boolean(payload));

  if (historyResult.error) {
    if (!isMissingHistoryTable(historyResult.error)) {
      console.error('[student-history-read-error]', historyResult.error);
    }
    return NextResponse.json({ lessonRecords: [], submissions });
  }

  const historyRows = (historyResult.data || []) as StudentHistoryRow[];
  const lessonRecords = historyRows
    .filter((row) => row.record_type === 'lesson_record')
    .map(lessonRecordFromHistory)
    .filter((record): record is StudentLessonRecord => Boolean(record));
  const historySubmissions = historyRows
    .filter((row) => row.record_type !== 'lesson_record')
    .map(submissionFromHistory)
    .filter((record): record is StudentSubmissionLog => Boolean(record));

  return NextResponse.json({
    lessonRecords,
    submissions: mergeSubmissions(historySubmissions, submissions),
  });
}
