import { NextResponse } from 'next/server';
import { verifyOtpToken } from '@/lib/emailOtp';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      otp?: string;
      otpToken?: string;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';
    const otpToken = typeof body.otpToken === 'string' ? body.otpToken.trim() : '';

    if (!email || !/^[0-9]{6}$/.test(otp) || !otpToken.includes('.')) {
      return NextResponse.json({ verified: false, error: 'Invalid OTP format.' }, { status: 400 });
    }

    const result = verifyOtpToken(email, otp, otpToken);
    if (!result.valid) {
      return NextResponse.json(
        { verified: false, error: result.error || 'OTP verification failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error('Email OTP verify error:', err);
    return NextResponse.json({ verified: false, error: 'OTP verification failed.' }, { status: 500 });
  }
}
