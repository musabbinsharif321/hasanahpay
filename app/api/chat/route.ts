import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

interface ChatRequestBody {
  messages?: ChatHistoryItem[];
  role?: 'client' | 'admin';
  contextSummary?: string;
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as ChatRequestBody;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userRole = body.role === 'admin' ? 'admin' : 'client';
    const contextSummary = typeof body.contextSummary === 'string' ? body.contextSummary : '';

    if (messages.length === 0) {
      return NextResponse.json({ error: 'Message history is required.' }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.role !== 'user' || !latestMessage.text.trim()) {
      return NextResponse.json({ error: 'Invalid user message.' }, { status: 400 });
    }

    const roleGuidance =
      userRole === 'admin'
        ? `You are assisting the Owner/Admin of "Hasanah Tech Solutions" inside the Admin Control Panel.
You can:
- Summarize pending payment approvals, Monthly Recurring Revenue (MRR in BDT ৳), due subscriptions, and client counts using ONLY the live portal snapshot below.
- Draft polite, ready-to-send payment reminder messages in Bangla, Banglish, or English including live MFS wallet numbers, configured corporate bank accounts (e.g. City Bank PLC, Prime Bank PLC, Dutch-Bangla Bank PLC), and support contact info from the snapshot.
- Explain how to approve/reject payments, add new clients/services, or edit MFS numbers, Bank Accounts, and Support Contact details from Settings.`
        : `You are assisting a Client of "Hasanah Tech Solutions" inside their Client Billing Portal.
You can:
- Answer questions about their active/due services, amounts in BDT (৳), next due dates, submitted TrxID verification statuses, and paid invoices using ONLY the live portal snapshot below.
- Guide them step-by-step on paying via active Mobile Financial Services (bKash, Nagad, Rocket, Upay) or configured Bank Transfer accounts (City Bank PLC, Prime Bank PLC, Dutch-Bangla Bank PLC, etc.) using the Pay Now drawer and submitting their TrxID.
- Provide Hasanah Tech Solutions support phone, email, and website from the snapshot if they ask how to reach support.`;

    const systemInstruction = `You are the Hasanah Tech Solutions Billing Assistant — a concise, friendly, accurate fintech support assistant embedded inside a mobile-first PWA.

${roleGuidance}

Rules:
1. Reply in the same language the user writes in (Bengali, Banglish, or English). Keep responses concise, scannable, and mobile-friendly (short paragraphs or bullet points).
2. Always format currency in Bangladeshi Taka as "৳ X,XXX" (BDT).
3. Never invent fake invoices, TrxIDs, amounts, bank routing numbers, or wallet numbers. Only cite numbers and records present in the Live Portal Snapshot below.
4. If the user asks to perform a database write (like approving a payment or submitting a TrxID), politely guide them to tap the exact button in the app UI (e.g. "Pay Now" or "Approve & Generate Invoice").

Live Portal Snapshot:
${contextSummary || 'No live billing records provided.'}`;

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const chat = ai.chats.create({
      model: 'gemini-4-hydrogen',
      history,
      config: {
        systemInstruction,
      },
    });

    const response = await chat.sendMessage({
      message: latestMessage.text.trim(),
    });

    const reply = response.text?.trim();
    if (!reply) {
      return NextResponse.json(
        { error: 'Assistant returned an empty response. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ text: reply });
  } catch (err: unknown) {
    console.error('Gemini chat API error:', err);
    const message = err instanceof Error ? err.message : 'Failed to reach AI assistant.';
    const status =
      message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
        ? 429
        : message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
