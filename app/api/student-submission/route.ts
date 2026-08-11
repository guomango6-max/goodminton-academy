import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type StudentSubmissionPayload = {
  id?: string;
  mode?: 'create' | 'update';
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
};

const NTFY_TOPIC = process.env.GOODMINTON_STUDENT_NTFY_TOPIC || process.env.NTFY_TOPIC || 'goodminton-feedback-ef27280b6181';
// 2026-08-11 移除限流：按 IP 计数会误伤同网学员，见 forum-profile 同注。

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSubmission(value: StudentSubmissionPayload) {
  const studentId = cleanText(value.studentId);
  const studentName = cleanText(value.studentName);
  const submittedAt = cleanText(value.submittedAt) || new Date().toISOString();
  const lessonSummary = value.lessonSummary || {};
  const matchReview = value.matchReview || {};

  return {
    id: cleanText(value.id) || `${studentId || 'student'}-${submittedAt}`,
    submissionType: value.submissionType === 'match' ? 'match' : 'lesson',
    studentId,
    studentName,
    submittedAt,
    lessonSummary: {
      date: cleanText(lessonSummary.date),
      title: cleanText(lessonSummary.title),
      studentReflection: cleanText(lessonSummary.studentReflection),
      question: cleanText(lessonSummary.question),
      confidence: Number.isFinite(lessonSummary.confidence) ? lessonSummary.confidence : 0,
      completedHomework: Array.isArray(lessonSummary.completedHomework)
        ? lessonSummary.completedHomework.map(cleanText).filter(Boolean)
        : [],
    },
    matchReview: {
      match: cleanText(matchReview.match),
      score: cleanText(matchReview.score),
      whatWorked: cleanText(matchReview.whatWorked),
      nextAdjustment: cleanText(matchReview.nextAdjustment),
      experience: cleanText(matchReview.experience),
    },
  };
}

function toNtfyBody(submission: ReturnType<typeof normalizeSubmission>) {
  if (submission.submissionType === 'match') {
    return [
      `类型：比赛复盘`,
      `学员：${submission.studentName || submission.studentId}`,
      `ID：${submission.studentId}`,
      `提交时间：${submission.submittedAt}`,
      '',
      `比赛 / 对手：${submission.matchReview.match || '未填写'}`,
      `比分：${submission.matchReview.score || '未填写'}`,
      `有效的地方：${submission.matchReview.whatWorked || '未填写'}`,
      `待改进的点：${submission.matchReview.nextAdjustment || '未填写'}`,
      `积累的经验：${submission.matchReview.experience || '未填写'}`,
    ].join('\n');
  }

  const homework = submission.lessonSummary.completedHomework.length
    ? submission.lessonSummary.completedHomework.join(', ')
    : '未勾选';

  return [
    `类型：课后总结`,
    `学员：${submission.studentName || submission.studentId}`,
    `ID：${submission.studentId}`,
    `提交时间：${submission.submittedAt}`,
    '',
    `课程：${submission.lessonSummary.date} ${submission.lessonSummary.title}`,
    `掌握度：${submission.lessonSummary.confidence || '-'} / 5`,
    `完成作业：${homework}`,
    '',
    '课后总结：',
    submission.lessonSummary.studentReflection || '未填写',
    '',
    '最近想学习的内容：',
    submission.lessonSummary.question || '未填写',
    '',
  ].join('\n');
}

async function sendStudentSubmissionNtfy(submission: ReturnType<typeof normalizeSubmission>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        title: `[student/${submission.submissionType}] ${submission.studentId}`,
        tags: 'badminton,memo',
      },
      body: toNtfyBody(submission),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`ntfy failed: ${response.status} ${response.statusText} ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function archiveStudentSubmission(submission: ReturnType<typeof normalizeSubmission>) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return false;
  }

  const payload = {
    external_id: submission.id,
    student_id: submission.studentId,
    student_name: submission.studentName,
    submission_type: submission.submissionType,
    submitted_at: submission.submittedAt,
    lesson_date: submission.lessonSummary.date || null,
    lesson_title: submission.lessonSummary.title || null,
    payload: submission,
    status: 'new',
  };

  const { error } = await supabase
    .from('student_submissions')
    .upsert(payload, { onConflict: 'external_id' });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function archiveStudentHistoryRecord(submission: ReturnType<typeof normalizeSubmission>) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return false;
  }

  const isMatch = submission.submissionType === 'match';
  const happenedAt = isMatch
    ? submission.submittedAt.slice(0, 10)
    : submission.lessonSummary.date || submission.submittedAt.slice(0, 10);
  const title = isMatch
    ? submission.matchReview.match || '比赛复盘'
    : submission.lessonSummary.title || '课后总结';

  const { error } = await supabase
    .from('student_history_records')
    .upsert(
      {
        external_id: submission.id,
        student_id: submission.studentId,
        student_name: submission.studentName,
        record_type: isMatch ? 'match_review' : 'lesson_summary',
        happened_at: happenedAt || null,
        title,
        payload: { submission },
        source: 'website',
        status: 'new',
      },
      { onConflict: 'external_id' },
    );

  if (error) {
    const missingHistoryTable =
      error.code === '42P01' || error.code === 'PGRST205' || /student_history_records/i.test(error.message || '');
    if (missingHistoryTable) {
      return false;
    }
    throw new Error(error.message);
  }

  return true;
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as StudentSubmissionPayload | null;

  if (!raw) {
    return NextResponse.json({ error: 'Invalid submission payload.' }, { status: 400 });
  }

  const submission = normalizeSubmission(raw);
  const mode = raw.mode === 'update' ? 'update' : 'create';

  if (!submission.studentId || !submission.studentName) {
    return NextResponse.json({ error: 'Missing student identity.' }, { status: 400 });
  }

  if (mode === 'update' && !cleanText(raw.id)) {
    return NextResponse.json({ error: 'Update requires an existing submission id.' }, { status: 400 });
  }

  const hasLessonContent =
    submission.lessonSummary.studentReflection ||
    submission.lessonSummary.question ||
    submission.lessonSummary.completedHomework.length > 0;
  const hasMatchContent =
    submission.matchReview.match ||
    submission.matchReview.score ||
    submission.matchReview.whatWorked ||
    submission.matchReview.nextAdjustment ||
    submission.matchReview.experience;

  if (submission.submissionType === 'lesson' && !hasLessonContent) {
    return NextResponse.json({ error: 'Lesson summary is empty.' }, { status: 400 });
  }

  if (submission.submissionType === 'match' && !hasMatchContent) {
    return NextResponse.json({ error: 'Match review is empty.' }, { status: 400 });
  }

  let archived = false;
  let historyArchived = false;

  try {
    archived = await archiveStudentSubmission(submission);
    historyArchived = await archiveStudentHistoryRecord(submission);
  } catch (error) {
    console.error('[student-submission-archive-error]', error);
    return NextResponse.json({ error: 'Failed to save submission.' }, { status: 502 });
  }

  if (mode === 'update') {
    return NextResponse.json({ ok: true, archived, historyArchived, notified: false, mode });
  }

  try {
    await sendStudentSubmissionNtfy(submission);
    return NextResponse.json({ ok: true, archived, historyArchived, notified: true });
  } catch (error) {
    console.error('[student-submission-ntfy-error]', error);
    if (archived) {
      return NextResponse.json({ ok: true, archived, historyArchived, notified: false });
    }
    return NextResponse.json({ error: 'Failed to notify coach.' }, { status: 502 });
  }
}
