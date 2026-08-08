"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Filter = "all" | "active" | "completed";

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
};

const STORAGE_KEY = "goodminton-todos-v1";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "active", label: "进行中" },
  { value: "completed", label: "已完成" },
];

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6">
      <path d="m6.5 12.5 3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function readStoredTodos(): Todo[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is Todo =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Todo).id === "string" &&
        typeof (item as Todo).text === "string" &&
        typeof (item as Todo).completed === "boolean" &&
        typeof (item as Todo).createdAt === "number",
    );
  } catch {
    return [];
  }
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [isReady, setIsReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTodos(readStoredTodos());
      setIsReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // The list still works when storage is unavailable (for example in private browsing).
    }
  }, [todos, isReady]);

  const activeCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - activeCount;

  const visibleTodos = useMemo(() => {
    if (filter === "active") return todos.filter((todo) => !todo.completed);
    if (filter === "completed") return todos.filter((todo) => todo.completed);
    return todos;
  }, [filter, todos]);

  function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      inputRef.current?.focus();
      return;
    }

    setTodos((current) => [
      {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        text,
        completed: false,
        createdAt: Date.now(),
      },
      ...current,
    ]);
    setDraft("");
    setFilter("all");
    inputRef.current?.focus();
  }

  function toggleTodo(id: string) {
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)),
    );
  }

  function removeTodo(id: string) {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }

  function clearCompleted() {
    setTodos((current) => current.filter((todo) => !todo.completed));
  }

  const emptyMessage =
    todos.length === 0
      ? { title: "清单还是空的", hint: "写下第一件想完成的事。" }
      : filter === "active"
        ? { title: "没有进行中的任务", hint: "今天做得不错。" }
        : { title: "还没有已完成的任务", hint: "完成一项后，它会出现在这里。" };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#f4f7f4] px-4 py-8 text-[#202521] sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-[#14bf96]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-28 h-96 w-96 rounded-full bg-[#b7e7cf]/30 blur-3xl" />

      <section className="relative mx-auto w-full max-w-2xl">
        <header className="mb-7 flex items-end justify-between gap-4 px-1 sm:mb-9">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#16845f]">
              My day
            </p>
            <h1 className="text-[2rem] font-semibold tracking-[-0.045em] text-[#19211c] sm:text-[2.6rem]">
              待办清单
            </h1>
            <p className="mt-2 text-sm text-[#6e7770]">把想做的事放在这里，一件件完成。</p>
          </div>
          <div className="hidden rounded-full border border-[#dce5de] bg-white/70 px-4 py-2 text-sm text-[#657068] shadow-sm sm:block">
            {activeCount === 0 ? "今天已清空" : `还有 ${activeCount} 项`}
          </div>
        </header>

        <div className="overflow-hidden rounded-[26px] border border-white/80 bg-white/90 shadow-[0_24px_80px_-38px_rgba(29,66,47,0.35)] backdrop-blur">
          <form onSubmit={addTodo} className="flex gap-2 border-b border-[#e8eee9] p-3 sm:p-4">
            <label htmlFor="new-todo" className="sr-only">添加待办事项</label>
            <input
              ref={inputRef}
              id="new-todo"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="接下来要做什么？"
              maxLength={160}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-2xl bg-[#f4f7f4] px-4 py-3.5 text-base text-[#202521] outline-none ring-[#14bf96]/25 transition placeholder:text-[#98a19a] focus:bg-white focus:ring-4"
            />
            <button
              type="submit"
              aria-label="添加任务"
              disabled={!draft.trim()}
              className="press flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[#14bf96] text-white shadow-[0_10px_24px_-12px_rgba(20,191,150,0.9)] transition hover:bg-[#10a985] disabled:cursor-not-allowed disabled:bg-[#d7dfd9] disabled:shadow-none"
            >
              <PlusIcon />
            </button>
          </form>

          <div className="flex items-center justify-between gap-3 border-b border-[#eef2ef] px-4 py-3 sm:px-5">
            <div className="flex rounded-xl bg-[#f1f5f2] p-1" role="group" aria-label="筛选任务">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  aria-pressed={filter === item.value}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition sm:px-4 sm:text-sm ${
                    filter === item.value
                      ? "bg-white text-[#16845f] shadow-sm"
                      : "text-[#7b847d] hover:text-[#343b36]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span className="text-xs tabular-nums text-[#8a938c] sm:hidden">{activeCount} 项待办</span>
          </div>

          <div aria-live="polite" className="min-h-[280px]">
            {!isReady ? (
              <div className="flex min-h-[280px] items-center justify-center text-sm text-[#9aa39c]">正在读取清单…</div>
            ) : visibleTodos.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf7f1] text-[#14a87f]">
                  <CheckIcon />
                </div>
                <p className="font-medium text-[#3a433d]">{emptyMessage.title}</p>
                <p className="mt-1.5 text-sm text-[#8a938c]">{emptyMessage.hint}</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#eef2ef]">
                {visibleTodos.map((todo) => (
                  <li key={todo.id} className="group flex items-center gap-3 px-4 py-4 transition hover:bg-[#fbfcfb] sm:px-5">
                    <button
                      type="button"
                      onClick={() => toggleTodo(todo.id)}
                      aria-label={todo.completed ? `将“${todo.text}”标为未完成` : `完成“${todo.text}”`}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        todo.completed
                          ? "border-[#14bf96] bg-[#14bf96] text-white"
                          : "border-[#cbd5ce] bg-white text-transparent hover:border-[#14bf96]"
                      }`}
                    >
                      <CheckIcon />
                    </button>
                    <span className={`min-w-0 flex-1 break-words text-[15px] leading-6 transition sm:text-base ${
                      todo.completed ? "text-[#9ca49e] line-through decoration-[#b9c1bb]" : "text-[#303732]"
                    }`}>
                      {todo.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTodo(todo.id)}
                      aria-label={`删除“${todo.text}”`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#a1aaa3] transition hover:bg-[#fff0ee] hover:text-[#d35f54] focus-visible:bg-[#fff0ee] focus-visible:text-[#d35f54] focus-visible:outline-none"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="flex min-h-14 items-center justify-between gap-3 border-t border-[#e8eee9] px-4 py-3 text-xs text-[#7f8981] sm:px-5 sm:text-sm">
            <span>{todos.length === 0 ? "任务会自动保存在这台设备" : `${completedCount} 项已完成 · ${activeCount} 项待办`}</span>
            {completedCount > 0 && (
              <button type="button" onClick={clearCompleted} className="shrink-0 rounded-lg px-2 py-1.5 transition hover:bg-[#f1f5f2] hover:text-[#4e5851]">
                清除已完成
              </button>
            )}
          </footer>
        </div>

        <p className="mt-5 text-center text-xs text-[#929b94]">数据仅保存在当前浏览器中</p>
      </section>
    </main>
  );
}
