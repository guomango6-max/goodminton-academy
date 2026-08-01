// Demo comment store for the 学员精华 wall (/forum).
// Comments land as `pending` and only `approved` ones are ever returned —
// same moderation contract the production Supabase table will use.
// Storage is in-memory (survives hot reload via globalThis, resets on server
// restart); replace with a Supabase `forum_comments` table for production.

import { NextResponse } from 'next/server';

type CommentStatus = 'pending' | 'approved';

type ForumComment = {
  id: string;
  postId: string;
  name: string;
  body: string;
  status: CommentStatus;
  createdAt: string;
};

const globalStore = globalThis as unknown as { __forumComments?: ForumComment[] };

if (!globalStore.__forumComments) {
  globalStore.__forumComments = [
    {
      id: 'seed-1',
      postId: 'mock-correction-1',
      name: '小林',
      body: '我也有这个毛病，接发完就定在原地。下次试试默念"上"。',
      status: 'approved',
      createdAt: '2026-05-31T09:12:00Z',
    },
    {
      id: 'seed-2',
      postId: 'mock-stuck-3',
      name: 'Mika',
      body: '反手我练了半年才有感觉，慢慢来。',
      status: 'approved',
      createdAt: '2026-05-28T18:40:00Z',
    },
  ];
}

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, max-age=0',
};

export const dynamic = 'force-dynamic';

export async function GET() {
  const approved = (globalStore.__forumComments || []).filter((comment) => comment.status === 'approved');
  const grouped: Record<string, Omit<ForumComment, 'status'>[]> = {};
  for (const comment of approved) {
    const { status: _status, ...publicComment } = comment;
    (grouped[comment.postId] ||= []).push(publicComment);
  }
  return NextResponse.json({ comments: grouped }, { headers: NO_STORE_HEADERS });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { postId, name, body, website } = (payload || {}) as Record<string, unknown>;

  // Honeypot filled → almost certainly a bot. Pretend success, store nothing.
  if (typeof website === 'string' && website.trim()) {
    return NextResponse.json({ ok: true, status: 'pending' });
  }

  const trimmedPostId = typeof postId === 'string' ? postId.trim() : '';
  const trimmedName = typeof name === 'string' ? name.trim().slice(0, 30) : '';
  const trimmedBody = typeof body === 'string' ? body.trim().slice(0, 500) : '';

  if (!trimmedPostId || !trimmedName || !trimmedBody) {
    return NextResponse.json({ error: 'postId, name, and body are required.' }, { status: 400 });
  }

  globalStore.__forumComments!.push({
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    postId: trimmedPostId,
    name: trimmedName,
    body: trimmedBody,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, status: 'pending' });
}
