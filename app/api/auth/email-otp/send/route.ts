import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createOtpToken } from '@/lib/emailOtp';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; name?: string };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ sent: false, error: 'Valid email is required' }, { status: 400 });
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const otpToken = createOtpToken(email, otp);

    const subject = `HasanahPay Verification OTP: ${otp}`;
    const greeting = name ? `Hi ${name},` : 'Hello,';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
        <h2 style="color: #0B2447; margin: 0 0 8px;">HasanahPay Verification Code</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5;">${greeting}<br/>Use the 6-digit OTP below to complete your client registration:</p>
        <div style="margin: 20px 0; padding: 16px; background: #f1f5f9; border-radius: 12px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0B2447;">
          ${otp}
        </div>
        <p style="color: #64748b; font-size: 12px;">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>
      </div>
    `;

    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    const brevoKey = (process.env.BREVO_API_KEY || '').trim();
    const fromEmail = (process.env.EMAIL_FROM || 'HasanahPay <onboarding@resend.dev>').trim();

    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Resend OTP error:', errText);
        return NextResponse.json(
          { sent: false, error: 'Failed to send OTP email via Resend.' },
          { status: 502 }
        );
      }
      return NextResponse.json({ sent: true, otpToken });
    }

    if (brevoKey) {
      const senderEmail = fromEmail.includes('<')
        ? fromEmail.slice(fromEmail.indexOf('<') + 1, fromEmail.indexOf('>'))
        : fromEmail;
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoKey,
        },
        body: JSON.stringify({
          sender: { name: 'HasanahPay', email: senderEmail },
          to: [{ email, name: name || email }],
          subject,
          htmlContent: html,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Brevo OTP error:', errText);
        return NextResponse.json(
          { sent: false, error: 'Failed to send OTP email via Brevo.' },
          { status: 502 }
        );
      }
      return NextResponse.json({ sent: true, otpToken });
    }

    return NextResponse.json(
      {
        sent: false,
        error:
          'Email OTP provider not configured. Add RESEND_API_KEY or BREVO_API_KEY in .env.local.',
      },
      { status: 503 }
    );
  } catch (err) {
    console.error('Email OTP send error:', err);
    return NextResponse.json({ sent: false, error: 'Could not send OTP.' }, { status: 500 });
  }
}
