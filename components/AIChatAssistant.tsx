'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, MessageSquare, RotateCcw, Send, User, X } from 'lucide-react';
import { BrandMark } from './BrandMark';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface AIChatAssistantProps {
  role: 'client' | 'admin';
  userName: string;
  contextSummary: string;
}

const CLIENT_QUICK_PROMPTS = [
  'আমার কত টাকা বকেয়া আছে?',
  'ব্যাংক বা bKash দিয়ে কীভাবে পে করবো?',
  'আমার পেমেন্ট স্ট্যাটাস কী?',
  'সাপোর্টে যোগাযোগ করবো কীভাবে?',
];

const ADMIN_QUICK_PROMPTS = [
  'পেন্ডিং পেমেন্ট কয়টি ও কত টাকা?',
  'ক্লায়েন্টের জন্য পেমেন্ট রিমাইন্ডার লিখে দাও',
  'এই মাসের MRR ও অ্যাক্টিভ ক্লায়েন্ট সামারি দাও',
  'ব্যাংক ও MFS নম্বর কোথা থেকে বদলাবো?',
];

export function AIChatAssistant({ role, userName, contextSummary }: AIChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text:
        role === 'admin'
          ? `স্বাগতম ${userName}! আমি Hasanah Tech Solutions বিলিং অ্যাসিস্ট্যান্ট। পেন্ডিং পেমেন্ট সামারি, MRR হিসাব বা ক্লায়েন্টদের জন্য রিমাইন্ডার মেসেজ লিখতে আমাকে জিজ্ঞাসা করুন।`
          : `হ্যালো ${userName}! আমি Hasanah Tech Solutions বিলিং অ্যাসিস্ট্যান্ট। আপনার বকেয়া বিল, bKash/Nagad/Rocket/Upay বা City/Prime/DBBL ব্যাংক পেমেন্ট ও ইনভয়েস সম্পর্কে জানতে জিজ্ঞাসা করুন।`,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const idCounterRef = useRef(0);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    idCounterRef.current += 1;
    const userMsg: ChatMessage = {
      id: `u_${idCounterRef.current}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setErrorMsg(null);
    setSending(true);

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          role,
          contextSummary,
        }),
      });

      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        throw new Error(data.error || 'Could not get a response from the assistant.');
      }

      idCounterRef.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `m_${idCounterRef.current}`,
          role: 'model',
          text: data.text!,
        },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    if (sending) return;
    setErrorMsg(null);
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text:
          role === 'admin'
            ? `নতুন চ্যাট শুরু হয়েছে। পেন্ডিং পেমেন্ট, MRR বা ক্লায়েন্ট রিমাইন্ডার নিয়ে প্রশ্ন করুন।`
            : `নতুন চ্যাট শুরু হয়েছে। আপনার সার্ভিস, ব্যাংক/MFS পেমেন্ট বা ইনভয়েস নিয়ে প্রশ্ন করুন।`,
      },
    ]);
  };

  const quickPrompts = role === 'admin' ? ADMIN_QUICK_PROMPTS : CLIENT_QUICK_PROMPTS;

  return (
    <>
      {/* Floating Mobile-Ergonomic Trigger Above Bottom Nav */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Hasanah Tech AI Assistant"
          className="fixed bottom-20 right-4 z-30 flex h-12 items-center gap-2 rounded-full border border-[#D4941F]/30 bg-[#0B2447] px-4 text-xs font-semibold text-white shadow-lg transition hover:bg-[#13386B] active:scale-[0.96] dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
        >
          <MessageSquare className="h-4 w-4 text-[#E5A93B] dark:text-white" />
          <span>AI Help</span>
        </button>
      )}

      {/* Mobile Bottom-Sheet AI Chat Drawer */}
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[75] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Hasanah Tech AI Assistant"
          >
            <div className="absolute inset-0" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex h-[86dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0B162B] sm:h-[640px] sm:rounded-3xl"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-2.5 sm:hidden">
                <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-2.5">
                  <BrandMark size="sm" />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-[#0B2447] dark:text-white">
                      Hasanah Billing Assistant
                    </h2>
                    <p className="truncate text-[11px] text-[#1D6E8C] dark:text-[#38BDF8]">
                      {role === 'admin'
                        ? 'Owner Insights & Reminders'
                        : '24/7 Billing & Payment Help'}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={sending}
                    aria-label="Reset conversation"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close assistant"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Quick Prompts Bar */}
              <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={sending}
                    onClick={() => sendMessage(prompt)}
                    className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#1D6E8C] hover:bg-[#1D6E8C]/5 active:scale-[0.98] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-[#38BDF8]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Messages Feed */}
              <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && <BrandMark size="sm" className="h-7 w-7 rounded-lg p-0.5" />}
                      <div
                        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          isUser
                            ? 'rounded-br-md bg-[#0B2447] text-white dark:bg-[#1D6E8C]'
                            : 'rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100'
                        }`}
                      >
                        {msg.text}
                      </div>
                      {isUser && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex items-end gap-2">
                    <BrandMark size="sm" className="h-7 w-7 rounded-lg p-0.5" />
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1D6E8C] dark:text-[#38BDF8]" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex shrink-0 items-center gap-2 border-t border-slate-100 px-4 py-3 pb-safe dark:border-slate-800"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={sending}
                  placeholder="Write a message in Bangla or English..."
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D6E8C] focus:bg-white focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white dark:focus:border-[#38BDF8]"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B2447] text-white transition hover:bg-[#13386B] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
