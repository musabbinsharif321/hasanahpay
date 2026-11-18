import { NextResponse } from 'next/server';

const CLIENT_CODE_REGEX = /^HP-[0-9]{6}$/;

function formatBanglaLocalPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length === 13) {
    return digits;
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return `88${digits}`;
  }
  return digits;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phone?: string;
      clientCode?: string;
      name?: string;
    };

    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const clientCode = typeof body.clientCode === 'string' ? body.clientCode.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!phone || !CLIENT_CODE_REGEX.test(clientCode)) {
      return NextResponse.json(
        { sent: false, error: 'Invalid phone or clientCode' },
        { status: 400 }
      );
    }

    const greeting = name ? `Priyo ${name}, ` : '';
    const message = `${greeting}HasanahPay te apnar ekta account register kora hoyeche. Apnar Client ID: ${clientCode}. Next time ei ID o password diye login korun.`;

    const provider = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
    const apiKey = (process.env.SMS_API_KEY || '').trim();
    const senderId = (process.env.SMS_SENDER_ID || '').trim();

    if (!provider || !apiKey) {
      return NextResponse.json({
        sent: false,
        reason: 'SMS gateway not configured in environment variables',
      });
    }

    if (provider === 'bulksmsbd') {
      const number = formatBanglaLocalPhone(phone);
      const params = new URLSearchParams({
        api_key: apiKey,
        type: 'text',
        number,
        senderid: senderId || '8809617613541',
        message,
      });
      const res = await fetch(`https://bulksmsbd.net/api/smsapi?${params.toString()}`, {
        method: 'GET',
      });
      const text = await res.text();
      return NextResponse.json({ sent: res.ok, provider, response: text });
    }

    if (provider === 'greenweb') {
      const to = formatBanglaLocalPhone(phone);
      const params = new URLSearchParams({
        token: apiKey,
        to,
        message,
      });
      const res = await fetch('https://api.greenweb.com.bd/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const text = await res.text();
      return NextResponse.json({ sent: res.ok, provider, response: text });
    }

    if (provider === 'webhook' && process.env.SMS_WEBHOOK_URL) {
      const res = await fetch(process.env.SMS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          to: phone,
          senderId,
          clientCode,
          message,
        }),
      });
      return NextResponse.json({ sent: res.ok, provider });
    }

    return NextResponse.json({
      sent: false,
      reason: `Unsupported SMS_PROVIDER: ${provider}`,
    });
  } catch (err) {
    console.error('Welcome SMS error:', err);
    return NextResponse.json({ sent: false, error: 'SMS dispatch failed' }, { status: 500 });
  }
}
