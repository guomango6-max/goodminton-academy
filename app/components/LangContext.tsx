'use client';

import { createContext, useContext, useEffect, useSyncExternalStore, ReactNode } from 'react';

export type Lang = 'zh' | 'en';

const LangContext = createContext<{
  lang: Lang;
  toggle: () => void;
}>({ lang: 'zh', toggle: () => {} });

const LANG_STORAGE_KEY = 'goodminton-lang';
const LANG_CHANGE_EVENT = 'goodminton-lang-change';

function normalizeLang(value: string | null): Lang {
  return value === 'en' ? 'en' : 'zh';
}

function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  const urlLang = normalizeLang(new URLSearchParams(window.location.search).get('lang'));
  if (urlLang === 'en') return 'en';
  return normalizeLang(window.localStorage.getItem(LANG_STORAGE_KEY));
}

function getServerLang(): Lang {
  return 'zh';
}

function subscribeLangChange(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(LANG_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(LANG_CHANGE_EVENT, onStoreChange);
  };
}

/**
 * 写入本地语言偏好。
 *
 * 首页的语言切换已经改成换地址（/ ↔ /en），但学员页和论坛仍然只认 localStorage，
 * 所以换地址的同时也要把偏好写一致，免得学员从英文首页点进学员页又变回中文。
 */
export function setStoredLang(next: Lang) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANG_STORAGE_KEY, next);
  window.dispatchEvent(new Event(LANG_CHANGE_EVENT));
}

export function LangProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribeLangChange, getStoredLang, getServerLang);

  useEffect(() => {
    const urlLang = normalizeLang(new URLSearchParams(window.location.search).get('lang'));
    if (urlLang === 'en' && window.localStorage.getItem(LANG_STORAGE_KEY) !== 'en') {
      window.localStorage.setItem(LANG_STORAGE_KEY, 'en');
      window.dispatchEvent(new Event(LANG_CHANGE_EVENT));
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const toggle = () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
    window.dispatchEvent(new Event(LANG_CHANGE_EVENT));
  };

  return <LangContext.Provider value={{ lang, toggle }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
