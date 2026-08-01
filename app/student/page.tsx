'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Lang, useLang } from '../components/LangContext';
import type { PeerFeedItem } from '../../lib/peer-feed-types';

type StudentPathItem = {
  label: string;
  active: boolean;
};

type StudentActivity = {
  label: string;
  value: string;
  note: string;
};

type ReviewItem = {
  title: string;
  source: string;
  status: string;
  detail: string;
};

type KnowledgeLink = {
  from: string;
  to: string;
  weight: string;
};

type Achievement = {
  id: string;
  title: string;
  category: string;
  level: 'bronze' | 'silver' | 'gold' | 'locked';
  status: 'earned' | 'in_progress' | 'locked';
  description: string;
  progress: number;
  target: number;
  earnedAt?: string;
};

type StudentData = {
  studentId: string;
  name: string;
  level: string;
  reviewMode: string;
  progress: number;
  stage: {
    title: string;
    description: string;
    path: StudentPathItem[];
    pathProgress: number;
  };
  today: {
    title: string;
    description: string;
  };
  activity: StudentActivity[];
  tags: string[];
  reviewQueue: ReviewItem[];
  knowledgeLinks: KnowledgeLink[];
  recentFeedback: string[];
  lessonSummary?: {
    date: string;
    title: string;
    studentReflection: string;
    coachNote: string;
    homework: Array<{
      id: string;
      text: string;
      done: boolean;
    }>;
  };
  matchReview?: {
    match: string;
    score: string;
    whatWorked: string;
    nextAdjustment: string;
    experience?: string;
  };
  abilityMatrix?: Array<{
    label: string;
    value: number;
  }>;
  skillTree?: Array<{
    group: string;
    nodes: Array<{
      label: string;
      status: 'done' | 'active' | 'locked';
    }>;
  }>;
  achievements?: Achievement[];
  lessonHistory?: Array<{
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
  }>;
  growthPath?: Array<{
    date: string;
    stage: string;
    ability: string;
    score: number;
  }>;
  lastUpdated: string;
  i18n?: {
    en?: Partial<Omit<StudentData, 'i18n'>>;
  };
};

type StudentDraft = {
  checkedHomework?: string[];
  checkedHomeworkDate?: string;
  lessonInput?: {
    studentReflection?: string;
    question?: string;
    confidence?: string;
  };
  matchInput?: {
    match?: string;
    score?: string;
    whatWorked?: string;
    nextAdjustment?: string;
    experience?: string;
  };
};

type StudentSubmissionLog = {
  id: string;
  submissionType: 'lesson' | 'match';
  studentId: string;
  studentName: string;
  submittedAt: string;
  lessonSummary: {
    date?: string;
    title?: string;
    studentReflection: string;
    question: string;
    confidence: number;
    completedHomework: string[];
  };
  matchReview: {
    match: string;
    score: string;
    whatWorked: string;
    nextAdjustment: string;
    experience: string;
  };
  coachFeedback?: string;
  coachLiked?: boolean;
};

const STUDENT_SESSION_EVENT = 'goodminton-student-current-change';
const STUDENT_CURRENT_KEY = 'goodminton-student-current';
const STUDENT_CREDENTIAL_KEY = 'goodminton-student-credential';
let cachedCurrentStudentRaw: string | null | undefined;
let cachedCurrentStudent: StudentData | null = null;

const studentCopy = {
  zh: {
    portal: '学员图谱',
    nav: ['总览', '课后总结', '训练日志', '比赛复盘', '家庭作业', '当前任务', '个人能力', '成就勋章'],
    logout: '退出',
    breadcrumb: '学员图谱',
    trainingData: (name: string) => `${name} 的训练数据`,
    updated: (date: string) => `每个知识点都保留来源、反馈和下一次训练验证点。最后更新：${date}`,
    level: '等级',
    progress: '进度',
    mode: '模式',
    lessonSummary: '课后总结',
    lessonReflection: '我今天学到了什么 / 卡在哪里',
    lessonReflectionPlaceholder: '用自己的话写，不用写漂亮。',
    learningInterest: '我还有什么问题 / 下次想练什么',
    learningInterestPlaceholder: '例如：封网时身体冲出去收不回来；接杀左右两侧衔接慢；下次想练防转攻。',
    confidence: '我对本次重点的把握程度',
    coachObservation: '教练观察',
    submitLessonTitle: '提交课后总结',
    submitLessonDesc: '只发送本栏总结、问题、掌握度和作业完成状态。',
    submitting: '提交中...',
    submitSummary: '提交总结',
    matchReview: '比赛复盘',
    matchOpponent: '比赛 / 对手',
    matchOpponentPlaceholder: '例如：周末双打练习赛',
    score: '比分',
    scorePlaceholder: '例如：21-18 / 17-21',
    whatWorked: '有效的地方',
    whatWorkedPlaceholder: '哪些回合、哪些打法有效？',
    nextAdjustment: '待改进的点',
    nextAdjustmentPlaceholder: '写下这场之后最想改进的地方。',
    experience: '积累的经验',
    experiencePlaceholder: '这场比赛以后，下次可以直接复用的一条经验。',
    submitMatchTitle: '提交比赛复盘',
    submitMatchDesc: '只发送本栏比赛、比分、有效点、改进点和经验。',
    submitReview: '提交复盘',
    homework: '家庭作业',
    currentTraining: '当前训练',
    todayPractice: '今日最小练习',
    reviewed: '已审查',
    markReviewed: '标记为已审查',
    abilityMatrix: '能力矩阵',
    achievements: '成就和勋章',
    skillTree: '技能树',
    lessonLog: '上课日志',
    submissionRecord: '历史记录',
    submissionLog: '最近提交',
    historyLessons: '上课记录',
    historySummaries: '课后总结',
    historyMatches: '比赛复盘',
    recent20: '保留最近 20 条',
    lesson: '课后总结',
    match: '比赛复盘',
    homeworkCount: (count: number) => `作业 ${count} 项`,
    reviewPrefix: '复盘：',
    summaryPrefix: '总结：',
    empty: '未填写',
    noLogs: '还没有记录。',
    edit: '修改',
    save: '保存',
    cancel: '取消',
    expand: '展开',
    collapse: '收起',
    saved: '已保存',
    saving: '保存中...',
    editingLesson: '正在修改一条课后总结',
    editingMatch: '正在修改一条比赛复盘',
    coachFeedback: '教练点评',
    coachLiked: '教练已点赞',
    emptyLesson: '请先填写课后总结、问题，或勾选作业。',
    emptyMatch: '请先填写比赛复盘内容。',
    lessonSent: '课后总结已发送给教练，并保留本机日志。',
    matchSent: '比赛复盘已发送给教练，并保留本机日志。',
    sendFailed: (message: string) => `已保存到本机日志，但发送给教练失败：${message}`,
    loginTitle: '打开学员档案',
    credential: '学员凭证',
    credentialPlaceholder: '学员ID / demo',
    loginLoading: '读取中...',
    enter: '进入学员页',
    backHome: '返回主页',
    enterCredential: '请输入学员凭证。',
    loadingProfile: '正在读取学员档案...',
    opened: '已打开学员档案。',
    timeout: '读取超时，请再试一次。',
    failed: '读取失败。',
    sectionTag: '学员数据',
    sending: '正在发送给教练...',
    sendFailedGeneric: '发送失败。',
    sendTimeout: '发送超时',
    rankBadgeLabel: '等级徽章',
    featuredLabel: '收藏',
    peerWall: '其他学员',
    peerWallDescription: '由教练精选展示，不显示真实姓名。',
    peerWallEmpty: '还没有教练精选的内容。',
    peerWallCoachAngle: '教练导读',
    peerWallAnonStudent: (tier: string) => (tier ? `${tier} 学员` : '学员'),
    peerWallExpand: '展开完整',
    peerWallCollapse: '收起',
    peerWallMarkRead: '我已读',
    peerWallMarkedRead: '已读 ✓',
    peerWallCategory: {
      correction: '纠错点',
      drill_seed: 'Drill 种子',
      honest_stuck: '诚实的卡点',
      good_question: '好问题',
    } as Record<string, string>,
    peerWallTypeLesson: '课后总结',
    peerWallTypeMatch: '比赛复盘',
  },
  en: {
    portal: 'Student Map',
    nav: ['Overview', 'Lesson Summary', 'Training Log', 'Match Review', 'Homework', 'Current Task', 'Ability', 'Badges'],
    logout: 'Log out',
    breadcrumb: 'Student Map',
    trainingData: (name: string) => `${name}'s Training Data`,
    updated: (date: string) => `Each item keeps its source, feedback, and next training check. Last updated: ${date}`,
    level: 'Level',
    progress: 'Progress',
    mode: 'Mode',
    lessonSummary: 'Lesson Summary',
    lessonReflection: 'What I learned today / where I got stuck',
    lessonReflectionPlaceholder: 'Write it in your own words. It does not need to be polished.',
    learningInterest: 'Questions / what I want to train next',
    learningInterestPlaceholder: 'Example: I rush forward after net kills and cannot recover; next time I want to train the next shot after defending.',
    confidence: 'My confidence with today’s focus',
    coachObservation: 'Coach Observation',
    submitLessonTitle: 'Submit Lesson Summary',
    submitLessonDesc: 'Only this summary, question, confidence score, and homework status will be sent.',
    submitting: 'Submitting...',
    submitSummary: 'Submit Summary',
    matchReview: 'Match Review',
    matchOpponent: 'Match / Opponent',
    matchOpponentPlaceholder: 'Example: weekend doubles practice match',
    score: 'Score',
    scorePlaceholder: 'Example: 21-18 / 17-21',
    whatWorked: 'What worked',
    whatWorkedPlaceholder: 'Which rallies or patterns worked?',
    nextAdjustment: 'What to improve',
    nextAdjustmentPlaceholder: 'Write the main thing to improve after this match.',
    experience: 'Reusable lesson',
    experiencePlaceholder: 'One lesson you can reuse next time.',
    submitMatchTitle: 'Submit Match Review',
    submitMatchDesc: 'Only this match, score, what worked, improvement point, and lesson will be sent.',
    submitReview: 'Submit Review',
    homework: 'Homework',
    currentTraining: 'Current Training',
    todayPractice: 'Smallest Practice Today',
    reviewed: 'Reviewed',
    markReviewed: 'Mark Reviewed',
    abilityMatrix: 'Ability Matrix',
    achievements: 'Achievements and Badges',
    skillTree: 'Skill Tree',
    lessonLog: 'Training Log',
    submissionRecord: 'History',
    submissionLog: 'Recent Submissions',
    historyLessons: 'Lesson Records',
    historySummaries: 'Lesson Summaries',
    historyMatches: 'Match Reviews',
    recent20: 'Keeps the latest 20 items',
    lesson: 'Lesson Summary',
    match: 'Match Review',
    homeworkCount: (count: number) => `${count} homework item${count === 1 ? '' : 's'}`,
    reviewPrefix: 'Review: ',
    summaryPrefix: 'Summary: ',
    empty: 'Not filled',
    noLogs: 'No records yet.',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    expand: 'Open',
    collapse: 'Collapse',
    saved: 'Saved',
    saving: 'Saving...',
    editingLesson: 'Editing one lesson summary',
    editingMatch: 'Editing one match review',
    coachFeedback: 'Coach Feedback',
    coachLiked: 'Liked by coach',
    emptyLesson: 'Please write a lesson summary, question, or check homework first.',
    emptyMatch: 'Please write the match review first.',
    lessonSent: 'Lesson summary sent to the coach and saved locally.',
    matchSent: 'Match review sent to the coach and saved locally.',
    sendFailed: (message: string) => `Saved locally, but failed to send to the coach: ${message}`,
    loginTitle: 'Open Student Profile',
    credential: 'Student Credential',
    credentialPlaceholder: 'Student ID / demo',
    loginLoading: 'Loading...',
    enter: 'Open Student Page',
    backHome: 'Back Home',
    enterCredential: 'Please enter a student credential.',
    loadingProfile: 'Loading student profile...',
    opened: 'Student profile opened.',
    timeout: 'Request timed out. Please try again.',
    failed: 'Load failed.',
    sectionTag: 'Student data',
    sending: 'Sending to the coach...',
    sendFailedGeneric: 'Send failed.',
    sendTimeout: 'Send timed out',
    rankBadgeLabel: 'rank badge',
    featuredLabel: 'Featured',
    peerWall: 'Peers',
    peerWallDescription: 'Curated by the coach. Real names are never shown.',
    peerWallEmpty: 'Nothing featured by the coach yet.',
    peerWallCoachAngle: 'Coach note',
    peerWallAnonStudent: (tier: string) => (tier ? `${tier} Student` : 'A Student'),
    peerWallExpand: 'Show full',
    peerWallCollapse: 'Collapse',
    peerWallMarkRead: 'Mark as read',
    peerWallMarkedRead: 'Read ✓',
    peerWallCategory: {
      correction: 'Correction',
      drill_seed: 'Drill seed',
      honest_stuck: 'Honest stuck point',
      good_question: 'Good question',
    } as Record<string, string>,
    peerWallTypeLesson: 'Lesson summary',
    peerWallTypeMatch: 'Match review',
  },
} as const;

const labelTranslations: Record<string, string> = {
  总览: 'Overview',
  课后总结: 'Lesson Summary',
  比赛复盘: 'Match Review',
  家庭作业: 'Homework',
  当前任务: 'Current Task',
  个人能力: 'Ability',
  成就勋章: 'Badges',
  训练记录: 'Training Log',
  技术: 'Technique',
  步法: 'Footwork',
  战术: 'Tactics',
  身体: 'Physical',
  心理: 'Mental',
  态度: 'Attitude',
  比赛: 'Match',
  学习: 'Learning',
  出勤: 'Attendance',
  自律: 'Discipline',
  习惯: 'Habit',
  练球: 'Practice',
  趣味: 'Fun',
  安全: 'Safety',
  技能: 'Technique',
  初评: 'Initial Check',
  技术基线: 'Technique Baseline',
  步法基线: 'Footwork Baseline',
  实战转化: 'Match Transfer',
  启动: 'Start',
  移动: 'Move',
  衔接: 'Link',
  确认: 'Confirm',
  回动: 'Recover',
  调整: 'Adjust',
  前场: 'Front Court',
  中场: 'Midcourt',
  后场: 'Back Court',
  发接发: 'Serve & Receive',
  青铜: 'Bronze',
  白银: 'Silver',
  黄金: 'Gold',
  铂金: 'Platinum',
  钻石: 'Diamond',
  星耀: 'Star',
  最强王者: 'Master',
  荣耀王者: 'Grandmaster',
  // Achievement profile field default
  学生档案: 'Student Profile',
  // Achievement titles (FALLBACK_ACHIEVEMENTS)
  拍头高: 'Racket head up',
  不怕落后: 'No fear of deficit',
  小动作: 'Compact motion',
  三问侦探: 'Three-question detective',
  深区: 'Deep zone',
  回中: 'Recover to base',
  接发上前: 'Press after return',
  核心开关: 'Core switch',
  水壶准时: 'Bottle on time',
  鞋带检查: 'Laces check',
  第一拍冷静: 'First-shot composure',
  第二拍预判: 'Second-shot read',
  收藏家: 'Collector',
  // Skill tree leaves — serve & receive (发接发)
  发小区: 'Short serve',
  发平高: 'Flick serve',
  搓放: 'Net spin',
  推压: 'Push',
  切抹: 'Slice push',
  防偷后场: 'Guard against flick',
  // Skill tree leaves — front court (前场)
  勾对角: 'Cross-court hook',
  扑杀: 'Net kill',
  封网: 'Net cover',
  挡网: 'Net block',
  前场第二拍: 'Front-court second shot',
  // Skill tree leaves — back court forehand (正手)
  正手高远球: 'Forehand clear',
  正手平高球: 'Forehand flat clear',
  正手劈吊: 'Forehand slice drop',
  正手滑板: 'Forehand reverse slice',
  正手杀球: 'Forehand smash',
  正手软压: 'Forehand soft push',
  正手点杀: 'Forehand stick smash',
  // Skill tree leaves — back court round-the-head (头顶)
  头顶高远球: 'Round-the-head clear',
  头顶平高球: 'Round-the-head flat clear',
  头顶滑板吊球: 'Round-the-head reverse slice drop',
  头顶劈吊: 'Round-the-head slice drop',
  头顶杀球: 'Round-the-head smash',
  // Skill tree leaves — back court backhand (反手)
  反手高远球: 'Backhand clear',
  反手劈吊: 'Backhand slice drop',
  反手滑板吊: 'Backhand reverse slice drop',
  反手抽球: 'Backhand drive',
  // Skill tree leaves — midcourt (中场)
  平抽: 'Drive',
  反抽: 'Backhand drive (mid)',
  拦截: 'Intercept',
  腰部带动: 'Hip-led drive',
  // Skill tree leaves — footwork moves (移动)
  交叉步: 'Crossover step',
  并步: 'Side shuffle',
  垫步: 'Chasse step',
  蹬跨步: 'Lunge step',
  跳腾步: 'Jump step',
  中国跳: 'China jump',
  马来步: 'Malay step',
  李矛步: 'Li Mao step',
  双脚跳: 'Two-foot jump',
  // Skill tree nodes — tactics (战术)
  空间战术: 'Space tactics',
  时间战术: 'Time tactics',
  节奏战术: 'Rhythm tactics',
  线路战术: 'Line tactics',
  对人战术: 'Opponent tactics',
  阵型战术: 'Formation tactics',
  // Skill tree nodes — physical (身体)
  力量: 'Strength',
  速度: 'Speed',
  敏捷: 'Agility',
  耐力: 'Endurance',
  平衡: 'Balance',
  协调: 'Coordination',
  // Skill tree nodes — mental (心理)
  抗压能力: 'Pressure tolerance',
  恢复速度: 'Recovery speed',
  平静沟通: 'Calm communication',
  专注保持: 'Sustained focus',
  决策勇气: 'Decision courage',
  复盘诚实: 'Honest review',
  // Skill tree nodes — attitude (态度)
  反馈具体: 'Specific feedback',
  愿意试错: 'Willing to try',
  训练自觉: 'Self-driven',
  认真负责: 'Responsible',
  准时完成: 'On-time completion',
  主动沟通: 'Proactive communication',
};

// Translations for FALLBACK_ACHIEVEMENTS description tooltips (rendered via title attr in EN).
const achievementDescTranslations: Record<string, string> = {
  '启动反应进入训练档案。': 'Reaction start in the training record.',
  '拍头高度进入技术档案。': 'Racket head height in the technique record.',
  '比分落后时继续执行。': 'Keep executing when behind in score.',
  '前场动作缩短。': 'Front-court motion shortened.',
  '能问出空间、节奏、对人的问题。': 'Asks space, rhythm, and opponent questions.',
  '后场深度继续观察。': 'Back-court depth under continued observation.',
  '击球后回位。': 'Recover to base after the shot.',
  '接发后的前压意识。': 'Forward-press intent after the return.',
  '核心支撑进入身体档案。': 'Core support in the physical record.',
  '好玩但不严肃评价。': 'Light-hearted, not strictly evaluated.',
  '训练安全习惯。': 'Training safety habit.',
  '待解锁。': 'Locked.',
};

function tDesc(value: string, lang: Lang) {
  return lang === 'en' ? achievementDescTranslations[value] || value : value;
}

function tLabel(value: string, lang: Lang) {
  return lang === 'en' ? labelTranslations[value] || value : value;
}

function localizedStudent(student: StudentData, lang: Lang): StudentData {
  if (lang !== 'en' || !student.i18n?.en) return student;
  return {
    ...student,
    ...student.i18n.en,
    studentId: student.studentId,
    i18n: student.i18n,
  } as StudentData;
}

function readStudentDraft(key: string): StudentDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const savedDraft = window.localStorage.getItem(key);

  if (!savedDraft) {
    return null;
  }

  try {
    return JSON.parse(savedDraft) as StudentDraft;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readStudentSubmissionLogs(key: string): StudentSubmissionLog[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const savedLogs = window.localStorage.getItem(key);

  if (!savedLogs) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedLogs);
    return Array.isArray(parsed) ? (parsed as StudentSubmissionLog[]) : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function mergeSubmissionLogs(primary: StudentSubmissionLog[], secondary: StudentSubmissionLog[]) {
  const seen = new Set<string>();
  return [...primary, ...secondary]
    .filter((log) => {
      const key = log.id || `${log.studentId}-${log.submissionType}-${log.submittedAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
    .slice(0, 50);
}

function mergeLessonRecords(
  primary: NonNullable<StudentData['lessonHistory']>,
  secondary: NonNullable<StudentData['lessonHistory']>,
) {
  const seen = new Set<string>();
  return [...primary, ...secondary]
    .filter((lesson) => {
      const key = lesson.id || `${lesson.date}-${lesson.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 100);
}

function readCurrentStudent(): StudentData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const savedStudent = window.sessionStorage.getItem(STUDENT_CURRENT_KEY);

  if (savedStudent === cachedCurrentStudentRaw) {
    return cachedCurrentStudent;
  }

  cachedCurrentStudentRaw = savedStudent;

  if (!savedStudent) {
    cachedCurrentStudent = null;
    return null;
  }

  try {
    cachedCurrentStudent = JSON.parse(savedStudent) as StudentData;
    return cachedCurrentStudent;
  } catch {
    window.sessionStorage.removeItem(STUDENT_CURRENT_KEY);
    cachedCurrentStudentRaw = null;
    cachedCurrentStudent = null;
    return null;
  }
}

function subscribeCurrentStudent(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('storage', listener);
  window.addEventListener(STUDENT_SESSION_EVENT, listener);

  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(STUDENT_SESSION_EVENT, listener);
  };
}

function getCurrentStudentServerSnapshot() {
  return null;
}

function Pill({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className={
        'rounded-full border px-3 py-1.5 text-xs font-medium ' +
        (active
          ? 'border-[#14bf96] bg-[#e9fbf3] text-[#0e6f4d]'
          : 'border-[#dfe7dc] bg-white text-slate-600')
      }
    >
      {children}
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  const { lang } = useLang();
  return (
    <section id={id} className="scroll-mt-28 overflow-hidden rounded-lg border border-[#dfe7dc] bg-[#fffdf8] shadow-sm lg:scroll-mt-6">
      <div className="flex items-center justify-between border-b border-[#dfe7dc] bg-[#f4f8f1] px-5 py-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-[#16845f]">{studentCopy[lang].sectionTag}</div>
      </div>
      <div className="p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

type StudentText = (typeof studentCopy)[Lang];

function HistoryGroup({
  title,
  count,
  open,
  expandLabel,
  collapseLabel,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  expandLabel: string;
  collapseLabel: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#dfe7dc] bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <span>{count}</span>
          <span className="rounded-md border border-[#cfe8d9] bg-[#f4f8f1] px-2 py-1 text-[#0e6f4d]">
            {open ? collapseLabel : expandLabel}
          </span>
        </span>
      </button>
      {open ? <div className="space-y-3 border-t border-[#dfe7dc] p-3">{children}</div> : null}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value?: string | number | string[] }) {
  const display = Array.isArray(value) ? value.filter(Boolean).join(' / ') : value;
  if (!display && display !== 0) return null;
  return (
    <div>
      <b className="text-slate-900">{label}</b>
      <span>{String(display)}</span>
    </div>
  );
}

function ConfidencePicker({
  value,
  onChange,
  lang,
}: {
  value: string;
  onChange: (value: string) => void;
  lang: Lang;
}) {
  const labels =
    lang === 'en'
      ? ['Not sure', 'Know it, miss it', 'Slow drill ok', 'Stable in drill', 'Can use in game']
      : ['不知道做法', '知道但做不到', '慢速能做到', '训练中稳定', '比赛中能用'];

  return (
    <div className="mt-2 grid grid-cols-5 gap-1.5">
      {[1, 2, 3, 4, 5].map((score) => {
        const active = Number(value) === score;
        return (
          <button
            key={score}
            type="button"
            onClick={() => onChange(String(score))}
            className={
              'min-h-14 rounded-md border px-1.5 py-1 text-center text-xs font-semibold leading-4 transition sm:min-h-12 ' +
              (active
                ? 'border-[#16845f] bg-[#16845f] text-white'
                : 'border-[#cfe8d9] bg-white text-[#0e6f4d]')
            }
          >
            <span className="block text-sm">{score}</span>
            <span className="block font-medium">{labels[score - 1]}</span>
          </button>
        );
      })}
    </div>
  );
}

function StudentHistoryPanel({
  lessons = [],
  submissionLogs,
  t,
  lang,
  loading,
}: {
  lessons?: NonNullable<StudentData['lessonHistory']>;
  submissionLogs: StudentSubmissionLog[];
  t: StudentText;
  lang: Lang;
  loading: boolean;
}) {
  const [openLessons, setOpenLessons] = useState(false);
  const [openSummaries, setOpenSummaries] = useState(true);
  const [openMatches, setOpenMatches] = useState(false);
  const lessonSummaries = submissionLogs.filter((log) => log.submissionType === 'lesson');
  const matchReviews = submissionLogs.filter((log) => log.submissionType === 'match');

  if (!lessons.length && !lessonSummaries.length && !matchReviews.length && !loading) {
    return (
      <div className="rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-4 text-sm text-slate-500">
        {t.noLogs}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-3 text-sm text-slate-500">
          <div className="h-4 w-28 rounded bg-slate-200/80" />
          <div className="mt-3 h-3 w-full rounded bg-slate-200/70" />
          <div className="mt-2 h-3 w-3/4 rounded bg-slate-200/70" />
        </div>
      ) : null}

      <HistoryGroup title={t.historySummaries} count={lessonSummaries.length} open={openSummaries} expandLabel={t.expand} collapseLabel={t.collapse} onToggle={() => setOpenSummaries((value) => !value)}>
        {lessonSummaries.length ? lessonSummaries.map((log) => (
          <article key={log.id} className="rounded-md border border-[#dfe7dc] bg-white px-3 py-3 text-sm leading-6 text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-[#e9fbf3] px-2 py-1 font-medium text-[#0e6f4d]">{log.submittedAt.slice(5, 16).replace('T', ' ')}</span>
              <span className="rounded-full bg-[#f4f8f1] px-2 py-1">{t.homeworkCount(log.lessonSummary.completedHomework.length)}</span>
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <div className="text-xs font-medium text-slate-500">{lang === 'en' ? 'Lesson' : '课程'}</div>
                <div className="font-semibold text-slate-950">{log.lessonSummary.title || t.empty}</div>
                {log.lessonSummary.date ? <div className="text-xs text-slate-500">{log.lessonSummary.date}</div> : null}
              </div>
              <DetailLine label={t.summaryPrefix} value={log.lessonSummary.studentReflection || t.empty} />
              <DetailLine label={`${t.learningInterest}: `} value={log.lessonSummary.question || t.empty} />
              <DetailLine
                label={lang === 'en' ? 'Confidence focus: ' : '把握重点：'}
                value={
                  log.lessonSummary.confidence
                    ? `${log.lessonSummary.title || t.empty} · ${log.lessonSummary.confidence} / 5`
                    : t.empty
                }
              />
              <DetailLine label={lang === 'en' ? 'Completed homework: ' : '完成作业：'} value={log.lessonSummary.completedHomework.length ? log.lessonSummary.completedHomework : t.empty} />
            </div>
            {log.coachLiked || log.coachFeedback ? (
              <div className="mt-3 rounded-md border border-[#cfe8d9] bg-[#f7fbf5] px-3 py-2 text-xs leading-5 text-slate-600">
                {log.coachLiked ? <div className="font-medium text-[#16845f]">{t.coachLiked}</div> : null}
                {log.coachFeedback ? <div>{t.coachFeedback}: {log.coachFeedback}</div> : null}
              </div>
            ) : null}
          </article>
        )) : <div className="rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-3 text-sm text-slate-500">{t.noLogs}</div>}
      </HistoryGroup>

      <HistoryGroup title={t.historyLessons} count={lessons.length} open={openLessons} expandLabel={t.expand} collapseLabel={t.collapse} onToggle={() => setOpenLessons((value) => !value)}>
        {lessons.length ? (
          lessons.map((lesson) => (
            <article key={lesson.id || `${lesson.date}-${lesson.title}`} className="rounded-md border border-[#dfe7dc] bg-white px-3 py-3 text-sm leading-6 text-slate-700">
              <div className="text-xs text-slate-500">{lesson.date}</div>
              <div className="mt-1 font-semibold text-slate-950">{lesson.title}</div>
              <div className="mt-2 space-y-1 text-slate-600">
                <DetailLine label={lang === 'en' ? 'Content: ' : '内容：'} value={lesson.mainContent || [lesson.focus || '']} />
                <DetailLine label={lang === 'en' ? 'Student: ' : '学员：'} value={lesson.studentNote} />
                <DetailLine label={lang === 'en' ? 'Homework: ' : '作业：'} value={`${lesson.homeworkDone || 0}/${lesson.homeworkTotal || 0}`} />
              </div>
              {lesson.coachNote ? <div className="mt-2 text-slate-500">{lang === 'en' ? 'Coach: ' : '教练：'}{lesson.coachNote}</div> : null}
              {lesson.coachLiked || lesson.coachFeedback ? (
                <div className="mt-2 rounded-md border border-[#cfe8d9] bg-[#f7fbf5] px-3 py-2 text-xs leading-5 text-slate-600">
                  {lesson.coachLiked ? <div className="font-medium text-[#16845f]">{t.coachLiked}</div> : null}
                  {lesson.coachFeedback ? <div>{t.coachFeedback}: {lesson.coachFeedback}</div> : null}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-3 text-sm text-slate-500">{t.noLogs}</div>
        )}
      </HistoryGroup>

      <HistoryGroup title={t.historyMatches} count={matchReviews.length} open={openMatches} expandLabel={t.expand} collapseLabel={t.collapse} onToggle={() => setOpenMatches((value) => !value)}>
        {matchReviews.length ? matchReviews.map((log) => (
          <article key={log.id} className="rounded-md border border-[#dfe7dc] bg-white px-3 py-3 text-sm leading-6 text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-[#e9fbf3] px-2 py-1 font-medium text-[#0e6f4d]">{log.submittedAt.slice(5, 16).replace('T', ' ')}</span>
            </div>
            <div className="mt-3 space-y-2">
              <DetailLine label={t.reviewPrefix} value={log.matchReview.match || t.empty} />
              <DetailLine label={`${t.score}: `} value={log.matchReview.score || t.empty} />
              <DetailLine label={`${t.whatWorked}: `} value={log.matchReview.whatWorked || t.empty} />
              <DetailLine label={`${t.nextAdjustment}: `} value={log.matchReview.nextAdjustment || t.empty} />
              <DetailLine label={`${t.experience}: `} value={log.matchReview.experience || t.empty} />
            </div>
            {log.coachLiked || log.coachFeedback ? (
              <div className="mt-3 rounded-md border border-[#cfe8d9] bg-[#f7fbf5] px-3 py-2 text-xs leading-5 text-slate-600">
                {log.coachLiked ? <div className="font-medium text-[#16845f]">{t.coachLiked}</div> : null}
                {log.coachFeedback ? <div>{t.coachFeedback}: {log.coachFeedback}</div> : null}
              </div>
            ) : null}
          </article>
        )) : <div className="rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-3 text-sm text-slate-500">{t.noLogs}</div>}
      </HistoryGroup>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#dff5e9]">
      <div className="h-full rounded-full bg-[#16845f]" style={{ width: `${value}%` }} />
    </div>
  );
}

function GoodmintonMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#bdebd8] bg-[linear-gradient(135deg,#e9fbf3,#ffffff)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
      <svg width="32" height="32" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path
          d="M9.8 34.5C7.7 17.5 13.6 7.4 22.1 16.1c5.1 5.2 8.5 13.5 9.9 16.1 1.4-2.6 4.8-10.9 9.9-16.1 8.5-8.7 14.4 1.4 12.3 18.4-2.1 17-10.5 25.3-17.4 17.1-2.5-3-3.9-6.5-4.8-9.1-.9 2.6-2.3 6.1-4.8 9.1-6.9 8.2-15.3-.1-17.4-17.1Z"
          stroke="#bdebd8"
          strokeWidth="7.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.8 34.5C7.7 17.5 13.6 7.4 22.1 16.1c5.1 5.2 8.5 13.5 9.9 16.1 1.4-2.6 4.8-10.9 9.9-16.1 8.5-8.7 14.4 1.4 12.3 18.4-2.1 17-10.5 25.3-17.4 17.1-2.5-3-3.9-6.5-4.8-9.1-.9 2.6-2.3 6.1-4.8 9.1-6.9 8.2-15.3-.1-17.4-17.1Z"
          stroke="#14bf96"
          strokeWidth="4.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function StudentSideNav({ student, lang }: { student: StudentData; lang: Lang }) {
  const t = studentCopy[lang];
  const [activeIndex, setActiveIndex] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  const items: Array<[string, string, boolean]> = [
    ['O', t.nav[0], true],
    ['S', t.nav[1], true],
    ['L', t.nav[2], true],
    ['R', t.nav[3], true],
    ['H', t.nav[4], true],
    ['C', t.nav[5], false],
    ['A', t.nav[6], false],
    ['B', t.nav[7], false],
  ];

  useEffect(() => {
    const sectionCount = items.length;
    const sections = Array.from({ length: sectionCount }, (_, i) =>
      document.getElementById(`student-section-${i}`),
    ).filter(Boolean) as HTMLElement[];

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.id.replace('student-section-', ''), 10);
            if (!isNaN(idx)) {
              setActiveIndex(idx);
              const nav = navRef.current;
              if (nav) {
                const tab = nav.querySelector(`[data-index="${idx}"]`) as HTMLElement | undefined;
                tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }
            }
          }
        }
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside className="sticky top-0 z-30 grid h-screen grid-rows-[auto_1fr_auto] border-r border-[#e6e1d4] bg-[#fbfaf6]/95 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:h-auto max-lg:block max-lg:border-r-0 max-lg:border-t max-lg:shadow-[0_-8px_24px_rgba(15,23,42,0.08)] max-lg:supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)]">
      <div className="grid min-h-32 content-center gap-3 border-b border-[#e6e1d4] p-5 max-lg:hidden">
        <GoodmintonMark />
        <div>
          <h1 className="text-xl font-semibold leading-tight text-slate-950 max-lg:text-base">
            {student.name}
            <span className="max-lg:hidden">
              <br />
              {t.portal}
            </span>
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-lg:truncate">Goodminton progress system · {student.studentId}</p>
        </div>
      </div>

      <div className="relative max-lg:overflow-hidden">
        <nav
          ref={navRef}
          className="py-2 max-lg:grid max-lg:grid-cols-5 max-lg:gap-1 max-lg:px-2 max-lg:py-2"
        >
          {items.map(([icon, label, mobile], index) => (
            <a
              key={label}
              data-index={index}
              href={`#student-section-${index}`}
              className={
                'grid grid-cols-[34px_1fr] items-center gap-2 border-l-4 px-5 py-3 text-sm font-semibold transition max-lg:min-h-14 max-lg:grid-cols-1 max-lg:justify-items-center max-lg:gap-1 max-lg:rounded-md max-lg:border-l-0 max-lg:border-b-4 max-lg:px-1 max-lg:py-1.5 max-lg:text-[11px] ' +
                (mobile ? '' : 'max-lg:hidden ') +
                (index === activeIndex
                  ? 'border-[#14bf96] bg-[#e9fbf3] text-[#0e6f4d]'
                  : 'border-transparent text-slate-500 hover:bg-[#f4f8f1]')
              }
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-white text-[11px] text-[#16845f]">{icon}</span>
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </div>

      <div className="flex items-center justify-between border-t border-[#e6e1d4] p-5 text-sm text-slate-500 max-lg:hidden">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#dff5e9] font-semibold text-[#0e6f4d]">
          {student.name.slice(0, 1)}
        </span>
        <span>{student.studentId}</span>
      </div>
    </aside>
  );
}

function displayRank(level: string, progress: number) {
  if (/V|荣耀王者/.test(level)) {
    return '荣耀王者';
  }

  if (/A1|最强王者/.test(level)) {
    return '最强王者';
  }

  if (/A2|星耀/.test(level)) {
    return '星耀';
  }

  if (/B1|钻石|第\s*6\s*档/.test(level)) {
    return '钻石';
  }

  if (/B2|铂金|白金|第\s*5\s*档/.test(level)) {
    return '铂金';
  }

  if (/C1|黄金|第\s*[3-4]\s*档/.test(level)) {
    return '黄金';
  }

  if (/C2|D|白银|第\s*2\s*档/.test(level)) {
    return '白银';
  }

  if (progress >= 95) return '荣耀王者';
  if (progress >= 88) return '最强王者';
  if (progress >= 80) return '星耀';
  if (progress >= 72) return '钻石';
  if (progress >= 64) return '铂金';
  if (progress >= 52) return '黄金';
  if (progress >= 40) return '白银';
  return '青铜';
}

function rankBadgeConfig(rank: string) {
  if (/荣耀王者|最强王者|星耀/.test(rank)) {
    return { accent: '#60a5fa', gem: '#93c5fd', core: '#38bdf8', shape: 'star' as const };
  }

  if (/钻石/.test(rank)) {
    return { accent: '#38bdf8', gem: '#7dd3fc', core: '#0ea5e9', shape: 'diamond' as const };
  }

  if (/铂金/.test(rank)) {
    return { accent: '#67e8f9', gem: '#cffafe', core: '#06b6d4', shape: 'diamond' as const };
  }

  if (/黄金/.test(rank)) {
    return { accent: '#f59e0b', gem: '#fbbf24', core: '#fb923c', shape: 'star' as const };
  }

  if (/白银/.test(rank)) {
    return { accent: '#e5e7eb', gem: '#f8fafc', core: '#cbd5e1', shape: 'star' as const };
  }

  return { accent: '#a3a3a3', gem: '#d4d4d4', core: '#737373', shape: 'star' as const };
}

function RankBadge({ rank, size = 'md' }: { rank: string; size?: 'sm' | 'md' | 'lg' }) {
  const { lang } = useLang();
  const config = rankBadgeConfig(rank);
  const ariaLabel =
    lang === 'en'
      ? `${tLabel(rank, lang)} ${studentCopy.en.rankBadgeLabel}`
      : `${rank}${studentCopy.zh.rankBadgeLabel}`;
  const dimension = size === 'lg' ? 72 : size === 'sm' ? 34 : 48;
  const innerShape =
    config.shape === 'diamond' ? (
      <>
        <polygon points="50 26 72 48 50 78 28 48" fill={config.gem} />
        <polygon points="50 26 62 48 50 78 38 48" fill={config.accent} opacity="0.9" />
        <polygon points="28 48 38 48 50 78" fill="#ffffff" opacity="0.32" />
        <polygon points="62 48 72 48 50 78" fill="#0f172a" opacity="0.12" />
      </>
    ) : (
      <>
        <polygon points="50 24 58 41 77 43 63 56 67 75 50 65 33 75 37 56 23 43 42 41" fill={config.gem} />
        <polygon points="50 24 58 41 50 50 42 41" fill="#ffffff" opacity="0.34" />
        <polygon points="50 50 63 56 67 75 50 65" fill={config.core} opacity="0.88" />
        <polygon points="50 50 37 56 33 75 50 65" fill="#ffffff" opacity="0.2" />
      </>
    );

  return (
    <svg width={dimension} height={dimension} viewBox="0 0 100 100" aria-label={ariaLabel} role="img">
      <polygon
        points="50 6 83 20 96 50 83 80 50 94 17 80 4 50 17 20"
        fill="#30343a"
      />
      <polygon
        points="50 13 78 25 89 50 78 75 50 87 22 75 11 50 22 25"
        fill="#20242a"
        stroke={config.accent}
        strokeWidth="4"
      />
      <polygon
        points="50 18 74 28 84 50 74 72 50 82 26 72 16 50 26 28"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      {innerShape}
    </svg>
  );
}

const CANONICAL_ABILITY = [
  { label: '技术', value: 6 },
  { label: '步法', value: 6 },
  { label: '战术', value: 5 },
  { label: '身体', value: 6 },
  { label: '心理', value: 7 },
  { label: '态度', value: 7 },
];

const MINDMAP_SKILLS = [
  {
    group: '技术',
    level: 6,
    nodes: [
      { label: '发接发', level: 5, leaves: [['发小区', 5], ['发平高', 4], ['搓放', 4], ['推压', 5], ['切抹', 3], ['防偷后场', 4]] },
      { label: '前场', level: 4, leaves: [['搓放', 4], ['勾对角', 3], ['扑杀', 4], ['封网', 5], ['挡网', 4], ['前场第二拍', 4]] },
      { label: '后场', level: 6, leaves: [['正手高远球', 6], ['正手平高球', 5], ['正手劈吊', 4], ['正手滑板', 3], ['正手杀球', 5], ['正手软压', 4], ['正手点杀', 4], ['头顶高远球', 5], ['头顶平高球', 4], ['头顶滑板吊球', 3], ['头顶劈吊', 4], ['头顶杀球', 4], ['反手高远球', 3], ['反手劈吊', 2], ['反手滑板吊', 2], ['反手抽球', 4]] },
      { label: '中场', level: 5, leaves: [['平抽', 5], ['挡网', 4], ['反抽', 4], ['推压', 5], ['拦截', 4], ['腰部带动', 4]] },
    ],
  },
  {
    group: '步法',
    level: 6,
    nodes: [
      { label: '启动', level: 5 },
      { label: '移动', level: 5, leaves: [['交叉步', 5], ['并步', 5], ['垫步', 4], ['蹬跨步', 5], ['跳腾步', 3], ['中国跳', 3], ['马来步', 3], ['李矛步', 2], ['双脚跳', 4]] },
      { label: '衔接', level: 4 },
      { label: '调整', level: 4 },
      { label: '确认', level: 3 },
      { label: '回动', level: 4 },
    ],
  },
  {
    group: '战术',
    level: 5,
    nodes: [
      { label: '空间战术', level: 5 },
      { label: '时间战术', level: 4 },
      { label: '节奏战术', level: 4 },
      { label: '线路战术', level: 4 },
      { label: '对人战术', level: 3 },
      { label: '阵型战术', level: 3 },
    ],
  },
  {
    group: '身体',
    level: 6,
    nodes: [
      { label: '力量', level: 5 },
      { label: '速度', level: 4 },
      { label: '敏捷', level: 4 },
      { label: '耐力', level: 4 },
      { label: '平衡', level: 5 },
      { label: '协调', level: 5 },
    ],
  },
  {
    group: '心理',
    level: 7,
    nodes: [
      { label: '抗压能力', level: 6 },
      { label: '恢复速度', level: 5 },
      { label: '平静沟通', level: 5 },
      { label: '专注保持', level: 5 },
      { label: '决策勇气', level: 4 },
      { label: '复盘诚实', level: 5 },
    ],
  },
  {
    group: '态度',
    level: 7,
    nodes: [
      { label: '反馈具体', level: 6 },
      { label: '愿意试错', level: 6 },
      { label: '训练自觉', level: 5 },
      { label: '认真负责', level: 6 },
      { label: '准时完成', level: 5 },
      { label: '主动沟通', level: 5 },
    ],
  },
];

function normalizeAbilityItems(items: Array<{ label: string; value: number }>) {
  const hasPercentScale = items.some((item) => item.value > 8);
  if (hasPercentScale) return CANONICAL_ABILITY;

  const aliases = new Map(items.map((item) => [item.label === '比赛' ? '态度' : item.label, item.value]));
  return CANONICAL_ABILITY.map((item) => ({
    label: item.label,
    value: Math.min(8, Math.max(1, Math.round(aliases.get(item.label) || item.value))),
  }));
}

function AbilityHex({ items, lang }: { items: Array<{ label: string; value: number }>; lang: Lang }) {
  const normalized = normalizeAbilityItems(items);
  const center = 120;
  const maxRadius = 74;
  const labelRadius = 105;
  const points = normalized.map((item, index) => {
    const angle = (-90 + index * 60) * (Math.PI / 180);
    const radius = maxRadius * (item.value / 8);
    return {
      ...item,
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');
  const labelPoints = normalized.map((item, index) => {
    const angle = (-90 + index * 60) * (Math.PI / 180);
    const x = center + Math.cos(angle) * labelRadius;
    const y = center + Math.sin(angle) * labelRadius;
    const anchor: 'start' | 'end' | 'middle' =
      Math.cos(angle) > 0.35 ? 'start' : Math.cos(angle) < -0.35 ? 'end' : 'middle';
    return { ...item, x, y, anchor };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-center">
      <div className="flex min-h-[300px] items-center justify-center">
        <svg viewBox="0 0 240 240" className="aspect-square w-full max-w-[300px] overflow-visible">
          {[0.25, 0.5, 0.75, 1].map((scale) => {
            const ring = normalized
              .map((_, index) => {
                const angle = (-90 + index * 60) * (Math.PI / 180);
                return `${center + Math.cos(angle) * maxRadius * scale},${center + Math.sin(angle) * maxRadius * scale}`;
              })
              .join(' ');
            return <polygon key={scale} points={ring} fill="none" stroke="#e2e8f0" strokeWidth="0.9" />;
          })}
          {normalized.map((_, index) => {
            const angle = (-90 + index * 60) * (Math.PI / 180);
            return (
              <line
                key={index}
                x1={center}
                y1={center}
                x2={center + Math.cos(angle) * maxRadius}
                y2={center + Math.sin(angle) * maxRadius}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            );
          })}
          <polygon points={polygon} fill="rgba(20,191,150,0.18)" stroke="#16845f" strokeWidth="2.4" />
          {points.map((point) => (
            <circle key={point.label} cx={point.x} cy={point.y} r="4" fill="#16845f" stroke="white" strokeWidth="2" />
          ))}
          {labelPoints.map((point) => (
            <text
              key={point.label}
              x={point.x}
              y={point.y}
              textAnchor={point.anchor}
              dominantBaseline="middle"
              className="fill-slate-700"
            >
              <tspan x={point.x} dy="-6" className="text-[10px] font-semibold">
                {tLabel(point.label, lang)}
              </tspan>
              <tspan x={point.x} dy="14" className="fill-slate-950 text-[12px] font-semibold">
                {point.value} / 8
              </tspan>
            </text>
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {normalized.map((item) => {
          const level = item.value;
          const percent = (level / 8) * 100;
          return (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.45)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-800">{tLabel(item.label, lang)}</span>
                <span className="rounded-full bg-[#e9fbf3] px-2 py-0.5 text-[11px] font-semibold text-[#0e6f4d]">{level}/8</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#b9d2a1] via-[#14bf96] to-[#16845f]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkillTree({ lang }: { lang: Lang }) {
  const [selectedGroup, setSelectedGroup] = useState(MINDMAP_SKILLS[0].group);
  const activeGroup = MINDMAP_SKILLS.find((group) => group.group === selectedGroup) || MINDMAP_SKILLS[0];
  const [selectedNode, setSelectedNode] = useState(activeGroup.nodes[0].label);
  const activeNode = activeGroup.nodes.find((node) => node.label === selectedNode) || activeGroup.nodes[0];

  function selectGroup(group: typeof MINDMAP_SKILLS[number]) {
    setSelectedGroup(group.group);
    setSelectedNode(group.nodes[0].label);
  }

  return (
    <>
      {/* ── Mobile layout (< lg): horizontal group tabs → 2-col node grid → 2-col leaf grid ── */}
      <div className="space-y-4 lg:hidden">
        {/* Group pills — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {MINDMAP_SKILLS.map((group) => (
            <button
              key={group.group}
              type="button"
              onClick={() => selectGroup(group)}
              className={
                'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ' +
                (group.group === activeGroup.group
                  ? 'border-[#14bf96] bg-[#e9fbf3] text-slate-950'
                  : 'border-[#dfe7dc] bg-white text-slate-600')
              }
            >
              {tLabel(group.group, lang)}
              <span className="ml-1.5 text-xs font-normal text-[#16845f]">{group.level}/8</span>
            </button>
          ))}
        </div>

        {/* Node grid — 2 columns */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {activeGroup.nodes.map((node) => (
            <button
              key={node.label}
              type="button"
              onClick={() => setSelectedNode(node.label)}
              className={
                'rounded-xl border px-3 py-2.5 text-left transition ' +
                (node.label === activeNode.label
                  ? 'border-[#14bf96] bg-[#f4f8f1] text-slate-950'
                  : 'border-[#dfe7dc] bg-white text-slate-700')
              }
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold">{tLabel(node.label, lang)}</span>
                <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-[#16845f]">{node.level}/8</span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {node.leaves?.length
                  ? (lang === 'en' ? `${node.leaves.length} details` : `${node.leaves.length} 个细分`)
                  : (lang === 'en' ? 'Detail' : '细分评估')}
              </div>
            </button>
          ))}
        </div>

        {/* Leaf grid — 2 columns */}
        {activeNode.leaves?.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {activeNode.leaves.map(([label, level]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border border-[#cfe8d9] bg-[#f4f8f1] px-3 py-2 text-sm text-slate-700"
              >
                <span className="min-w-0 truncate">{tLabel(String(label), lang)}</span>
                <b className="ml-2 shrink-0 text-[#16845f]">{level}/8</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            {tLabel(activeNode.label, lang)} · {activeNode.level}/8
          </div>
        )}
      </div>

      {/* ── Desktop layout (≥ lg): original 4-column horizontal map ── */}
      <div className="hidden min-h-[620px] gap-4 lg:grid lg:grid-cols-[220px_180px_180px_1fr] lg:items-center">
        <div className="flex items-center justify-center lg:justify-start">
          <div className="rounded-2xl border border-[#cfe8d9] bg-[#dff5e9] px-8 py-6 text-2xl font-semibold text-slate-950 shadow-sm">
            {studentCopy[lang].skillTree}
          </div>
        </div>

        <div className="grid gap-3">
          {MINDMAP_SKILLS.map((group) => (
            <button
              key={group.group}
              type="button"
              onClick={() => selectGroup(group)}
              className={
                'rounded-2xl border px-4 py-3 text-left shadow-sm transition ' +
                (group.group === activeGroup.group
                  ? 'border-[#14bf96] bg-[#e9fbf3] text-slate-950'
                  : 'border-[#dfe7dc] bg-white text-slate-700')
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold">{tLabel(group.group, lang)}</span>
                <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold text-[#16845f]">{group.level}/8</span>
              </div>
              <div className="mt-1 text-xs text-slate-600">{lang === 'en' ? `${group.nodes.length} main items` : `${group.nodes.length} 个主项`}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {activeGroup.nodes.map((node) => (
            <button
              key={node.label}
              type="button"
              onClick={() => setSelectedNode(node.label)}
              className={
                'rounded-2xl border px-4 py-3 text-left shadow-sm transition ' +
                (node.label === activeNode.label
                  ? 'border-[#14bf96] bg-[#f4f8f1] text-slate-950'
                  : 'border-[#dfe7dc] bg-white text-slate-700')
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold">{tLabel(node.label, lang)}</span>
                <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold text-[#16845f]">{node.level}/8</span>
              </div>
              <div className="mt-1 text-xs text-slate-600">{node.leaves?.length ? (lang === 'en' ? `${node.leaves.length} details` : `${node.leaves.length} 个细分`) : (lang === 'en' ? 'Detail check' : '细分评估')}</div>
            </button>
          ))}
        </div>

        <div className="grid content-center gap-2">
          {activeNode.leaves?.length ? (
            activeNode.leaves.map(([label, level]) => (
              <div key={label} className="flex min-h-8 w-max min-w-[136px] max-w-[210px] items-center justify-between gap-3 rounded-xl border border-[#cfe8d9] bg-[#f4f8f1] px-3 py-1.5 text-xs text-slate-700 shadow-sm">
                <span>{tLabel(String(label), lang)}</span>
                <b className="text-[#16845f]">{level}/8</b>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{tLabel(activeNode.label, lang)} · {activeNode.level}/8</div>
          )}
        </div>
      </div>
    </>
  );
}

function AchievementIcon({ category, locked }: { category: string; locked: boolean }) {
  const icon = locked ? 'locked' : category;

  return (
    <svg viewBox="0 0 24 24" className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {icon === '习惯' ? (
        <>
          <path d="M7 8.5A6 6 0 0 1 18 10" />
          <path d="M18 6.5V10h-3.5" />
          <path d="M17 15.5A6 6 0 0 1 6 14" />
          <path d="M6 17.5V14h3.5" />
        </>
      ) : icon === '自律' ? (
        <>
          <path d="M7 12.5 10.5 16 17.5 8" />
          <path d="M12 3.5 19 7v5.5c0 4.2-2.8 6.8-7 8-4.2-1.2-7-3.8-7-8V7l7-3.5Z" />
        </>
      ) : icon === '技术' ? (
        <>
          <path d="M12 3.5 19.5 12 12 20.5 4.5 12 12 3.5Z" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
        </>
      ) : icon === '身体' ? (
        <>
          <path d="M13 3 6.5 13h5L10.8 21 17.5 10h-5L13 3Z" />
        </>
      ) : icon === '心理' ? (
        <>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
          <path d="M9.5 12h5" />
        </>
      ) : icon === '学习' ? (
        <>
          <path d="M5 5.5h9a3 3 0 0 1 3 3v10H8a3 3 0 0 1-3-3v-10Z" />
          <path d="M8 9h6" />
          <path d="M8 12h5" />
        </>
      ) : icon === '态度' ? (
        <>
          <path d="M12 3.5 14.6 8.8l5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
        </>
      ) : icon === '出勤' ? (
        <>
          <path d="M7 4v3" />
          <path d="M17 4v3" />
          <path d="M5 7h14v12H5z" />
          <path d="M8 12h3" />
          <path d="M13 12h3" />
          <path d="M8 15h3" />
        </>
      ) : icon === '比赛' ? (
        <>
          <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
          <path d="M6 5H4v1.5A3.5 3.5 0 0 0 8 10" />
          <path d="M18 5h2v1.5a3.5 3.5 0 0 1-4 3.5" />
          <path d="M12 11v5" />
          <path d="M9 20h6" />
          <path d="M10 16h4v4h-4z" />
        </>
      ) : icon === '练球' ? (
        <>
          <circle cx="8" cy="8" r="3" />
          <path d="M13 13 20 6" />
          <path d="M15 5h5v5" />
          <path d="M6 15h10" />
          <path d="M6 19h7" />
        </>
      ) : (
        <>
          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
          <path d="M7 10h10v9H7z" />
          <path d="M12 14v2" />
        </>
      )}
    </svg>
  );
}

function achievementTone(category: string, status: Achievement['status']) {
  const normalizedCategory = category === '技能' ? '技术' : category;
  const tones: Record<string, { card: string; icon: string; dot: string }> = {
    技术: {
      card: 'border-emerald-100 bg-emerald-50/70',
      icon: 'from-emerald-100 via-lime-100 to-emerald-200 text-emerald-800 ring-emerald-200',
      dot: 'bg-emerald-400',
    },
    步法: {
      card: 'border-sky-100 bg-sky-50/70',
      icon: 'from-sky-100 via-cyan-100 to-blue-200 text-sky-800 ring-sky-200',
      dot: 'bg-sky-400',
    },
    战术: {
      card: 'border-indigo-100 bg-indigo-50/70',
      icon: 'from-indigo-100 via-blue-100 to-violet-200 text-indigo-800 ring-indigo-200',
      dot: 'bg-indigo-400',
    },
    身体: {
      card: 'border-orange-100 bg-orange-50/70',
      icon: 'from-orange-100 via-amber-100 to-yellow-200 text-orange-800 ring-orange-200',
      dot: 'bg-orange-400',
    },
    心理: {
      card: 'border-rose-100 bg-rose-50/70',
      icon: 'from-rose-100 via-pink-100 to-red-100 text-rose-800 ring-rose-200',
      dot: 'bg-rose-400',
    },
    态度: {
      card: 'border-amber-100 bg-amber-50/70',
      icon: 'from-amber-100 via-yellow-100 to-lime-100 text-amber-800 ring-amber-200',
      dot: 'bg-amber-400',
    },
    趣味: {
      card: 'border-fuchsia-100 bg-fuchsia-50/70',
      icon: 'from-fuchsia-100 via-pink-100 to-purple-100 text-fuchsia-800 ring-fuchsia-200',
      dot: 'bg-fuchsia-400',
    },
    安全: {
      card: 'border-slate-200 bg-slate-50/80',
      icon: 'from-slate-100 via-zinc-100 to-stone-200 text-slate-700 ring-slate-200',
      dot: 'bg-slate-400',
    },
  };
  const tone = tones[normalizedCategory] || tones.态度;

  if (status === 'locked') {
    return {
      card: 'border-slate-200 bg-slate-50/75 text-slate-400',
      icon: 'from-slate-100 via-slate-100 to-slate-200 text-slate-400 ring-slate-200',
      dot: 'bg-slate-300',
    };
  }

  if (status === 'in_progress') {
    return {
      ...tone,
      card: `${tone.card} text-slate-700`,
    };
  }

  return {
    ...tone,
    card: `${tone.card} text-slate-950 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.55)]`,
  };
}

function achievementProfileField(category: string) {
  const map: Record<string, string> = {
    技能: '技术',
    技术: '技术',
    步法: '步法',
    战术: '战术',
    身体: '身体',
    心理: '心理',
    态度: '态度',
    双打: '战术',
    安全: '态度',
    习惯: '训练记录',
    自律: '训练记录',
    出勤: '训练记录',
    学习: '训练记录',
    比赛: '比赛复盘',
    练球: '训练记录',
    趣味: '学生档案',
  };
  return map[category] || '学生档案';
}

const FALLBACK_ACHIEVEMENTS: Achievement[] = [
  { id: 'fallback-start', title: '启动', category: '步法', level: 'gold', status: 'earned', description: '启动反应进入训练档案。', progress: 1, target: 1 },
  { id: 'fallback-racket-high', title: '拍头高', category: '技能', level: 'gold', status: 'earned', description: '拍头高度进入技术档案。', progress: 1, target: 1 },
  { id: 'fallback-calm', title: '不怕落后', category: '心理', level: 'gold', status: 'earned', description: '比分落后时继续执行。', progress: 1, target: 1 },
  { id: 'fallback-small', title: '小动作', category: '技能', level: 'silver', status: 'earned', description: '前场动作缩短。', progress: 1, target: 1 },
  { id: 'fallback-detective', title: '三问侦探', category: '战术', level: 'silver', status: 'earned', description: '能问出空间、节奏、对人的问题。', progress: 1, target: 1 },
  { id: 'fallback-deep', title: '深区', category: '技能', level: 'bronze', status: 'in_progress', description: '后场深度继续观察。', progress: 2, target: 4 },
  { id: 'fallback-return', title: '回中', category: '步法', level: 'bronze', status: 'in_progress', description: '击球后回位。', progress: 2, target: 4 },
  { id: 'fallback-net', title: '接发上前', category: '战术', level: 'bronze', status: 'in_progress', description: '接发后的前压意识。', progress: 1, target: 4 },
  { id: 'fallback-core', title: '核心开关', category: '身体', level: 'bronze', status: 'in_progress', description: '核心支撑进入身体档案。', progress: 1, target: 4 },
  { id: 'fallback-water', title: '水壶准时', category: '趣味', level: 'bronze', status: 'earned', description: '好玩但不严肃评价。', progress: 1, target: 1 },
  { id: 'fallback-laces', title: '鞋带检查', category: '安全', level: 'bronze', status: 'earned', description: '训练安全习惯。', progress: 1, target: 1 },
  { id: 'fallback-first-shot', title: '第一拍冷静', category: '心理', level: 'locked', status: 'locked', description: '待解锁。', progress: 0, target: 1 },
  { id: 'fallback-second-shot', title: '第二拍预判', category: '战术', level: 'locked', status: 'locked', description: '待解锁。', progress: 0, target: 1 },
  { id: 'fallback-collect', title: '收藏家', category: '趣味', level: 'locked', status: 'locked', description: '待解锁。', progress: 0, target: 1 },
];

function AchievementMiniBadge({ item, featured, lang }: { item: Achievement; featured?: boolean; lang: Lang }) {
  const profileField = achievementProfileField(item.category);
  const tone = achievementTone(item.category, item.status);
  const levelText = {
    bronze: '铜',
    silver: '银',
    gold: '金',
    locked: '锁',
  };

  return (
    <article
      className={`relative grid min-h-[76px] place-items-center gap-1 overflow-hidden rounded-[18px] border px-2 py-2 text-center text-[11px] leading-tight transition hover:-translate-y-0.5 hover:shadow-sm ${tone.card} ${featured ? 'ring-1 ring-white/80' : ''}`}
      title={`${tDesc(item.description, lang)} · ${tLabel(profileField, lang)}`}
      data-profile-field={profileField}
    >
      {featured ? (
        <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ${tone.dot}`} aria-label={studentCopy[lang].featuredLabel} />
      ) : null}
        <span className={`relative grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br ring-1 ${tone.icon}`}>
        <span className="absolute left-1.5 top-1 h-2 w-3 rounded-full bg-white/70 blur-[1px]" />
        <span className="absolute inset-x-1 bottom-1 h-px bg-black/5" />
        <AchievementIcon category={item.category} locked={item.status === 'locked'} />
      </span>
      <b className="max-w-full truncate text-[11px] font-semibold">{tLabel(item.title, lang)}</b>
      <span className="text-[9px] uppercase tracking-wide text-slate-500/90">
        {tLabel(item.category, lang)} · {lang === 'en' ? item.level : levelText[item.level]}
      </span>
      <span className="rounded-full border border-white/80 bg-white/70 px-1.5 py-0.5 text-[9px] leading-none text-slate-500">
        {tLabel(profileField, lang)}
      </span>
    </article>
  );
}

function AchievementBadges({ achievements, lang }: { achievements: Achievement[]; lang: Lang }) {
  const source = achievements.length ? achievements : FALLBACK_ACHIEVEMENTS;
  const featured = source.filter((item) => item.status === 'earned').slice(0, 5);
  const featuredIds = new Set(featured.map((item) => item.id));
  const collection = source.filter((item) => !featuredIds.has(item.id));

  return (
    <div className="mr-auto grid max-w-[960px] gap-5">
      <section className="rounded-xl border border-slate-200 bg-white/85 p-4">
        <div className="mb-3 flex items-end justify-between gap-4">
          <b className="text-sm text-slate-950">{lang === 'en' ? 'Featured Badges' : '收藏展示'}</b>
          <span className="text-xs text-slate-500">{lang === 'en' ? 'Five compact icons in one row.' : '一排 5 个小图标，右侧保留空白。'}</span>
        </div>
        <div className="grid grid-cols-5 gap-2.5 max-lg:grid-cols-3 max-sm:grid-cols-2">
          {featured.map((item) => (
            <AchievementMiniBadge key={item.id} item={item} featured lang={lang} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/85 p-4">
        <div className="mb-3 flex items-end justify-between gap-4">
          <b className="text-sm text-slate-950">{lang === 'en' ? 'Badge Wall' : '成就墙'}</b>
          <span className="text-xs text-slate-500">{lang === 'en' ? `${collection.length} badges linked to profile fields.` : `${collection.length} 枚，关联学员档案字段。`}</span>
        </div>
        <div className="grid max-h-[360px] grid-cols-5 gap-2.5 overflow-y-auto pr-1 max-lg:grid-cols-3 max-sm:grid-cols-2">
          {collection.map((item) => (
            <AchievementMiniBadge key={item.id} item={item} lang={lang} />
          ))}
        </div>
      </section>
    </div>
  );
}

// Preview-only mock data, activated by ?peerMock=1 on /student. Lets the UI be
// inspected before any real featured submissions exist in the database.
const PEER_FEED_PREVIEW_MOCK: PeerFeedItem[] = [
  {
    id: 'mock-correction-1',
    featuredAt: '2026-05-30T14:23:00Z',
    category: 'correction',
    angle: '她敢承认接发后第二拍总是慢半拍——先注意自己慢，比直接练快更重要。',
    tier: 'C2',
    submissionType: 'match',
    happenedAt: '2026-05-29',
    excerpt: {
      match: '周末双打练习赛',
      score: '21-18 / 17-21',
      whatWorked: '上半局拉吊结合用得不错。',
      nextAdjustment:
        '今天打练习赛发现接发后我总是站着等下一拍。教练之前提醒过我接发完要主动上前压网，但实际打的时候大脑没切换过来。第二局对手吃透了这个习惯，连续靠这点打了我 4 个分。',
      experience: '接发完成的那一拍就要心里默念"上"。',
    },
  },
  {
    id: 'mock-drill-2',
    featuredAt: '2026-05-28T10:00:00Z',
    category: 'drill_seed',
    angle: '这个"重心往下 + 打到地上"是个好 drill 雏形，可以系统化做。',
    tier: 'B1',
    submissionType: 'lesson',
    happenedAt: '2026-05-28',
    excerpt: {
      title: '接杀防守',
      reflection: '今天教练说我接杀总是站太高，让我练习重心往下、把球打到地上的感觉。',
      question: '想多练几种接杀回球的路线。',
    },
  },
  {
    id: 'mock-stuck-3',
    featuredAt: '2026-05-27T10:00:00Z',
    category: 'honest_stuck',
    angle: '"我就是练不会反手"——承认卡点本身已经是进步。',
    tier: 'C2',
    submissionType: 'lesson',
    happenedAt: '2026-05-27',
    excerpt: {
      title: '反手训练',
      reflection: '我就是练不会反手高远球，每次都打不到位，想放弃。',
      question: '反手有没有什么循序渐进的练法？',
    },
  },
];

function PeerExcerptParagraphs({ paragraphs, expanded, charLimit }: { paragraphs: string[]; expanded: boolean; charLimit: number }) {
  // Truncate at character limit but keep paragraph structure. Returns paragraphs
  // joined with double line breaks; truncation adds an ellipsis only when collapsed.
  if (expanded) {
    return (
      <>
        {paragraphs.map((p, i) => (
          <p key={i} className={i > 0 ? 'mt-2' : ''}>
            {p}
          </p>
        ))}
      </>
    );
  }
  let used = 0;
  const trimmed: string[] = [];
  for (const p of paragraphs) {
    if (used >= charLimit) break;
    const remaining = charLimit - used;
    if (p.length <= remaining) {
      trimmed.push(p);
      used += p.length;
    } else {
      trimmed.push(p.slice(0, remaining) + '…');
      used = charLimit;
      break;
    }
  }
  return (
    <>
      {trimmed.map((p, i) => (
        <p key={i} className={i > 0 ? 'mt-2' : ''}>
          {p}
        </p>
      ))}
    </>
  );
}

function PeerWallCard({
  item,
  lang,
  read,
  expanded,
  onToggleExpand,
  onMarkRead,
}: {
  item: PeerFeedItem;
  lang: Lang;
  read: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onMarkRead: () => void;
}) {
  const t = studentCopy[lang];
  const categoryLabel = t.peerWallCategory[item.category] || item.category;
  const tierLabel = t.peerWallAnonStudent(item.tier);
  const typeLabel = item.submissionType === 'match' ? t.peerWallTypeMatch : t.peerWallTypeLesson;
  const happenedLabel = item.happenedAt ? item.happenedAt.slice(0, 10) : item.featuredAt.slice(0, 10);

  // Build excerpt paragraphs in display order based on submission type.
  const paragraphs: string[] = [];
  if (item.submissionType === 'lesson') {
    if (item.excerpt.title) paragraphs.push(`【${item.excerpt.title}】`);
    if (item.excerpt.reflection) paragraphs.push(item.excerpt.reflection);
    if (item.excerpt.question) paragraphs.push(item.excerpt.question);
  } else {
    if (item.excerpt.match) paragraphs.push(`${item.excerpt.match}${item.excerpt.score ? ` · ${item.excerpt.score}` : ''}`);
    if (item.excerpt.whatWorked) paragraphs.push(item.excerpt.whatWorked);
    if (item.excerpt.nextAdjustment) paragraphs.push(item.excerpt.nextAdjustment);
    if (item.excerpt.experience) paragraphs.push(item.excerpt.experience);
  }

  const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const collapseLimit = 180;
  const showToggle = totalChars > collapseLimit;

  return (
    <article className="rounded-lg border border-[#dfe7dc] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#e9fbf3] px-2.5 py-0.5 text-xs font-semibold text-[#0e6f4d]">
          {categoryLabel}
        </span>
        <span className="text-xs text-slate-500">{tierLabel}</span>
        <span className="text-xs text-slate-400">·</span>
        <span className="text-xs text-slate-500">{happenedLabel}</span>
        <span className="text-xs text-slate-400">·</span>
        <span className="text-xs text-slate-500">{typeLabel}</span>
      </div>

      {/* Coach angle gets prominent positioning — this is the quality signal */}
      <div className="mt-3 rounded-md border-l-4 border-[#14bf96] bg-[#f4f8f1] px-3 py-2">
        <div className="text-xs font-semibold text-[#0e6f4d]">{t.peerWallCoachAngle}</div>
        <div className="mt-1 text-sm leading-6 text-slate-800">{item.angle}</div>
      </div>

      {paragraphs.length ? (
        <div className="mt-3 text-sm leading-6 text-slate-700">
          <PeerExcerptParagraphs paragraphs={paragraphs} expanded={expanded} charLimit={collapseLimit} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {showToggle ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-sm font-medium text-[#16845f] hover:text-[#0e5a40]"
          >
            {expanded ? t.peerWallCollapse : t.peerWallExpand}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={read ? undefined : onMarkRead}
          disabled={read}
          className={
            'min-h-9 rounded-md px-3 py-1.5 text-xs font-medium transition ' +
            (read
              ? 'cursor-default border border-[#cfe8d9] bg-[#f4f8f1] text-[#0e6f4d]'
              : 'border border-[#cfe8d9] bg-white text-[#0e6f4d] hover:bg-[#f4f8f1]')
          }
        >
          {read ? t.peerWallMarkedRead : t.peerWallMarkRead}
        </button>
      </div>
    </article>
  );
}

function readPeerWallReadIds(readKey: string) {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(readKey);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function PeerWall({
  items,
  loading,
  lang,
  readKey,
}: {
  items: PeerFeedItem[];
  loading: boolean;
  lang: Lang;
  readKey: string;
}) {
  const t = studentCopy[lang];
  const [readIds, setReadIds] = useState<string[]>(() => readPeerWallReadIds(readKey));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function markRead(id: string) {
    setReadIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      try {
        window.localStorage.setItem(readKey, JSON.stringify(next.slice(-100)));
      } catch {
        // Storage failures are non-fatal.
      }
      return next;
    });
  }

  if (loading && !items.length) {
    return (
      <div className="rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-4 text-sm text-slate-500">
        {lang === 'en' ? 'Loading...' : '读取中...'}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-4 text-sm text-slate-500">
        {t.peerWallEmpty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{t.peerWallDescription}</p>
      {items.map((item) => (
        <PeerWallCard
          key={item.id}
          item={item}
          lang={lang}
          read={readIds.includes(item.id)}
          expanded={expandedId === item.id}
          onToggleExpand={() => setExpandedId((id) => (id === item.id ? null : item.id))}
          onMarkRead={() => markRead(item.id)}
        />
      ))}
    </div>
  );
}

function StudentDashboard({ student, onLogout }: { student: StudentData; onLogout: () => void }) {
  const { lang, toggle } = useLang();
  const t = studentCopy[lang];
  const displayStudent = localizedStudent(student, lang);
  const currentTrainingFocus =
    displayStudent.today?.title ||
    displayStudent.stage?.title ||
    displayStudent.lessonSummary?.title ||
    '';
  const draftKey = `goodminton-student-draft-${displayStudent.studentId}`;
  const logKey = `goodminton-student-submission-log-${displayStudent.studentId}`;
  const rank = displayRank(displayStudent.level, displayStudent.progress);
  const rankLabel = tLabel(rank, lang);
  const contentFrameStyle: React.CSSProperties = {
    width: 'min(1160px, calc(100% - min(228px, max(0px, 100% - 1160px))))',
    marginLeft: 'min(228px, max(0px, 100% - 1160px))',
    marginRight: 'auto',
  };
  const [initialDraft] = useState(() => readStudentDraft(draftKey));
  const [homeworkDateKey] = useState(() => getLocalDateKey());
  const initialCheckedHomework =
    initialDraft?.checkedHomeworkDate === homeworkDateKey ? initialDraft.checkedHomework || [] : null;
  const [reviewedItems, setReviewedItems] = useState<string[]>([]);
  const [checkedHomework, setCheckedHomework] = useState<string[]>(
    () =>
      initialCheckedHomework ||
    displayStudent.lessonSummary?.homework.filter((item) => item.done).map((item) => item.id) ||
      [],
  );
  const [lessonSubmissionStatus, setLessonSubmissionStatus] = useState('');
  const [matchSubmissionStatus, setMatchSubmissionStatus] = useState('');
  const [lessonSubmissionLoading, setLessonSubmissionLoading] = useState(false);
  const [matchSubmissionLoading, setMatchSubmissionLoading] = useState(false);
  const [submissionLogs, setSubmissionLogs] = useState<StudentSubmissionLog[]>(() => readStudentSubmissionLogs(logKey));
  const [cloudLessonRecords, setCloudLessonRecords] = useState<NonNullable<StudentData['lessonHistory']>>([]);
  const [peerFeed, setPeerFeed] = useState<PeerFeedItem[]>([]);
  const [peerFeedLoading, setPeerFeedLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(() =>
    typeof window === 'undefined' ? true : Boolean(window.sessionStorage.getItem(STUDENT_CREDENTIAL_KEY)),
  );
  const [lessonInput, setLessonInput] = useState({
    studentReflection: initialDraft?.lessonInput?.studentReflection ?? displayStudent.lessonSummary?.studentReflection ?? '',
    question: initialDraft?.lessonInput?.question ?? '',
    confidence: initialDraft?.lessonInput?.confidence ?? '3',
  });
  const [matchInput, setMatchInput] = useState({
    match: initialDraft?.matchInput?.match ?? displayStudent.matchReview?.match ?? '',
    score: initialDraft?.matchInput?.score ?? displayStudent.matchReview?.score ?? '',
    whatWorked: initialDraft?.matchInput?.whatWorked ?? displayStudent.matchReview?.whatWorked ?? '',
    nextAdjustment: initialDraft?.matchInput?.nextAdjustment ?? displayStudent.matchReview?.nextAdjustment ?? '',
    experience: initialDraft?.matchInput?.experience ?? displayStudent.matchReview?.experience ?? '',
  });

  function markReviewed(label: string) {
    setReviewedItems((items) => (items.includes(label) ? items : [...items, label]));
  }

  function toggleHomework(id: string) {
    setCheckedHomework((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]));
  }

  function buildSubmissionLog(submissionType: 'lesson' | 'match'): StudentSubmissionLog {
    const submittedAt = new Date().toISOString();
    return {
      id: `${displayStudent.studentId}-${submittedAt}`,
      submissionType,
      studentId: displayStudent.studentId,
      studentName: displayStudent.name,
      submittedAt,
      lessonSummary: {
        date: displayStudent.lessonSummary?.date,
        title: currentTrainingFocus,
        studentReflection: lessonInput.studentReflection.trim(),
        question: lessonInput.question.trim(),
        confidence: Number(lessonInput.confidence),
        completedHomework: checkedHomework,
      },
      matchReview: {
        match: matchInput.match.trim(),
        score: matchInput.score.trim(),
        whatWorked: matchInput.whatWorked.trim(),
        nextAdjustment: matchInput.nextAdjustment.trim(),
        experience: matchInput.experience.trim(),
      },
    };
  }

  useEffect(() => {
    window.localStorage.setItem(
      draftKey,
      JSON.stringify({
        checkedHomework,
        checkedHomeworkDate: homeworkDateKey,
        lessonInput,
        matchInput,
      }),
    );
  }, [checkedHomework, draftKey, homeworkDateKey, lessonInput, matchInput]);

  useEffect(() => {
    const credential = window.sessionStorage.getItem(STUDENT_CREDENTIAL_KEY);
    if (!credential) return;

    const controller = new AbortController();

    async function loadCloudSubmissions() {
      try {
        setHistoryLoading(true);
        const response = await fetch('/api/student-history', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ credential }),
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          lessonRecords?: NonNullable<StudentData['lessonHistory']>;
          submissions?: StudentSubmissionLog[];
        };
        if (!response.ok) return;

        if (Array.isArray(payload.lessonRecords)) {
          setCloudLessonRecords(payload.lessonRecords);
        }

        if (!Array.isArray(payload.submissions) || !payload.submissions.length) return;

        setSubmissionLogs((current) => {
          const merged = mergeSubmissionLogs(payload.submissions || [], current);
          window.localStorage.setItem(logKey, JSON.stringify(merged.slice(0, 20)));
          return merged;
        });
      } catch {
        // Keep local history when the cloud archive is not configured yet.
      } finally {
        setHistoryLoading(false);
      }
    }

    void loadCloudSubmissions();
    return () => controller.abort();
  }, [logKey]);

  // Peer feed (其他学员墙) — public read, no credential needed.
  useEffect(() => {
    const controller = new AbortController();
    async function loadPeerFeed() {
      try {
        setPeerFeedLoading(true);

        // Preview/debug shortcut: ?peerMock=1 (or sessionStorage flag) injects
        // sample items so the UI can be inspected before the SQL migration runs
        // and coach features any real submissions. Safe in production — only
        // renders when the exact opt-in is present.
        if (typeof window !== 'undefined') {
          const fromQuery = new URLSearchParams(window.location.search).get('peerMock') === '1';
          const fromSession = window.sessionStorage.getItem('goodminton-peer-mock') === '1';
          if (fromQuery || fromSession) {
            if (fromQuery) window.sessionStorage.setItem('goodminton-peer-mock', '1');
            setPeerFeed(PEER_FEED_PREVIEW_MOCK);
            return;
          }
        }

        const response = await fetch('/api/peer-feed?limit=10', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => ({}))) as { items?: PeerFeedItem[] };
        if (Array.isArray(payload.items)) {
          setPeerFeed(payload.items);
        }
      } catch {
        // Silent — empty state will render.
      } finally {
        setPeerFeedLoading(false);
      }
    }
    void loadPeerFeed();
    return () => controller.abort();
  }, []);

  async function submitStudentReview(submissionType: 'lesson' | 'match') {
    const isLesson = submissionType === 'lesson';
    if (isLesson ? lessonSubmissionLoading : matchSubmissionLoading) return;

    const submission = buildSubmissionLog(submissionType);
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
    const nextLogs = mergeSubmissionLogs([submission], submissionLogs).slice(0, 20);
    const clearedLessonInput = { studentReflection: '', question: '', confidence: '3' };
    const clearedMatchInput = { match: '', score: '', whatWorked: '', nextAdjustment: '', experience: '' };
    const setActiveStatus = isLesson ? setLessonSubmissionStatus : setMatchSubmissionStatus;
    const setActiveLoading = isLesson ? setLessonSubmissionLoading : setMatchSubmissionLoading;

    if (isLesson && !hasLessonContent) {
      setActiveStatus(t.emptyLesson);
      return;
    }

    if (!isLesson && !hasMatchContent) {
      setActiveStatus(t.emptyMatch);
      return;
    }

    window.localStorage.setItem(`${draftKey}-submitted`, JSON.stringify(submission));
    window.localStorage.setItem(logKey, JSON.stringify(nextLogs));
    setSubmissionLogs(nextLogs);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setActiveLoading(true);
    setActiveStatus(t.sending);

    try {
      const response = await fetch('/api/student-submission', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || t.sendFailedGeneric);
      }

      if (isLesson) {
        setLessonInput(clearedLessonInput);
      } else {
        setMatchInput(clearedMatchInput);
      }
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({
          checkedHomework,
          checkedHomeworkDate: homeworkDateKey,
          lessonInput: isLesson ? clearedLessonInput : lessonInput,
          matchInput: isLesson ? matchInput : clearedMatchInput,
        }),
      );
      setActiveStatus(isLesson ? t.lessonSent : t.matchSent);
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === 'AbortError'
          ? t.sendTimeout
          : error instanceof Error
            ? error.message
            : t.failed;
      setActiveStatus(t.sendFailed(message));
    } finally {
      window.clearTimeout(timeout);
      setActiveLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(90deg,rgba(22,132,95,.045)_1px,transparent_1px),linear-gradient(0deg,rgba(185,210,161,.05)_1px,transparent_1px),#fbfaf6] bg-[length:28px_28px] text-slate-900">
      <div className="grid min-h-screen grid-cols-[228px_minmax(0,1fr)] max-lg:grid-cols-1">
        <StudentSideNav student={displayStudent} lang={lang} />
        <div className="min-w-0">
      <div className="border-b border-[#e6e1d4] bg-[#fbfaf6]/95">
        <div
          className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8"
          style={contentFrameStyle}
        >
          <div className="text-sm font-semibold">Goodminton Academy</div>
          <div className="text-sm text-slate-400 max-sm:hidden">/</div>
          <div className="truncate text-sm text-slate-600 max-sm:hidden">{t.breadcrumb}</div>
          <button onClick={toggle} className="ml-auto min-h-11 rounded-md border border-[#cfe8d9] bg-white px-3 py-1.5 text-sm font-medium text-[#0e6f4d]">
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
          <button onClick={onLogout} className="min-h-11 rounded-md border border-[#cfe8d9] bg-white px-3 py-1.5 text-sm font-medium text-[#0e6f4d]">
            {t.logout}
          </button>
        </div>
      </div>

      <div
        className="px-4 py-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-8"
        style={contentFrameStyle}
      >
        <header id="student-section-0" className="mb-6 scroll-mt-28 rounded-lg border border-[#dfe7dc] bg-[#fffdf8] p-4 shadow-sm sm:p-5 lg:scroll-mt-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="flex gap-3 sm:gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#16845f] text-xl font-semibold text-white shadow-sm sm:h-16 sm:w-16 sm:text-2xl">
                {displayStudent.name.slice(0, 1).toUpperCase()}
                <span className="absolute -bottom-2 -right-2 rounded-full bg-[#fffdf8] p-0.5 shadow-sm">
                  <RankBadge rank={rank} size="sm" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="break-words text-sm text-slate-500">Goodminton / {t.breadcrumb} / {displayStudent.studentId}</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">
                  {t.trainingData(displayStudent.name)}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {t.updated(displayStudent.lastUpdated)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:hidden">
                  <a href="#student-section-1" className="flex min-h-12 items-center justify-center rounded-md bg-[#16845f] px-3 py-2 text-sm font-semibold text-white">
                    {t.lessonSummary}
                  </a>
                  <a href="#student-section-2" className="flex min-h-12 items-center justify-center rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-sm font-semibold text-[#0e6f4d]">
                    {t.nav[2]}
                  </a>
                  <a href="#student-section-3" className="flex min-h-12 items-center justify-center rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-sm font-semibold text-[#0e6f4d]">
                    {t.matchReview}
                  </a>
                  <a href="#student-section-4" className="flex min-h-12 items-center justify-center rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-sm font-semibold text-[#0e6f4d]">
                    {t.homework}
                  </a>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-[#dfe7dc] bg-[#f4f8f1] p-4">
              <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
                <div className="flex flex-col items-center">
                  <div className="text-xs text-slate-500">{t.level}</div>
                  <div className="mt-1">
                    <RankBadge rank={rank} />
                  </div>
                  <div className="mt-1 text-sm font-semibold">{rankLabel}</div>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="text-xs text-slate-500">{t.progress}</div>
                  <div className="mt-1 text-sm font-semibold">{displayStudent.progress}%</div>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="text-xs text-slate-500">{t.mode}</div>
                  <div className="mt-1 text-sm font-semibold">{displayStudent.reviewMode}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {displayStudent.tags.slice(0, 3).map((tag, index) => (
                  <Pill key={tag} active={index === 0}>
                    {tLabel(tag, lang)}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <Section id="student-section-1" title={t.lessonSummary}>
              <div className="space-y-4">
                <label className="block">
                  <div className="text-sm font-medium">{t.lessonReflection}</div>
                  <textarea
                    value={lessonInput.studentReflection}
                    onChange={(event) =>
                      setLessonInput((value) => ({ ...value, studentReflection: event.target.value }))
                    }
                    className="mt-2 min-h-72 w-full resize-y rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-base leading-6 outline-none focus:border-[#16845f] sm:min-h-80 sm:text-sm"
                    placeholder={t.lessonReflectionPlaceholder}
                  />
                </label>
                <label className="block">
                  <div className="text-sm font-medium">{t.learningInterest}</div>
                  <textarea
                    value={lessonInput.question}
                    onChange={(event) => setLessonInput((value) => ({ ...value, question: event.target.value }))}
                    className="mt-2 min-h-16 w-full resize-y rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-base leading-6 outline-none focus:border-[#16845f] sm:min-h-20 sm:text-sm"
                    placeholder={t.learningInterestPlaceholder}
                  />
                </label>
                <label className="block">
                  <div className="text-sm font-medium">{t.confidence}</div>
                  <div className="mt-2 rounded-md border border-[#dfe7dc] bg-[#f7fbf5] px-3 py-2 text-sm leading-6 text-slate-600">
                    <div className="text-xs text-slate-500">{displayStudent.lessonSummary?.date}</div>
                    <div>
                      <span className="font-medium text-slate-900">{lang === 'en' ? 'Training focus: ' : '训练重点：'}</span>
                      {currentTrainingFocus || t.empty}
                    </div>
                    <div className="text-xs text-slate-500">
                      {lang === 'en'
                        ? `Current self-check: ${lessonInput.confidence} / 5`
                        : `当前自评：${lessonInput.confidence} / 5`}
                    </div>
                  </div>
                  <ConfidencePicker lang={lang} value={lessonInput.confidence} onChange={(confidence) => setLessonInput((value) => ({ ...value, confidence }))} />
                </label>
                <div className="rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-4">
                  <div className="text-sm font-medium">{t.coachObservation}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{displayStudent.lessonSummary?.coachNote}</p>
                </div>
                <div className="flex flex-col gap-2 rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t.submitLessonTitle}</div>
                    <div className="mt-1 text-sm text-slate-500">{t.submitLessonDesc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => submitStudentReview('lesson')}
                    disabled={lessonSubmissionLoading}
                    className="min-h-11 rounded-md bg-[#16845f] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300 max-sm:w-full"
                  >
                    {lessonSubmissionLoading ? t.submitting : t.submitSummary}
                  </button>
                </div>
                {lessonSubmissionStatus ? <div className="rounded-md border border-[#bdebd8] bg-[#e9fbf3] px-3 py-2 text-sm font-medium text-[#0e6f4d]">{lessonSubmissionStatus}</div> : null}
              </div>
            </Section>

            <Section id="student-section-2" title={t.nav[2]}>
              <StudentHistoryPanel
                lessons={mergeLessonRecords(cloudLessonRecords, displayStudent.lessonHistory || [])}
                submissionLogs={submissionLogs}
                t={t}
                lang={lang}
                loading={historyLoading}
              />
            </Section>
          </div>

          <Section id="student-section-3" title={t.matchReview}>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <div className="text-sm font-medium">{t.matchOpponent}</div>
                    <input
                      value={matchInput.match}
                      onChange={(event) => setMatchInput((value) => ({ ...value, match: event.target.value }))}
                      className="mt-2 min-h-11 w-full rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-base outline-none focus:border-[#16845f] sm:text-sm"
                      placeholder={t.matchOpponentPlaceholder}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm font-medium">{t.score}</div>
                    <input
                      value={matchInput.score}
                      onChange={(event) => setMatchInput((value) => ({ ...value, score: event.target.value }))}
                      className="mt-2 min-h-11 w-full rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-base outline-none focus:border-[#16845f] sm:text-sm"
                      placeholder={t.scorePlaceholder}
                    />
                  </label>
                </div>
                <label className="block">
                  <div className="text-sm font-medium">{t.whatWorked}</div>
                  <textarea
                    value={matchInput.whatWorked}
                    onChange={(event) => setMatchInput((value) => ({ ...value, whatWorked: event.target.value }))}
                    className="mt-2 min-h-20 w-full resize-y rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-base leading-6 outline-none focus:border-[#16845f] sm:text-sm"
                    placeholder={t.whatWorkedPlaceholder}
                  />
                </label>
                <label className="block">
                  <div className="text-sm font-medium">{t.nextAdjustment}</div>
                  <textarea
                    value={matchInput.nextAdjustment}
                    onChange={(event) => setMatchInput((value) => ({ ...value, nextAdjustment: event.target.value }))}
                    className="mt-2 min-h-20 w-full resize-y rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-base leading-6 outline-none focus:border-[#16845f] sm:text-sm"
                    placeholder={t.nextAdjustmentPlaceholder}
                  />
                </label>
                <label className="block">
                  <div className="text-sm font-medium">{t.experience}</div>
                  <textarea
                    value={matchInput.experience}
                    onChange={(event) => setMatchInput((value) => ({ ...value, experience: event.target.value }))}
                    className="mt-2 min-h-20 w-full resize-y rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-base leading-6 outline-none focus:border-[#16845f] sm:text-sm"
                    placeholder={t.experiencePlaceholder}
                  />
                </label>
                <div className="flex flex-col gap-2 rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t.submitMatchTitle}</div>
                    <div className="mt-1 text-sm text-slate-500">{t.submitMatchDesc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => submitStudentReview('match')}
                    disabled={matchSubmissionLoading}
                    className="min-h-11 rounded-md bg-[#16845f] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300 max-sm:w-full"
                  >
                    {matchSubmissionLoading ? t.submitting : t.submitReview}
                  </button>
                </div>
                {matchSubmissionStatus ? <div className="rounded-md border border-[#bdebd8] bg-[#e9fbf3] px-3 py-2 text-sm font-medium text-[#0e6f4d]">{matchSubmissionStatus}</div> : null}
              </div>
          </Section>

          <Section id="student-section-4" title={t.homework}>
            <div className="grid gap-3 md:grid-cols-3">
              {displayStudent.lessonSummary?.homework.map((item) => {
                const checked = checkedHomework.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-[#dfe7dc] bg-[#f4f8f1] px-3 py-3 text-sm leading-6 text-slate-700"
                  >
                    <input
                      checked={checked}
                      onChange={() => toggleHomework(item.id)}
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 accent-[#16845f]"
                    />
                    <span className={checked ? 'text-slate-400 line-through' : ''}>{item.text}</span>
                  </label>
                );
              })}
            </div>
          </Section>

          <section id="student-section-5" className="scroll-mt-28 rounded-md border border-[#dfe7dc] bg-[#fffdf8] p-4 shadow-sm sm:p-5 lg:scroll-mt-6">
            <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
              <div>
                <div className="text-sm text-slate-500">{t.currentTraining}</div>
                <h2 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">
                  {displayStudent.stage.title}
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">{displayStudent.stage.description}</p>
                <div className="mt-6">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {displayStudent.stage.path.map((item) => (
                      <Pill key={item.label} active={item.active}>
                        {tLabel(item.label, lang)}
                      </Pill>
                    ))}
                  </div>
                  <ProgressBar value={displayStudent.stage.pathProgress} />
                </div>
              </div>

              <div className="rounded-md border border-[#dfe7dc] bg-[#f4f8f1] p-4">
                <div className="text-sm text-slate-500">{t.todayPractice}</div>
                <div className="mt-2 text-xl font-semibold">{displayStudent.today.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{displayStudent.today.description}</p>
                <button
                  onClick={() => markReviewed(displayStudent.today.title)}
                  className="mt-5 w-full rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-sm font-medium text-[#0e6f4d]"
                >
                  {reviewedItems.includes(displayStudent.today.title) ? t.reviewed : t.markReviewed}
                </button>
              </div>
            </div>
          </section>

          {displayStudent.abilityMatrix?.length ? (
            <Section id="student-section-6" title={t.abilityMatrix}>
              <AbilityHex items={displayStudent.abilityMatrix} lang={lang} />
            </Section>
          ) : null}

          <Section id="student-section-7" title={t.achievements}>
            <AchievementBadges achievements={displayStudent.achievements || []} lang={lang} />
          </Section>

          {displayStudent.skillTree?.length ? (
            <Section title={t.skillTree}>
              <SkillTree lang={lang} />
            </Section>
          ) : null}

          <Section title={t.peerWall}>
            <PeerWall
              key={displayStudent.studentId}
              items={peerFeed}
              loading={peerFeedLoading}
              lang={lang}
              readKey={`goodminton-peer-read-${displayStudent.studentId}`}
            />
          </Section>

        </div>
      </div>
        </div>
      </div>
    </main>
  );
}

export default function StudentPage() {
  const { lang, toggle } = useLang();
  const t = studentCopy[lang];
  const savedStudent = useSyncExternalStore(
    subscribeCurrentStudent,
    readCurrentStudent,
    getCurrentStudentServerSnapshot,
  );
  const [activeStudent, setActiveStudent] = useState<StudentData | null>(null);
  const student = activeStudent || savedStudent;
  const [credential, setCredential] = useState('');
  const [loginStatus, setLoginStatus] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const autoLoginStarted = useRef(false);

  const loginStudent = useCallback(async (rawCredential: string | { studentId: string; accessCode: string }) => {
    if (loginLoading) return;

    const credential =
      typeof rawCredential === 'string'
        ? { studentId: rawCredential.trim(), accessCode: '' }
        : rawCredential;
    if (!credential.studentId) {
      setLoginError(t.enterCredential);
      setLoginStatus('');
      return;
    }

    setLoginError('');
    setLoginStatus(t.loadingProfile);
    setLoginLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch('/api/student-data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(credential),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as { student?: StudentData; error?: string };

      if (!response.ok || !payload.student) {
        throw new Error(payload.error || t.failed);
      }

      setActiveStudent(payload.student);
      try {
        window.sessionStorage.setItem(STUDENT_CURRENT_KEY, JSON.stringify(payload.student));
        window.sessionStorage.setItem(
          STUDENT_CREDENTIAL_KEY,
          typeof rawCredential === 'string' ? rawCredential.trim() : `${rawCredential.studentId || ''}${rawCredential.accessCode || ''}`,
        );
        window.dispatchEvent(new Event(STUDENT_SESSION_EVENT));
      } catch {
        // Some mobile/private browsers reject storage writes. The React state above still opens the page.
      }
      setLoginStatus(t.opened);
    } catch (error) {
      setLoginError(
        error instanceof DOMException && error.name === 'AbortError'
          ? t.timeout
          : error instanceof Error
            ? error.message
            : t.failed,
      );
      setLoginStatus('');
    } finally {
      window.clearTimeout(timeout);
      setLoginLoading(false);
    }
  }, [loginLoading, t]);

  async function handleStudentLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginStudent(credential);
  }

  function logoutStudent() {
    setActiveStudent(null);
    try {
      window.sessionStorage.removeItem(STUDENT_CURRENT_KEY);
      window.sessionStorage.removeItem(STUDENT_CREDENTIAL_KEY);
      window.dispatchEvent(new Event(STUDENT_SESSION_EVENT));
    } catch {
      // Ignore storage failures; clearing React state is enough for the current page.
    }
    setCredential('');
    setLoginStatus('');
    setLoginError('');
  }

  useEffect(() => {
    if (autoLoginStarted.current || student || loginLoading || typeof window === 'undefined') {
      return;
    }

    const autoCredential = new URLSearchParams(window.location.search).get('credential');
    if (!autoCredential) {
      return;
    }

    autoLoginStarted.current = true;
    window.history.replaceState(null, '', '/student');
    const autoLoginTimer = window.setTimeout(() => {
      void loginStudent(autoCredential);
    }, 0);

    return () => window.clearTimeout(autoLoginTimer);
  }, [student, loginLoading, loginStudent]);

  if (!student) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf6] px-4 text-slate-900">
        <section className="w-full max-w-md rounded-lg border border-[#dfe7dc] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mx-auto w-fit">
            <GoodmintonMark />
          </div>
          <h1 className="mt-5 text-center text-xl font-semibold">{t.loginTitle}</h1>
          <form onSubmit={handleStudentLogin} className="mt-5 space-y-3">
            <label className="block">
              <span className="sr-only">{t.credential}</span>
              <input
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                enterKeyHint="go"
                inputMode="text"
                spellCheck={false}
                className="mt-2 min-h-11 w-full rounded-md border border-[#cfe8d9] bg-white px-3 py-2 text-base outline-none focus:border-[#16845f]"
                placeholder={t.credentialPlaceholder}
              />
            </label>
            <button
              type="submit"
              disabled={loginLoading || !credential.trim()}
              className="min-h-11 w-full rounded-md bg-[#16845f] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loginLoading ? t.loginLoading : t.enter}
            </button>
          </form>
          {loginStatus ? <p className="mt-3 text-sm text-[#16845f]">{loginStatus}</p> : null}
          {loginError ? <p className="mt-3 text-sm text-red-600">{loginError}</p> : null}
          <div className="mt-5 flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex text-sm font-medium text-[#0e6f4d]">
              {t.backHome}
            </Link>
            <button type="button" onClick={toggle} className="rounded-md border border-[#cfe8d9] bg-white px-3 py-1.5 text-sm font-medium text-[#0e6f4d]">
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return <StudentDashboard student={student} onLogout={logoutStudent} />;
}
