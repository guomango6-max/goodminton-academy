'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ContactFooter from './components/ContactFooter';
import { useLang } from './components/LangContext';

type Lang = 'zh' | 'en';

type ArticlePost = {
  title: string;
  date: string;
  category: string;
  excerpt: string;
  image: string;
  href?: string;
};

type StudentShowcaseItem = {
  id: string;
  title: string;
  achievement: string;
  season: string;
  summary: string;
  image: string;
  featured?: boolean;
};

type CoachProfile = {
  id: string;
  name: string;
  role: string;
  summary: string;
  education: string;
  experience: string;
  specialties: string[];
  contactHref: string;
  image: string;
  trainingImage?: string;
  trainingTitle?: string;
  trainingSummary?: string;
};

const portraitShowcaseIds = new Set(['podium-first-place', 'podium-team-awards']);

const heroFeature: Record<Lang, ArticlePost> = {
  zh: {
    title: '开放式学习：人工智能正在改变什么',
    date: '2026年5月15日',
    category: '精选',
    excerpt: 'Goodminton Academy 把教练观察、学员感受、训练动作和比赛片段合在一个入口里。重点不是把内容写得更多，而是让每个纠错点都能被下一次训练继续使用。',
    image: '/badminton-hero.png',
  },
  en: {
    title: 'Open learning: what artificial intelligence is changing',
    date: 'May 15, 2026',
    category: 'Featured story',
    excerpt: 'AI is not a replacement for the coach. It connects lesson observation, post-training review, and the next practice focus.',
    image: '/article-chat.png',
  },
};

const posts: Record<Lang, ArticlePost[]> = {
  zh: [
    {
      title: '接杀防守怎么练：挡网、抽挡和挑后场的选择',
      date: '2026年5月16日',
      category: '接杀防守',
      excerpt: '接杀不是把球挡回去就结束，而是根据对手站位、来球速度和搭档位置，决定下一拍是挡网、抽挡还是挑后场。',
      image: '/article-megaphone.svg',
    },
    {
      title: '2026夏训怎么安排：从兴趣营到可追踪训练',
      date: '2026年5月15日',
      category: '青少年训练',
      excerpt: '近期多个羽毛球夏令营都强调结构化训练、分龄分级和比赛练习，适合整理成可复盘的暑期训练路径。',
      image: '/article-free.svg',
    },
    {
      title: 'AI能看懂挥拍吗：业余训练反馈的新入口',
      date: '2026年5月14日',
      category: 'AI训练',
      excerpt: '近期可穿戴设备与挥拍评估研究正在把“教练看动作”变成更细颗粒度的数据反馈，适合转化为课后复盘工具。',
      image: '/article-megaphone.svg',
    },
  ],
  en: [
    {
      title: 'Smash defence choices: block, drive, or lift',
      date: 'May 16, 2026',
      category: 'Smash defence',
      excerpt: 'Smash defence is not just getting the shuttle back. Choose block, drive, or lift based on opponent shape, speed, and partner position.',
      image: '/article-megaphone.svg',
    },
    {
      title: '2026 summer training: from camp energy to trackable progress',
      date: 'May 15, 2026',
      category: 'Youth training',
      excerpt: 'Recent badminton summer programs highlight structured coaching, age grouping, skill levels, and match play that can become a reviewable training path.',
      image: '/article-free.svg',
    },
    {
      title: 'Can AI read a badminton stroke? A new feedback layer for amateur players',
      date: 'May 14, 2026',
      category: 'AI coaching',
      excerpt: 'Recent wearable and stroke-evaluation work points toward finer feedback after training, especially for players without constant expert coaching.',
      image: '/article-megaphone.svg',
    },
  ],
};

const studentShowcaseFallback: Record<Lang, StudentShowcaseItem[]> = {
  zh: [
    {
      id: 'university-team-championship',
      title: '大学生锦标赛赛场留念',
      achievement: '第27届中国大学生羽毛球锦标赛',
      season: '2026',
      summary: '团队在全国大学生羽毛球赛场合影，记录从训练、参赛到赛后复盘的完整成长经历。',
      image: '/student-showcase/university-team-championship.jpg',
      featured: true,
    },
    {
      id: 'medals-certificates',
      title: '奖杯、奖牌与成绩证书',
      achievement: '多项赛事荣誉记录',
      season: '2015-2019',
      summary: '把一次次参赛结果沉淀为可追踪的成长档案，让努力被看见，也让下一阶段目标更清晰。',
      image: '/student-showcase/medals-certificates.jpg',
    },
    {
      id: 'junior-medalists',
      title: '青少年学员领奖时刻',
      achievement: '青少年组奖牌记录',
      season: '成长档案',
      summary: '从日常训练到站上领奖台，记录技术、心态和比赛经验一起成长的瞬间。',
      image: '/student-showcase/junior-medalists.jpg',
    },
    {
      id: 'podium-first-place',
      title: '青少年组冠军领奖',
      achievement: '比赛第一名',
      season: '2026',
      summary: '领奖台上的结果来自长期训练中的每一次纠错、坚持和赛后复盘。',
      image: '/student-showcase/podium-first-place.jpg',
    },
    {
      id: 'podium-team-awards',
      title: '青少年组多人获奖',
      achievement: '多人奖牌记录',
      season: '2026',
      summary: '把个人进步和团队氛围一起呈现，让更多学员看到可抵达的成长路径。',
      image: '/student-showcase/podium-team-awards.jpg',
    },
  ],
  en: [
    {
      id: 'university-team-championship',
      title: 'University championship team moment',
      achievement: '27th China University Badminton Championship',
      season: '2026',
      summary: 'A team photo from the national university badminton championship, connecting training, competition, and match review.',
      image: '/student-showcase/university-team-championship.jpg',
      featured: true,
    },
    {
      id: 'medals-certificates',
      title: 'Trophies, medals, and certificates',
      achievement: 'Competition honor archive',
      season: '2015-2019',
      summary: 'Results become part of a trackable growth record, making effort visible and the next goal clearer.',
      image: '/student-showcase/medals-certificates.jpg',
    },
    {
      id: 'junior-medalists',
      title: 'Junior medalists',
      achievement: 'Youth group medal record',
      season: 'Growth archive',
      summary: 'From daily practice to the podium, these moments show technique, confidence, and match experience growing together.',
      image: '/student-showcase/junior-medalists.jpg',
    },
    {
      id: 'podium-first-place',
      title: 'Junior first-place podium',
      achievement: 'First place',
      season: '2026',
      summary: 'Podium results come from repeated correction, steady practice, and thoughtful match review.',
      image: '/student-showcase/podium-first-place.jpg',
    },
    {
      id: 'podium-team-awards',
      title: 'Junior group awards',
      achievement: 'Multiple medal record',
      season: '2026',
      summary: 'Individual progress and team energy together show a growth path that more players can reach.',
      image: '/student-showcase/podium-team-awards.jpg',
    },
  ],
};

const coachFallback: Record<Lang, CoachProfile[]> = {
  zh: [
    {
      id: 'mango',
      name: '芒果教练',
      role: '重庆青羽训练中心创始人',
      summary:
        '毕业于南京体育学院羽毛球训练专业，从事羽毛球教学二十多年，长期专注成人和青少年训练。训练中重视基本技术、移动节奏、比赛理解和课后反馈，让不同阶段的学员都能看到清晰的进步路径。',
      education: '南京体育学院羽毛球训练专业',
      experience: '二十多年羽毛球教学经验',
      specialties: ['成人训练', '青少年训练', '技术诊断', '比赛复盘'],
      contactHref: 'https://wa.me/358413134358',
      image: '/coaches/coach-mango.jpg',
      trainingImage: '/coaches/advanced-coach-training-2017.jpg',
      trainingTitle: '2017年全国高级羽毛球教练集训班',
      trainingSummary: '持续参加高水平教练交流、学习与提升，把专业训练方法转化为适合成人和青少年学员的课堂实践。',
    },
  ],
  en: [
    {
      id: 'mango',
      name: 'Coach Mango',
      role: 'Founder of Chongqing Qingyu Training Center',
      summary:
        'Graduated from Nanjing Sport Institute with a badminton training specialization. With more than 20 years of coaching experience, Coach Mango focuses on adult and youth badminton training, combining technical fundamentals, movement rhythm, match understanding, and post-session feedback.',
      education: 'Badminton training specialization, Nanjing Sport Institute',
      experience: '20+ years of badminton coaching',
      specialties: ['Adult training', 'Youth training', 'Technique diagnosis', 'Match review'],
      contactHref: 'https://wa.me/358413134358',
      image: '/coaches/coach-mango.jpg',
      trainingImage: '/coaches/advanced-coach-training-2017.jpg',
      trainingTitle: '2017 National Advanced Badminton Coach Training',
      trainingSummary: 'Ongoing high-level coach exchange and training, turning professional methods into practical lessons for adult and youth players.',
    },
  ],
};

const copy = {
  zh: {
    brand: 'Goodminton Academy',
    nav: [
      ['新闻', '#articles'],
      ['技术', '#articles'],
      ['学员', '/student'],
      ['教练', '#coach'],
      // 唯一一个跨页项：其余是页内锚点。/forum 在 robots.ts 里 noindex，
      // 但从这里起就是站点导航上人人可点的公开页面了。
      ['论坛', '/forum'],
    ],
    bookTraining: '预约训练',
    heroKicker: '成人与青少年羽毛球训练',
    title: 'Goodminton Academy',
    mission: '让热爱有方向，进步有反馈，成长有路径。',
    proofPoints: ['20+ 年教学经验', '课后总结持续追踪', '比赛复盘回到训练'],
    heroAlt: '羽毛球和战术箭头组成的 Goodminton Academy 训练视觉',
    primaryCta: '联系教练',
    secondaryCta: '进入问答 QA',
    studentTitle: '学员入口',
    studentDesc: '进入自己的训练页面。',
    studentIdLabel: '学员凭证',
    studentIdPlaceholder: '学员ID / demo',
    studentCta: '进入',
    loadingStudent: '正在读取...',
    validatingStudent: '正在验证凭证...',
    openingStudent: '正在进入学员图谱...',
    emptyStudent: '请输入学员凭证。',
    timeoutStudent: '读取超时，请检查网络后重试。',
    articlesKicker: '训练文章',
    articlesTitle: '训练栏目',
    articlesDesc: '用短文章记录技术、战术、反馈和复盘，让每一次训练都能被下一次继续使用。',
    readMore: 'Read more',
    coachKicker: '教练',
    coachName: '芒果教练',
    coachDesc: '用清晰的训练目标、可追踪的反馈和可复盘的成长路径，帮助学员把热爱变成稳定进步。',
    coachPoints: ['技术诊断', '训练计划', '比赛复盘'],
    qaTitle: '体验运动领域最优秀的AI驱动工具。',
    qaDesc: '把训练问题、比赛选择和课堂反馈放进一次清晰对话里。',
    qaCta: '打开问答 QA',
    qaStudent: '学员入口',
    qaFriend: 'AI答疑',
    qaFeedback: '训练反馈',
    featuredAlt: '羽毛球和战术箭头组成的 Goodminton Academy 博客封面',
    featuredTitle: '用 AI 训练档案，把一次课变成长期进步',
    featuredReadMore: '继续阅读',
    showcaseKicker: '学员荣耀',
    showcaseTitle: '从训练场到领奖台',
    showcaseDesc: '公开展示学员和团队的比赛成绩、奖牌记录与成长瞬间。这里不连接私人训练档案，只呈现可公开分享的荣誉内容。',
    showcaseCollapsedDesc: '学员荣誉默认收起，点击后查看公开展示的比赛成绩与成长瞬间。',
    showcaseOpen: '展开学员荣耀',
    showcaseClose: '收起学员荣耀',
    coachSectionKicker: '教练简介',
    coachSectionTitle: '把训练目标讲清楚，把进步路径做扎实',
    coachSectionDesc: 'Goodminton Academy 的训练从真实课堂出发，关注动作细节、比赛判断和长期反馈。',
    coachCollapsedDesc: '教练资料默认收起，点击后查看训练背景、教学重点和联系方式。',
    coachOpen: '展开教练简介',
    coachClose: '收起教练简介',
    coachEducationLabel: '毕业专业',
    coachExperienceLabel: '教学经验',
    coachContact: '联系教练',
  },
  en: {
    brand: 'Goodminton Academy',
    nav: [
      ['News', '#articles'],
      ['Technique', '#articles'],
      ['Students', '/student'],
      ['Coaches', '#coach'],
      ['Forum', '/forum'],
    ],
    bookTraining: 'Book training',
    heroKicker: 'Badminton training for adults and teens',
    title: 'Goodminton Academy',
    mission: 'GOOD intentions. Minimal steps. Consistent tone.',
    proofPoints: ['20+ years coaching', 'Trackable lesson feedback', 'Match review into practice'],
    heroAlt: 'Goodminton Academy training visual with a shuttle and tactical arrows',
    primaryCta: 'Contact coach',
    secondaryCta: 'Open Q&A',
    studentTitle: 'Student portal',
    studentDesc: 'Open your training page.',
    studentIdLabel: 'Student credential',
    studentIdPlaceholder: 'Student ID / demo',
    studentCta: 'Enter',
    loadingStudent: 'Loading...',
    validatingStudent: 'Checking credential...',
    openingStudent: 'Opening student map...',
    emptyStudent: 'Please enter your student credential.',
    timeoutStudent: 'Request timed out. Please check your connection and try again.',
    articlesKicker: 'Training notes',
    articlesTitle: 'Clear methods for better practice',
    articlesDesc: 'Short notes on technique, tactics, feedback, and review so each session carries into the next.',
    readMore: 'Read more',
    coachKicker: 'Coach',
    coachName: 'Coach Mango',
    coachDesc:
      'Clear training goals, trackable feedback, and reviewable growth paths help players turn passion into steady progress.',
    coachPoints: ['Technique diagnosis', 'Training plan', 'Match review'],
    qaTitle: 'Experience the best AI-powered tool for sports training.',
    qaDesc: 'Turn training questions, match choices, and lesson feedback into one focused conversation.',
    qaCta: 'Open Q&A',
    qaStudent: 'Student portal',
    qaFriend: 'AI Q&A',
    qaFeedback: 'Training feedback',
    featuredAlt: 'Goodminton Academy blog cover with a shuttle and tactical arrows',
    featuredTitle: 'Use AI training records to turn one lesson into long-term progress',
    featuredReadMore: 'Continue reading',
    showcaseKicker: 'Student honors',
    showcaseTitle: 'From practice court to podium',
    showcaseDesc: 'A public showcase of student and team achievements, medals, and growth moments. Private training records stay separate.',
    showcaseCollapsedDesc: 'Student honors stay collapsed by default. Open to view public achievements and growth moments.',
    showcaseOpen: 'Open student honors',
    showcaseClose: 'Close student honors',
    coachSectionKicker: 'Coach profile',
    coachSectionTitle: 'Clear goals, steady practice, visible progress',
    coachSectionDesc: 'Goodminton Academy starts from real lessons and focuses on technique, match decisions, and long-term feedback.',
    coachCollapsedDesc: 'Coach details stay collapsed by default. Open to view background, coaching focus, and contact.',
    coachOpen: 'Open coach profile',
    coachClose: 'Close coach profile',
    coachEducationLabel: 'Education',
    coachExperienceLabel: 'Experience',
    coachContact: 'Contact coach',
  },
};

function MangoLogo() {
  return (
    <span
      className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#bdebd8] bg-[linear-gradient(135deg,#e9fbf3,#ffffff)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]"
      aria-hidden="true"
    >
      <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
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
    </span>
  );
}

function MissionText({ lang }: { lang: 'zh' | 'en' }) {
  if (lang === 'zh') {
    return <>让热爱有方向，进步有反馈，成长有路径。</>;
  }

  return (
    <>
      <strong className="font-semibold text-[#0e6f4d]">GOOD</strong> intentions.{' '}
      <strong className="font-semibold text-[#0e6f4d]">MIN</strong>imal steps. Consistent{' '}
      <strong className="font-semibold text-[#0e6f4d]">TON</strong>e.
    </>
  );
}

export default function Home() {
  const { lang, toggle } = useLang();
  const t = copy[lang];
  const featured = heroFeature[lang];
  const [articlePosts, setArticlePosts] = useState<Record<Lang, ArticlePost[]>>(posts);
  const [studentShowcase, setStudentShowcase] = useState<Record<Lang, StudentShowcaseItem[]>>(studentShowcaseFallback);
  const [coaches, setCoaches] = useState<Record<Lang, CoachProfile[]>>(coachFallback);
  const articleList = articlePosts[lang];
  const showcaseList = studentShowcase[lang];
  const coach = coaches[lang][0];
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [studentError, setStudentError] = useState('');
  const [studentStatus, setStudentStatus] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadArticles() {
      try {
        const response = await fetch('/api/articles');
        const payload = (await response.json()) as Partial<Record<Lang, ArticlePost[]>>;

        if (response.ok && payload.zh?.length && payload.en?.length && isMounted) {
          setArticlePosts({ zh: payload.zh.slice(0, 3), en: payload.en.slice(0, 3) });
        }
      } catch {
        // Keep the built-in fallback posts if local article loading fails.
      }
    }

    async function loadStudentShowcase() {
      try {
        const response = await fetch('/api/student-showcase');
        const payload = (await response.json()) as Partial<Record<Lang, StudentShowcaseItem[]>>;

        if (response.ok && payload.zh?.length && payload.en?.length && isMounted) {
          setStudentShowcase({ zh: payload.zh, en: payload.en });
        }
      } catch {
        // Keep the section hidden if public showcase data cannot be loaded.
      }
    }

    async function loadCoaches() {
      try {
        const response = await fetch('/api/coaches');
        const payload = (await response.json()) as Partial<Record<Lang, CoachProfile[]>>;

        if (response.ok && payload.zh?.length && payload.en?.length && isMounted) {
          setCoaches({ zh: payload.zh, en: payload.en });
        }
      } catch {
        // Keep the built-in coach profile if public coach data cannot be loaded.
      }
    }

    void loadArticles();
    void loadStudentShowcase();
    void loadCoaches();

    return () => {
      isMounted = false;
    };
  }, []);

  async function loginStudent(rawCredential: string) {
    if (studentLoading) return;

    const trimmedCredential = rawCredential.trim();
    if (!trimmedCredential) {
      setStudentError(t.emptyStudent);
      setStudentStatus('');
      return;
    }

    setStudentError('');
    setStudentStatus(t.openingStudent);
    setStudentLoading(true);

    try {
      const langParam = lang === 'en' ? '&lang=en' : '';
      router.push(`/student?credential=${encodeURIComponent(trimmedCredential)}${langParam}`);
    } catch (requestError) {
      setStudentError(
        requestError instanceof Error
            ? requestError.message
            : lang === 'zh'
              ? '读取失败。'
              : 'Failed to load student data.',
      );
      setStudentStatus('');
    } finally {
      setStudentLoading(false);
    }
  }

  async function handleStudentLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginStudent(studentId);
  }

  function handleNavClick(href: string) {
    if (href === '#student-showcase') {
      setShowcaseOpen(true);
    }
    if (href === '#coach') {
      setCoachOpen(true);
    }
  }

  return (
    <div className={`min-h-screen overflow-x-hidden bg-[#fbfaf6] text-[#21242c] ${lang === 'zh' ? 'goodminton-zh' : ''}`}>
      <header className="sticky top-0 z-40 border-b border-[#e6e1d4] bg-[#fbfaf6]/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1180px] items-center gap-5 px-5 py-4">
          <Link href="/" className="flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14bf96]">
            <MangoLogo />
            <span className="truncate text-[17px] font-medium tracking-[-0.005em] text-[#121212]">{t.brand}</span>
          </Link>
          <nav className="ml-3 hidden items-center gap-7 text-[14px] font-medium text-[#4f5961] lg:flex" aria-label="Primary navigation">
            {t.nav.map(([label, href]) => (
              <a
                key={label}
                href={href}
                onClick={() => handleNavClick(href)}
                className={
                  href === '/student'
                    ? 'rounded-full bg-[#176a4b] px-3 py-1.5 font-semibold text-white transition-colors hover:bg-[#0e5a40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14bf96]'
                    : href === '/forum'
                    ? 'rounded-full border border-[#b9ddca] bg-[#edf8f2] px-3 py-1.5 font-semibold text-[#0e6f4d] transition-colors hover:border-[#79b99a] hover:bg-[#e3f4eb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14bf96]'
                    : 'transition-colors hover:text-[#121212] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14bf96]'
                }
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/student"
              className="press inline-flex h-10 items-center rounded-[8px] bg-[#176a4b] px-3 text-sm font-semibold text-white lg:hidden"
            >
              {lang === 'zh' ? '学员' : 'Student'}
            </Link>
            <Link
              href="/forum"
              className="press inline-flex h-10 items-center rounded-[8px] border border-[#b9ddca] bg-[#edf8f2] px-3 text-sm font-semibold text-[#0e6f4d] lg:hidden"
            >
              {lang === 'zh' ? '论坛' : 'Forum'}
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-navigation"
              aria-label={lang === 'zh' ? '打开导航' : 'Open navigation'}
              className="press grid h-10 w-10 place-items-center rounded-[8px] border border-[#d8d0bf] bg-white text-[#40525b] lg:hidden"
            >
              <span aria-hidden="true" className="text-xl leading-none">{mobileNavOpen ? '×' : '≡'}</span>
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
              className="press hidden h-10 shrink-0 rounded-[8px] border border-[#d8d0bf] bg-white px-3 text-sm font-semibold text-[#40525b] transition-colors hover:border-[#9fb7a7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14bf96] lg:block"
            >
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
            <a
              href="https://wa.me/358413134358"
              target="_blank"
              rel="noopener noreferrer"
              className="press hidden h-10 items-center rounded-[8px] bg-[#14bf96] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(20,191,150,0.8)] transition-colors hover:bg-[#10a985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14bf96] sm:inline-flex"
            >
              {t.bookTraining}
            </a>
          </div>
        </div>
        {mobileNavOpen ? (
          <nav
            id="mobile-navigation"
            aria-label={lang === 'zh' ? '手机导航' : 'Mobile navigation'}
            className="absolute inset-x-3 top-[calc(100%+8px)] rounded-xl border border-[#dfe7dc] bg-[#fffdf8] p-2 shadow-[0_18px_50px_rgba(31,74,56,0.18)] lg:hidden"
          >
            <div className="grid grid-cols-2 gap-1">
              {t.nav.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => {
                    handleNavClick(href);
                    setMobileNavOpen(false);
                  }}
                  className={`rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                    href === '/forum'
                      ? 'bg-[#e8f7f1] text-[#0e6f4d]'
                      : 'text-[#40525b] hover:bg-[#f3f6ef]'
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>
            <a
              href="https://wa.me/358413134358"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex min-h-11 items-center justify-center rounded-lg bg-[#14bf96] px-4 text-sm font-semibold text-white"
            >
              {t.bookTraining}
            </a>
            <button
              type="button"
              onClick={() => {
                toggle();
                setMobileNavOpen(false);
              }}
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg border border-[#d8d0bf] bg-white px-4 text-sm font-semibold text-[#40525b] lg:hidden"
            >
              {lang === 'zh' ? 'Switch to English' : '切换到中文'}
            </button>
          </nav>
        ) : null}
      </header>

      <main>
        <section id="student-portal" className="mx-auto grid w-full max-w-[1180px] scroll-mt-20 gap-10 px-5 pb-10 pt-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-12 lg:pt-14">
          <div className="min-w-0">
            <h1 className="animate-fade-up max-w-[820px] text-[44px] font-medium leading-[1.05] tracking-[-0.018em] text-[#101820] sm:text-[62px]">
              {t.title}
            </h1>
            <p className="animate-fade-up delay-1 cjk-wrap mt-6 max-w-[720px] text-[18px] leading-8 text-[#52636b]">
              <MissionText lang={lang} />
            </p>
            <div className="animate-fade-up delay-2 mt-7 grid max-w-[760px] gap-3 sm:grid-cols-3">
              {t.proofPoints.map((item) => (
                <div key={item} className="rounded-[8px] border border-[#d8e6da] bg-white/72 px-4 py-3 text-[14px] font-semibold leading-6 text-[#1f4a38] shadow-[0_14px_32px_-28px_rgba(18,18,18,0.35)]">
                  {item}
                </div>
              ))}
            </div>

          </div>

          <aside className="space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-14">
            <form
              onSubmit={handleStudentLogin}
              className="overflow-hidden rounded-xl border border-[#d8e6da] bg-white shadow-[0_20px_48px_-34px_rgba(18,70,49,.45)]"
            >
              <div className="bg-[#176a4b] px-5 py-4 text-white">
                <p className="text-xs font-semibold text-white/65">{lang === 'zh' ? '训练档案' : 'Training profile'}</p>
                <h2 className="mt-1 text-xl font-semibold">{lang === 'zh' ? '学生页面' : 'Student page'}</h2>
                <p className="mt-1 text-sm text-white/75">{t.studentDesc}</p>
              </div>
              <div className="p-5">
                <label className="block text-[13px] font-semibold text-[#40525b]">
                  <span className="sr-only">{t.studentIdLabel}</span>
                  <input
                    value={studentId}
                    onChange={(event) => {
                      setStudentId(event.target.value);
                      setStudentError('');
                      setStudentStatus('');
                    }}
                    className="h-12 w-full rounded-[8px] border border-[#cfe8d9] bg-[#fffdf8] px-3 text-[15px] text-[#101820] outline-none transition-colors placeholder:text-[#8a969b] focus:border-[#14bf96] focus:ring-2 focus:ring-[#14bf96]/20"
                    placeholder={t.studentIdPlaceholder}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>
                <button
                  type="submit"
                  disabled={studentLoading || !studentId.trim()}
                  className="mt-3 h-12 w-full rounded-[8px] bg-[#176a4b] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#0e5a40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14bf96] disabled:cursor-not-allowed disabled:bg-[#d8e8dc] disabled:text-[#768c7d]"
                >
                  {studentLoading ? t.loadingStudent : t.studentCta}
                </button>
                {studentStatus ? <p className="mt-3 text-[14px] text-[#64737a]">{studentStatus}</p> : null}
                {studentError ? <p className="mt-3 text-[14px] text-[#b42318]">{studentError}</p> : null}

                <div className="my-5 flex items-center gap-3 text-xs text-[#8a969b]">
                  <span className="h-px flex-1 bg-[#e6e1d4]" />
                  <span>{lang === 'zh' ? '交流社区' : 'Community'}</span>
                  <span className="h-px flex-1 bg-[#e6e1d4]" />
                </div>
                <Link
                  href="/forum"
                  className="flex min-h-12 items-center justify-between rounded-lg border border-[#b9ddca] bg-[#edf8f2] px-4 text-sm font-semibold text-[#0e6f4d] transition-colors hover:border-[#79b99a] hover:bg-[#e3f4eb]"
                >
                  <span>
                    <span className="block text-base">{lang === 'zh' ? '论坛' : 'Forum'}</span>
                    <span className="mt-0.5 block text-xs font-medium text-[#527364]">{lang === 'zh' ? '交流、复盘和约球' : 'Talk, review, and find games'}</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </form>

            <section className="rounded-[8px] border border-[#dfe7dc] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(18,18,18,0.28)]">
              <MangoLogo />
              <h2 className="mt-5 text-[25px] font-semibold leading-tight tracking-[-0.01em] text-[#101820]">
                {lang === 'zh' ? (
                  <>
                    体验运动领域最优秀的<span className="whitespace-nowrap">AI</span>驱动工具。
                  </>
                ) : (
                  t.qaTitle
                )}
              </h2>
              <div className="mt-6 grid gap-3">
                <Link href="/friend" className="press inline-flex h-11 items-center justify-center rounded-[6px] bg-[#dff4ea] px-4 text-[14px] font-semibold text-[#1f4a38] transition-colors hover:bg-[#cbeedd]">
                  {t.qaFriend}
                </Link>
              </div>
            </section>
          </aside>

          <div className="mt-2 border-t border-[#e0dacb] pt-10 lg:col-start-1 lg:row-start-2 lg:mt-0">
            <article className="animate-fade-up delay-3 grid gap-7 lg:grid-cols-[410px_minmax(0,1fr)] lg:items-center">
              <div className="hover-zoom relative aspect-[16/9] overflow-hidden rounded-[8px] bg-[#b9c6a3]">
                <Image
                  src={featured.image}
                  alt={t.featuredAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 410px, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#16845f]">{featured.category}</p>
                <h2 className="cjk-wrap mt-4 max-w-[520px] text-[32px] font-semibold leading-tight tracking-[-0.015em] text-[#101820]">
                  {t.featuredTitle}
                </h2>
                <p className="mt-3 text-[14px] font-semibold text-[#64737a]">{featured.date}</p>
                <p className="cjk-wrap mt-5 max-w-[520px] text-[16px] leading-8 text-[#52636b]">{featured.excerpt}</p>
                <a
                  href="#articles"
                  className="link-arrow press mt-6 inline-flex h-10 items-center gap-2 rounded-[6px] border border-[#cfe8d9] bg-white px-4 text-[14px] font-semibold text-[#1f4a38] transition-colors hover:border-[#14bf96]"
                >
                  {t.featuredReadMore}
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          </div>
        </section>

        <section id="articles" className="border-y border-[#e6e1d4] bg-white/55 pb-20 pt-8">
          <div className="mx-auto w-full max-w-[1180px] px-5">
            <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#101820]">{t.articlesTitle}</h2>

            <div className="mt-8 grid gap-7 md:grid-cols-3">
              {articleList.map((post) => (
                <article
                  key={post.title}
                  className="editorial-hover border-t border-[#d8d0bf] pt-6"
                >
                  <p className="text-[13px] font-semibold text-[#16845f]">{post.category}</p>
                  <h3 className="cjk-wrap mt-4 text-[24px] font-semibold leading-tight tracking-[-0.01em] text-[#101820]">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-[13px] font-semibold text-[#64737a]">{post.date}</p>
                  <p className="cjk-wrap mt-5 text-[16px] leading-7 text-[#52636b]">{post.excerpt}</p>
                  <a href={post.href || '#student-portal'} className="link-arrow mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#16845f] hover:text-[#0e5a40]">
                    {lang === 'zh' ? '继续阅读' : t.readMore}
                    <span aria-hidden="true">→</span>
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {showcaseList.length ? (
          <section id="student-showcase" className="scroll-mt-20 bg-[#f4f7f1] py-12">
            <div className="mx-auto w-full max-w-[1180px] px-5">
              <div className="flex flex-col gap-5 border-y border-[#d7dfd0] py-7 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[13px] font-semibold text-[#16845f]">{t.showcaseKicker}</p>
                  <h2 className="mt-2 text-[30px] font-semibold leading-tight text-[#101820]">
                    {t.showcaseTitle}
                  </h2>
                  <p className="cjk-wrap mt-3 text-[15px] leading-7 text-[#52636b]">
                    {showcaseOpen ? t.showcaseDesc : t.showcaseCollapsedDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowcaseOpen((value) => !value)}
                  aria-expanded={showcaseOpen}
                  aria-controls="student-showcase-panel"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-[6px] border border-[#b9d8c8] bg-white px-5 text-[14px] font-semibold text-[#1f4a38] transition-colors hover:border-[#14bf96] hover:bg-[#eef8f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14bf96]"
                >
                  {showcaseOpen ? t.showcaseClose : t.showcaseOpen}
                </button>
              </div>

              {showcaseOpen ? (
                <div id="student-showcase-panel" className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
                  {showcaseList
                    .filter((item) => item.featured)
                    .map((item) => (
                      <article key={item.id} className="card-hover-light overflow-hidden rounded-[8px] border border-[#d7dfd0] bg-white">
                        <div className="hover-zoom relative aspect-[16/9] overflow-hidden bg-[#d8e8dc]">
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            sizes="(min-width: 1024px) 560px, 100vw"
                            className="object-cover"
                          />
                        </div>
                        <div className="p-6">
                          <p className="text-[13px] font-semibold text-[#16845f]">{item.achievement}</p>
                          <h3 className="cjk-wrap mt-3 text-[26px] font-semibold leading-tight text-[#101820]">
                            {item.title}
                          </h3>
                          <p className="mt-2 text-[13px] font-semibold text-[#64737a]">{item.season}</p>
                          <p className="cjk-wrap mt-4 text-[15px] leading-7 text-[#52636b]">{item.summary}</p>
                        </div>
                      </article>
                    ))}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {showcaseList
                      .filter((item) => !item.featured)
                      .map((item) => (
                        <article key={item.id} className="card-hover-light overflow-hidden rounded-[8px] border border-[#d7dfd0] bg-white">
                          <div className={`hover-zoom relative overflow-hidden bg-[#d8e8dc] ${portraitShowcaseIds.has(item.id) ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}>
                            <Image
                              src={item.image}
                              alt={item.title}
                              fill
                              sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw"
                              className="object-cover"
                            />
                          </div>
                          <div className="p-4">
                            <p className="text-[12px] font-semibold text-[#16845f]">{item.achievement}</p>
                            <h3 className="cjk-wrap mt-2 text-[18px] font-semibold leading-tight text-[#101820]">
                              {item.title}
                            </h3>
                            <p className="mt-2 text-[12px] font-semibold text-[#64737a]">{item.season}</p>
                            <p className="cjk-wrap mt-3 text-[14px] leading-6 text-[#52636b]">{item.summary}</p>
                          </div>
                        </article>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {coach ? (
          <section id="coach" className="scroll-mt-20 border-y border-[#d7dfd0] bg-white py-12">
            <div className="mx-auto w-full max-w-[1180px] px-5">
              <div className="flex flex-col gap-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[13px] font-semibold text-[#16845f]">{t.coachSectionKicker}</p>
                  <h2 className="mt-2 text-[30px] font-semibold leading-tight text-[#101820]">
                    {t.coachSectionTitle}
                  </h2>
                  <p className="cjk-wrap mt-3 text-[15px] leading-7 text-[#52636b]">
                    {coachOpen ? t.coachSectionDesc : t.coachCollapsedDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCoachOpen((value) => !value)}
                  aria-expanded={coachOpen}
                  aria-controls="coach-panel"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-[6px] border border-[#b9d8c8] bg-[#f4f7f1] px-5 text-[14px] font-semibold text-[#1f4a38] transition-colors hover:border-[#14bf96] hover:bg-[#eef8f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14bf96]"
                >
                  {coachOpen ? t.coachClose : t.coachOpen}
                </button>
              </div>

              {coachOpen ? (
                <div id="coach-panel" className="mt-8 grid gap-8 border-t border-[#d7dfd0] pt-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
                  <div className="hover-zoom relative aspect-[4/5] overflow-hidden rounded-[8px] bg-[#e6e1d4]">
                    <Image
                      src={coach.image}
                      alt={coach.name}
                      fill
                      sizes="(min-width: 1024px) 360px, 100vw"
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[30px] font-semibold leading-tight text-[#101820]">{coach.name}</p>
                    <p className="mt-2 text-[15px] font-semibold text-[#16845f]">{coach.role}</p>
                    <p className="cjk-wrap mt-5 max-w-3xl text-[16px] leading-8 text-[#52636b]">{coach.summary}</p>

                    <div className="mt-7 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[8px] border border-[#d7dfd0] bg-[#f4f7f1] p-5">
                        <p className="text-[13px] font-semibold text-[#64737a]">{t.coachEducationLabel}</p>
                        <p className="cjk-wrap mt-2 text-[16px] font-semibold leading-7 text-[#101820]">{coach.education}</p>
                      </div>
                      <div className="rounded-[8px] border border-[#d7dfd0] bg-[#f4f7f1] p-5">
                        <p className="text-[13px] font-semibold text-[#64737a]">{t.coachExperienceLabel}</p>
                        <p className="cjk-wrap mt-2 text-[16px] font-semibold leading-7 text-[#101820]">{coach.experience}</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {coach.specialties.map((item) => (
                        <span key={item} className="rounded-[6px] border border-[#b9d8c8] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1f4a38]">
                          {item}
                        </span>
                      ))}
                    </div>

                    <a
                      href={coach.contactHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="press mt-7 inline-flex h-11 items-center justify-center rounded-[6px] bg-[#14bf96] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#10a985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14bf96]"
                    >
                      {t.coachContact}
                    </a>
                  </div>

                  {coach.trainingImage ? (
                    <figure className="overflow-hidden rounded-[8px] border border-[#d7dfd0] bg-[#f4f7f1] lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
                      <div className="hover-zoom relative aspect-[3/2] overflow-hidden bg-[#e6e1d4]">
                        <Image
                          src={coach.trainingImage}
                          alt={coach.trainingTitle || coach.name}
                          fill
                          sizes="(min-width: 1024px) 520px, 100vw"
                          className="object-cover"
                        />
                      </div>
                      <figcaption className="p-5 lg:flex lg:flex-col lg:justify-center lg:p-6">
                        {coach.trainingTitle ? (
                          <p className="text-[18px] font-semibold leading-tight text-[#101820]">{coach.trainingTitle}</p>
                        ) : null}
                        {coach.trainingSummary ? (
                          <p className="cjk-wrap mt-3 text-[15px] leading-7 text-[#52636b]">{coach.trainingSummary}</p>
                        ) : null}
                      </figcaption>
                    </figure>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

      </main>

      <ContactFooter lang={lang} />
    </div>
  );
}
