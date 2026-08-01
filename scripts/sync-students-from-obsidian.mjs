import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join } from 'node:path';

const DEFAULT_OBSIDIAN_STUDENT_DIR = 'D:\\ob\\work\\05-students';
const DEFAULT_OBSIDIAN_HOMEWORK_DIR = 'D:\\ob\\work\\03-training\\drill';
const STUDENT_DIR = join(process.cwd(), 'data', 'students');
const LOGIN_FILE = join(process.cwd(), 'data', 'student-login-credentials.json');
const MANIFEST_FILE = join(process.cwd(), 'data', 'student-manifest.json');

const args = new Set(process.argv.slice(2));
const shouldUpload = args.has('--upload');
const shouldDryRun = args.has('--dry-run');
const shouldBackfillHistory = !args.has('--no-backfill');
const obsidianStudentDir = process.env.GOODMINTON_OBSIDIAN_STUDENT_DIR || DEFAULT_OBSIDIAN_STUDENT_DIR;
const obsidianHomeworkDir = process.env.GOODMINTON_OBSIDIAN_HOMEWORK_DIR || DEFAULT_OBSIDIAN_HOMEWORK_DIR;

const loginOverrides = {
  abih: 'abih30',
  'abih-wife': 'abiw30',
  rishi: 'rishi40',
  sami: 'sami09',
  'guo-yiwei': 'gyw11',
  'li-chenrun': 'lcr22',
  'sheng-xinyi': 'sxy33',
  'xue-meijiao': 'xmj44',
  'yang-jingnan': 'yjn48',
  'guo-renhua': 'grh46',
  'cui-yunhao': 'cyh33',
  'wang-meng': 'wm45',
  'wang-han': 'wh07',
  'zhang-biqiong': 'zbq48',
  'zhang-cuiqi': 'zcq40',
  'zhao-chen': 'zc09',
  'zhao-xin': 'zx40',
  'zi-xuan': 'zx28',
  'jin-yan': 'jy47',
  'lu-shiqiong': 'lsq40',
  xiaokonglong: 'xkl13',
  // 2026-07-31 新增。aami/amyra 均 8 岁且 studentId 为单词，
  // fallbackLoginId 只取首字母会让两人都得到 a08（凭证冲突），必须 override。
  aami: 'aami08',
  amyra: 'amyra08',
  doudou: 'dd11',
  // 对齐库内既有记录（fallback 会生成 y09，与 vault/凭证表的 yy09 不一致）
  yaoyao: 'yy09',
  mengmeng: 'mm13',
};

const legacyCredentials = {
  gyw1: 'guo-yiwei',
  gyw1122: 'guo-yiwei',
  guoyiwei11: 'guo-yiwei',
  guoyiwei1122: 'guo-yiwei',
  '郭一苇11': 'guo-yiwei',
  '郭一苇1122': 'guo-yiwei',
  lcr2: 'li-chenrun',
  lcr2233: 'li-chenrun',
  lichenrun22: 'li-chenrun',
  lichenrun2233: 'li-chenrun',
  '李晨润22': 'li-chenrun',
  '李晨润2233': 'li-chenrun',
  sxy3: 'sheng-xinyi',
  sxy3344: 'sheng-xinyi',
  shengxinyi33: 'sheng-xinyi',
  shengxinyi3344: 'sheng-xinyi',
  '盛心怡33': 'sheng-xinyi',
  '盛心怡3344': 'sheng-xinyi',
  '盛欣怡33': 'sheng-xinyi',
  '盛欣怡3344': 'sheng-xinyi',
  xmj4: 'xue-meijiao',
  xmj4455: 'xue-meijiao',
  xuemeijiao44: 'xue-meijiao',
  xuemeijiao4455: 'xue-meijiao',
  '薛美姣44': 'xue-meijiao',
  '薛美姣4455': 'xue-meijiao',
  yjn8: 'yang-jingnan',
  yjn4837: 'yang-jingnan',
  yangjingnan48: 'yang-jingnan',
  yangjingnan4837: 'yang-jingnan',
  '杨静南48': 'yang-jingnan',
  '杨静南4837': 'yang-jingnan',
  zixuan28: 'zi-xuan',
  '紫萱28': 'zi-xuan',
};

function normalizeLoginCredential(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return {};
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return {};
  const block = raw.slice(3, end).trim();
  const data = {};

  for (const line of block.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (!match) continue;
    data[match[1]] = match[2].trim().replace(/^["']|["']$/gu, '');
  }

  return data;
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/gu, '$2')
    .replace(/\[\[([^\]]+)\]\]/gu, '$1')
    .replace(/\*\*/gu, '')
    .replace(/<[^>]+>/gu, '')
    .trim();
}

function getHeadingName(raw) {
  return raw.match(/^#\s+学员档案｜(.+)$/mu)?.[1]?.trim() || '';
}

function getTableValue(raw, labels) {
  const labelSet = new Set(labels);
  for (const line of raw.split(/\r?\n/u)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => stripMarkdown(cell));
    if (cells.length < 2) continue;
    if (labelSet.has(cells[0])) return cells[1];
  }
  return '';
}

function getSection(raw, title) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = raw.match(new RegExp(`^##\\s+${escapedTitle}\\s*\\r?\\n([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'mu'));
  return match?.[1]?.trim() || '';
}

function getFocusItems(raw) {
  const section = getSection(raw, '当前训练重点');
  if (!section) return [];

  const tableItems = [];
  for (const line of section.split(/\r?\n/u)) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => stripMarkdown(cell));
    if (cells.length >= 2 && cells[0] && !cells[0].includes('---') && !cells[0].includes('focus_id')) {
      tableItems.push(cells[1] || cells[0]);
    }
  }
  if (tableItems.length) return tableItems.slice(0, 2);

  return section
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*[-*]\s+(.+)$/u)?.[1])
    .filter(Boolean)
    .map(stripMarkdown)
    .slice(0, 2);
}

function parseTableRows(section) {
  const rows = [];
  let headers = [];

  for (const line of section.split(/\r?\n/u)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (!cells.length || cells.every((cell) => /^:?-{3,}:?$/u.test(cell))) continue;

    const stripped = cells.map(stripMarkdown);
    if (!headers.length) {
      headers = stripped;
      continue;
    }

    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

function getRecentGoal(raw) {
  return stripMarkdown(
    getTableValue(raw, ['短期目标_4周', '短期目标', '近期目标']) ||
      getTableValue(raw, ['中期目标_3月', '中期目标']) ||
      '',
  );
}

function getGrowthPathSummary(raw) {
  const section = getSection(raw, '当前路径定位');
  if (!section) return '';

  const rows = parseTableRows(section);
  const active = rows
    .filter((row) => /active|主线|重点/u.test(stripMarkdown(row['角色'] || row.role || '')))
    .map((row) => stripMarkdown(row.path || row['path'] || row['路径'] || ''))
    .filter(Boolean);

  if (active.length) return active.slice(0, 2).join(' / ');

  return rows
    .map((row) => stripMarkdown(row.path || row['path'] || row['路径'] || ''))
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ');
}

function extractWikiTarget(value) {
  return String(value || '').match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/u)?.[1] || '';
}

async function getHomeworkTitleMap() {
  const titleMap = new Map();
  if (!existsSync(obsidianHomeworkDir)) return titleMap;

  const files = await readdir(obsidianHomeworkDir);
  for (const fileName of files.filter((file) => file.startsWith('homework-') && file.endsWith('.md'))) {
    const raw = await readFile(join(obsidianHomeworkDir, fileName), 'utf8');
    const frontmatter = parseFrontmatter(raw);
    const id = basename(fileName, '.md');
    const title = stripMarkdown(frontmatter.title || raw.match(/^#\s+家庭作业｜(.+)$/mu)?.[1] || raw.match(/^#\s+(.+)$/mu)?.[1] || id);
    titleMap.set(id, title);
  }

  return titleMap;
}

function getAssignedHomework(raw, { recentGoal, growthPath, focusItems, homeworkTitleMap }) {
  const section = getSection(raw, '当前家庭作业');
  if (!section) return [];

  const rows = parseTableRows(section);
  const homework = [];

  for (const row of rows) {
    const homeworkCell = row.homework || row['家庭作业'] || '';
    const homeworkId = extractWikiTarget(homeworkCell);
    const title = homeworkId ? homeworkTitleMap.get(homeworkId) || stripMarkdown(homeworkCell) : stripMarkdown(homeworkCell);
    const relatedPath = stripMarkdown(row['相关 path'] || row.path || '');
    const relatedFocus = stripMarkdown(row['相关 error / focus'] || row.focus || '');
    const reason = stripMarkdown(row['匹配原因'] || '');
    const frequency = stripMarkdown(row['频率'] || '');
    const metric = stripMarkdown(row['观察指标'] || '').replace(/^下次课看/u, '').trim();

    if (!title || title === '[[]]' || /不预设|不额外增加/u.test(reason)) continue;

    const target = recentGoal || focusItems[0] || relatedFocus;
    const path = growthPath || relatedPath;
    const parts = [
      title,
      target ? `近期目标：${target}` : '',
      path ? `成长路径：${path}` : '',
      frequency ? `频率：${frequency}` : '',
      metric ? `下次课看：${metric}` : '',
    ].filter(Boolean);

    homework.push({
      id: homeworkId || `homework-${homework.length + 1}`,
      text: parts.join('｜'),
      done: false,
    });
  }

  return homework.slice(0, 3);
}

function getTrainingRecordCount(raw) {
  const section = getSection(raw, '训练记录');
  if (!section) return 0;
  return section
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*\d{4}-\d{2}-\d{2}|\|\s*近期/u.test(line))
    .length;
}

function getLessonHistory(raw, studentId) {
  const section = getSection(raw, '训练记录');
  if (!section) return [];

  const rows = parseTableRows(section);
  const lessons = [];

  for (const row of rows) {
    const dateRaw = stripMarkdown(row['日期'] || '').trim();
    if (!dateRaw || dateRaw === '日期') continue;

    const dateMatch = dateRaw.match(/(\d{4}-\d{2}-\d{2})/u);
    const date = dateMatch ? dateMatch[1] : null;
    if (!date) continue;

    const focusRaw = stripMarkdown(row['本课重点'] || row['记录'] || '');
    if (!focusRaw || /^\s*$/.test(focusRaw)) continue;

    const cleanFocus = focusRaw.replace(/^小班[：:]\s*/u, '');
    const mainContent = cleanFocus
      .split(/[·、，,；;]+/u)
      .map((s) => s.trim())
      .filter(Boolean);

    const coachNote = stripMarkdown(row['下次跟进'] || row['下一步'] || '');
    const studentNote = stripMarkdown(row['表现'] || '');
    const lessonRef = stripMarkdown(row['备课链接'] || '');
    const id = lessonRef
      ? `lesson-${date}-${lessonRef.replace(/[^a-z0-9-]/giu, '-').toLowerCase().slice(0, 30)}`
      : `lesson-${date}-${studentId}`;

    lessons.push({
      id,
      date,
      title: mainContent.slice(0, 3).join(' · '),
      mainContent,
      coachNote,
      studentNote,
      homeworkDone: 0,
      homeworkTotal: 0,
    });
  }

  return lessons.sort((a, b) => b.date.localeCompare(a.date));
}

function initialsFromStudentId(studentId) {
  return studentId
    .split('-')
    .map((part) => part[0])
    .join('')
    .replace(/[^a-z0-9]/gu, '');
}

function fallbackLoginId(studentId, age) {
  const prefix = initialsFromStudentId(studentId) || studentId.slice(0, 3);
  const code = age ? String(age).padStart(2, '0').slice(-2) : String(hashString(studentId) % 90 + 10);
  return `${prefix}${code}`;
}

function hashString(value) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function levelToProgress(level) {
  if (/A2|A1/u.test(level)) return 78;
  if (/B1/u.test(level)) return 55;
  if (/B2/u.test(level)) return 45;
  if (/C1/u.test(level)) return 34;
  if (/C2/u.test(level)) return 28;
  return 30;
}

function levelToAbility(level) {
  if (/A2|A1/u.test(level)) return 7;
  if (/B1/u.test(level)) return 5;
  if (/C1/u.test(level)) return 4;
  return 3;
}

const englishLabels = {
  成人: 'Adult',
  青少年: 'Youth',
  建档: 'Profile Setup',
  Obsidian: 'Obsidian',
  初评: 'Initial Check',
  技术基线: 'Technique Baseline',
  步法基线: 'Footwork Baseline',
  实战转化: 'Match Transfer',
  训练记录: 'Training Records',
  当前重点: 'Current Focus',
  家庭作业: 'Homework',
  登录ID: 'Login ID',
  '登录 ID': 'Login ID',
  已同步: 'Synced',
  待回访: 'To Review',
  固定: 'Fixed',
  本阶段重点: 'Current Stage Focus',
  待验证: 'To Verify',
  待同步: 'To Sync',
  强: 'Strong',
  中: 'Medium',
  新: 'New',
  身体: 'Physical',
  心理: 'Mental',
  态度: 'Attitude',
  技术: 'Technique',
  战术: 'Tactics',
  步法: 'Footwork',
  首次建档: 'Initial Profile Setup',
  基础能力初评: 'Basic Ability Check',
  训练反馈建档: 'Training Feedback Profile',
  基础能力建档: 'Basic Ability Profile',
  基础能力观察: 'Basic Ability Check',
  训练重点建档: 'Training Focus Setup',
  反馈系统接入: 'Feedback System Connected',
  基础动作观察: 'Basic Movement Check',
  动作稳定性: 'Movement Stability',
  稳定性与比赛转化: 'Stability and Match Transfer',
  稳定训练节奏: 'Stable Training Rhythm',
  儿童基础动作与协调性建档: 'Junior Movement and Coordination Profile',
  课堂稳定性与训练节奏: 'Classroom Consistency and Training Rhythm',
  姓名与基础信息待确认: 'Name and Basic Information to Confirm',
  经验打法与系统动作分离: 'Separate Playing Experience from Systematic Technique',
  发球系统: 'Serving System',
  低平球: 'Flat Low Serve',
  偷后场变化: 'Backcourt Surprise Variation',
  接偷后场: 'Receive Backcourt Surprise Serve',
  预判启动: 'Anticipate and Start',
  不要等: 'Do Not Wait',
  稳定性: 'Stability',
  比赛转化: 'Match Transfer',
  儿童基础能力初评: 'Junior Basic Ability Check',
  细分能力初评: 'Detailed Ability Check',
};

function translateZhToEn(value) {
  const text = String(value || '');
  if (!text) return text;
  if (englishLabels[text]) return englishLabels[text];

  const sentenceReplacements = {
    '当前重点：': 'Current focus: ',
    '网站档案已建立，等待更多训练日志校准。': 'The website profile is ready and will be calibrated with more training logs.',
    '下次课优先补充可量化观察。': 'Next lesson should add measurable observations first.',
    '先从 Obsidian 档案同步到网站，后续按课堂记录继续校准。': 'Synced from the Obsidian profile to the website first; future lesson records will keep calibrating it.',
    '先建立能力矩阵和课堂反馈闭环，后续按真实训练记录校准。': 'Build the ability matrix and class feedback loop first, then calibrate it with real training records.',
    '先建立能力矩阵、技能树和课堂反馈闭环，后续根据真实训练记录校准。': 'Build the ability matrix, skill tree, and class feedback loop first, then calibrate them with real training records.',
    '先建立能力矩阵和课堂反馈闭环；姓名字形和训练频率下次继续确认。': 'Build the ability matrix and class feedback loop first; confirm name spelling and training frequency next time.',
    '下次课继续补充量化记录和训练反馈。': 'Next lesson will add measurable records and training feedback.',
    '课后总结和比赛复盘可从网站提交，再回写到 Obsidian。': 'Lesson summaries and match reviews can be submitted from the website, then written back to Obsidian.',
    '课后总结和比赛复盘可先通过网站提交，再回写到 Obsidian。': 'Lesson summaries and match reviews can be submitted through the website first, then written back to Obsidian.',
    '从 Obsidian 学员档案生成网站基础页，后续按课堂记录持续校准。': 'Generated the website profile from the Obsidian student profile; future lesson records will keep it calibrated.',
    '记录本周最想改进的一个动作。': 'Write down the one movement you most want to improve this week.',
    '下次课前回忆一个最近最容易失误的场景。': 'Before the next lesson, remember one recent situation where mistakes happen most often.',
    '课后用自己的话写一句训练感受。': 'After class, write one training feeling in your own words.',
    '先完成基础能力初评，再确定比赛复盘主线。': 'Complete the basic ability check first, then choose the main match-review focus.',
    '先建立网站学员页，后续根据课堂表现校准能力矩阵和技能档位。': 'Create the website student page first, then calibrate the ability matrix and skill level from lesson performance.',
    '等待学生课后反馈。': 'Waiting for student post-lesson feedback.',
  };

  return Object.entries({ ...sentenceReplacements, ...englishLabels })
    .sort(([a], [b]) => b.length - a.length)
    .reduce((output, [source, target]) => output.replaceAll(source, target), text)
    .replaceAll('；', '; ')
    .replaceAll('：', ': ')
    .replaceAll('，', ', ')
    .replaceAll('。', '. ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function translateObject(value) {
  if (typeof value === 'string') return translateZhToEn(value);
  if (Array.isArray(value)) return value.map(translateObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateObject(item)]));
}

function makeEnglishStudent(student) {
  return translateObject(student);
}

const HOMEWORK_CATEGORIES = ['swing', 'footwork', 'fitness'];

function makeDefaultHomework({ recentGoal = '', growthPath = '', focusItems = [] } = {}) {
  const target = recentGoal || focusItems[0] || '当前训练重点';
  const path = growthPath ? `｜成长路径：${growthPath}` : '';
  return {
    swing: {
      id: 'hw-swing',
      text: `挥拍：空拍慢挥 10 次，关注拍面和发力顺序｜近期目标：${target}${path}`,
      done: false,
    },
    footwork: {
      id: 'hw-footwork',
      text: `步法：无球启动/回位 6 组，重点看第一步和还原｜近期目标：${target}${path}`,
      done: false,
    },
    fitness: {
      id: 'hw-fitness',
      text: `体能：核心或下肢稳定 3 组，动作质量优先｜近期目标：${target}${path}`,
      done: false,
    },
  };
}

function getHomeworkCategory(item) {
  const text = `${item?.id || ''} ${item?.text || ''}`.toLowerCase();
  if (/homework-fitness|^hw-fitness/u.test(text)) return 'fitness';
  if (/homework-footwork|^hw-footwork/u.test(text)) return 'footwork';
  if (/homework-swing|^hw-swing/u.test(text)) return 'swing';
  if (/footwork|步法|启动|蹬|跳|还原|回位|移动|交叉步|垫步|并步|弓步|落地/u.test(text)) return 'footwork';
  if (/swing|挥拍|高远|杀球|吊球|发力|拍面|网前|推球|接杀|抽球|搓球|勾球|放网/u.test(text)) return 'swing';
  if (/fitness|plank|core|wall|sit|balance|体能|核心|力量|稳定|靠墙|深蹲|平衡/u.test(text)) return 'fitness';
  return '';
}

function completeHomework(homework, context) {
  const items = Array.isArray(homework) ? homework.filter((item) => item?.id && item?.text) : [];
  const defaults = makeDefaultHomework(context);
  const byCategory = new Map();
  const uncategorized = [];

  for (const item of items) {
    const category = getHomeworkCategory(item);
    if (category && !byCategory.has(category)) {
      byCategory.set(category, item);
    } else if (!category) {
      uncategorized.push(item);
    }
  }

  for (const category of HOMEWORK_CATEGORIES) {
    if (!byCategory.has(category) && uncategorized.length) {
      byCategory.set(category, uncategorized.shift());
    }
  }

  return HOMEWORK_CATEGORIES.map((category) => byCategory.get(category) || defaults[category]);
}

function makeBaseStudent({ studentId, name, group, level, loginId, sourceFile, focusItems, homework = [], raw }) {
  const focus = focusItems.length ? focusItems : ['基础能力初评', '训练反馈建档'];
  const progress = levelToProgress(level);
  const ability = levelToAbility(level);
  const parsedHistory = getLessonHistory(raw, studentId);
  const recordCount = parsedHistory.length || getTrainingRecordCount(raw);
  const description = `当前重点：${focus.join('；')}。先从 Obsidian 档案同步到网站，后续按课堂记录继续校准。`;
  const assignedHomework = completeHomework(homework, {
    recentGoal: getRecentGoal(raw),
    growthPath: getGrowthPathSummary(raw),
    focusItems,
  });

  const student = {
    studentId,
    accessCode: loginId.match(/\d+$/u)?.[0] || '',
    name,
    level,
    reviewMode: '开启',
    progress,
    stage: {
      title: focus[0],
      description,
      path: [
        { label: '初评', active: true },
        { label: '技术基线', active: true },
        { label: '步法基线', active: false },
        { label: '实战转化', active: false },
      ],
      pathProgress: Math.max(20, Math.min(65, progress)),
    },
    today: {
      title: focus[0],
      description,
    },
    activity: [
      { label: '训练记录', value: String(recordCount), note: 'Obsidian' },
      { label: '当前重点', value: String(focus.length), note: '已同步' },
      { label: '家庭作业', value: '0/3', note: '待回访' },
      { label: '登录 ID', value: loginId, note: '固定' },
    ],
    tags: [group, level, 'Obsidian', '建档'].filter(Boolean),
    reviewQueue: [
      { title: focus[0], source: sourceFile, status: '本阶段重点', detail: description },
      { title: focus[1] || '基础信息补全', source: sourceFile, status: '待验证', detail: '下次课继续补充量化记录和训练反馈。' },
      { title: '训练日志回流', source: 'student-page', status: '待同步', detail: '课后总结和比赛复盘可从网站提交，再回写到 Obsidian。' },
    ],
    knowledgeLinks: [
      { from: 'Obsidian 学员档案', to: '网站学员页', weight: '强' },
      { from: '课后总结', to: '当前训练重点', weight: '中' },
      { from: '比赛复盘', to: '下一次训练验证', weight: '新' },
    ],
    recentFeedback: [
      `当前重点：${focus.join('；')}`,
      '网站档案已建立，等待更多训练日志校准。',
      '下次课优先补充可量化观察。',
    ],
    lessonSummary: {
      date: new Date().toISOString().slice(0, 10),
      title: '首次建档',
      studentReflection: '',
      coachNote: '从 Obsidian 学员档案生成网站基础页，后续按课堂记录持续校准。',
      homework: assignedHomework,
    },
    matchReview: {
      match: '',
      score: '',
      whatWorked: '',
      nextAdjustment: '先完成基础能力初评，再确定比赛复盘主线。',
      experience: '',
    },
    abilityMatrix: [
      { label: '身体', value: group === '青少年' ? Math.max(3, ability - 1) : ability },
      { label: '心理', value: ability },
      { label: '态度', value: ability },
      { label: '技术', value: ability },
      { label: '战术', value: Math.max(3, ability - 1) },
      { label: '步法', value: ability },
    ],
    lessonHistory: parsedHistory.length
      ? parsedHistory
      : [
          {
            id: 'lesson-profile-sync',
            date: new Date().toISOString().slice(0, 10),
            title: '首次建档',
            mainContent: ['基础能力观察', '训练重点建档', '反馈系统接入'],
            coachNote: '先建立网站学员页，后续根据课堂表现校准能力矩阵和技能档位。',
            studentNote: '等待学生课后反馈。',
            homeworkDone: 0,
            homeworkTotal: 3,
          },
        ],
    growthPath: [],
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
  student.i18n = { en: makeEnglishStudent(student) };
  return student;
}

function mergeExistingStudent(existing, generated, { name, level, loginId }) {
  const lessonSummary = {
    ...(generated.lessonSummary || {}),
    ...(existing.lessonSummary || {}),
    homework: generated.lessonSummary?.homework || existing.lessonSummary?.homework || [],
  };
  const mergedForEnglish = {
    ...generated,
    ...existing,
    name,
    level,
    lessonSummary,
  };
  delete mergedForEnglish.i18n;
  const englishStudent = makeEnglishStudent(mergedForEnglish);
  return {
    ...generated,
    ...existing,
    name,
    level,
    i18n: {
      ...(existing.i18n || {}),
      en: englishStudent,
    },
    accessCode: loginId.match(/\d+$/u)?.[0] || existing.accessCode || generated.accessCode,
    tags: existing.tags?.length ? existing.tags : generated.tags,
    reviewQueue: existing.reviewQueue?.length ? existing.reviewQueue : generated.reviewQueue,
    knowledgeLinks: existing.knowledgeLinks?.length ? existing.knowledgeLinks : generated.knowledgeLinks,
    recentFeedback: existing.recentFeedback?.length ? existing.recentFeedback : generated.recentFeedback,
    lessonSummary,
    lessonHistory: generated.lessonHistory?.length ? generated.lessonHistory : (existing.lessonHistory || []),
    lastUpdated: existing.lastUpdated || generated.lastUpdated,
  };
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function isStudentProfile(fileName, raw, frontmatter) {
  if (!fileName.startsWith('student-') || !fileName.endsWith('.md')) return false;
  if (fileName.startsWith('student-ability-') || fileName.startsWith('student-assessment-')) return false;
  if (fileName.startsWith('student-atomic-') || fileName.startsWith('student-core-')) return false;
  if (fileName === 'student-positioning-assessment.md') return false;
  if (frontmatter.profile_type === 'student') return true;
  return /^#\s+学员档案｜/mu.test(raw) && !fileName.startsWith('template-');
}

async function collectStudents() {
  const files = await readdir(obsidianStudentDir);
  const homeworkTitleMap = await getHomeworkTitleMap();
  const students = [];

  for (const fileName of files.sort()) {
    if (!fileName.endsWith('.md')) continue;
    const fullPath = join(obsidianStudentDir, fileName);
    const raw = await readFile(fullPath, 'utf8');
    const frontmatter = parseFrontmatter(raw);
    if (!isStudentProfile(fileName, raw, frontmatter)) continue;

    const studentId = basename(fileName, '.md').replace(/^student-/u, '');
    const sourceFile = fileName;
    const name = stripMarkdown(frontmatter.student_name || getHeadingName(raw) || getTableValue(raw, ['姓名']));
    if (!name) continue;

    const ageText = getTableValue(raw, ['年龄']);
    const age = ageText.match(/\d+/u)?.[0] || '';
    const level = stripMarkdown(
      getTableValue(raw, ['等级_芬兰协会', '等级(芬兰协会)', '等级']) ||
        getTableValue(raw, ['水平']) ||
        '待评估',
    );
    const tags = frontmatter.tags || '';
    const group = /青少年|儿童/u.test(tags) || Number(age) < 18 ? '青少年' : '成人';
    const focusItems = getFocusItems(raw);
    const recentGoal = getRecentGoal(raw);
    const growthPath = getGrowthPathSummary(raw);
    const homework = getAssignedHomework(raw, {
      recentGoal,
      growthPath,
      focusItems,
      homeworkTitleMap,
    });
    const loginId = loginOverrides[studentId] || fallbackLoginId(studentId, age);

    students.push({
      studentId,
      sourceFile,
      name,
      age,
      group,
      level,
      loginId,
      alias: loginId.replace(/\d+$/u, ''),
      // Who actually holds the login. Coach policy (2026-08-01): minors are
      // not given accounts — the parent is. Anything that addresses a student
      // directly (coach messages in particular) must read this first, because
      // on a 'parent' thread the reader is the guardian and the student is the
      // subject, not the audience.
      accountHolder: group === '青少年' ? 'parent' : 'student',
      focusItems,
      recentGoal,
      growthPath,
      homework,
      raw,
    });
  }

  return students;
}

async function uploadStudents(manifest) {
  const endpoint = process.env.GOODMINTON_STUDENT_SHEET_ENDPOINT;
  const token = process.env.GOODMINTON_STUDENT_SHEET_TOKEN;

  if (!endpoint || !token) {
    throw new Error('Missing GOODMINTON_STUDENT_SHEET_ENDPOINT or GOODMINTON_STUDENT_SHEET_TOKEN.');
  }

  const rows = [];
  for (const item of manifest.filter((entry) => entry.studentId !== 'demo')) {
    const raw = await readFile(join(STUDENT_DIR, item.file), 'utf8');
    const student = JSON.parse(raw);
    rows.push({
      studentId: student.studentId,
      aliases: item.alias,
      accessCode: String(student.accessCode || ''),
      studentName: student.name || '',
      studentJson: JSON.stringify(student),
    });
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token,
      action: 'upsertStudents',
      students: rows,
    }),
  });
  const text = await response.text();
  const payload = JSON.parse(text);
  if (!response.ok || payload.error) {
    throw new Error(`Upload failed: ${text}`);
  }
  return payload;
}

function backfillStudentHistory() {
  const result = spawnSync(process.execPath, ['scripts/backfill-student-history-to-supabase.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const students = await collectStudents();
const loginCredentials = { demo: 'demo', ...legacyCredentials };
const manifest = [
  {
    studentId: 'demo',
    file: 'demo.json',
    alias: 'demo',
    loginId: 'demo',
    name: '示例学员',
  },
];

for (const item of students) {
  const outputFile = `${item.studentId}.json`;
  const outputPath = join(STUDENT_DIR, outputFile);
  const generated = makeBaseStudent(item);
  const existing = await readJsonIfExists(outputPath);
  const nextStudent = existing ? mergeExistingStudent(existing, generated, item) : generated;

  loginCredentials[normalizeLoginCredential(item.loginId)] = item.studentId;
  manifest.push({
    studentId: item.studentId,
    file: outputFile,
    alias: item.alias,
    loginId: item.loginId,
    name: item.name,
    accountHolder: item.accountHolder,
    source: item.sourceFile,
  });

  if (!shouldDryRun) {
    await writeFile(outputPath, `${JSON.stringify(nextStudent, null, 2)}\n`, 'utf8');
  }
}

const orderedLoginCredentials = Object.fromEntries(
  Object.entries(loginCredentials).sort(([left], [right]) => left.localeCompare(right)),
);
const orderedManifest = manifest.sort((left, right) => left.studentId.localeCompare(right.studentId));

if (!shouldDryRun) {
  await writeFile(LOGIN_FILE, `${JSON.stringify(orderedLoginCredentials, null, 2)}\n`, 'utf8');
  await writeFile(MANIFEST_FILE, `${JSON.stringify(orderedManifest, null, 2)}\n`, 'utf8');
}

console.log(`Synced ${students.length} Obsidian student profiles.`);
for (const item of orderedManifest) {
  console.log(`${item.loginId.padEnd(8)} ${item.studentId.padEnd(18)} ${item.name}`);
}

if (shouldUpload && !shouldDryRun) {
  const payload = await uploadStudents(orderedManifest);
  console.log('Uploaded students:', payload);
}

if (shouldBackfillHistory && !shouldDryRun) {
  backfillStudentHistory();
} else if (shouldDryRun) {
  console.log('Skipped Supabase history backfill because this is a dry run.');
} else {
  console.log('Skipped Supabase history backfill because --no-backfill was provided.');
}
