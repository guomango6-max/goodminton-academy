import type { Metadata } from "next";
import TodoApp from "./TodoApp";

export const metadata: Metadata = {
  title: "待办清单",
  description: "一个简洁、专注、保存在本机的待办清单。",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TodoPage() {
  return <TodoApp />;
}
