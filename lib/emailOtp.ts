import crypto from 'crypto';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getOtpSecret(): string {
  return (
    process.env.OTP_SECRET ||
    process.env.GEMINI_API_KEY ||
    'hasanahpay-otp-signing-secret-change-in-prod'
  );
}

export function hashEmailOtp(email: string, otp: string): string {
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${email.toLowerCase()}:${otp}`)
    .digest('hex');
}

export function createOtpToken(email: string, otp: string): string {
  const payload = {
    email: email.toLowerCase(),
    otpHash: hashEmailOtp(email, otp),
    exp: Date.now() + OTP_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getOtpSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyOtpToken(
  email: string,
  otp: string,
  otpToken: string
): { valid: boolean; error?: string } {
  const [data, sig] = otpToken.split('.');
  if (!data || !sig) {
    return { valid: false, error: 'Invalid OTP token.' };
  }

  const expectedSig = crypto.createHmac('sha256', getOtpSecret()).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, error: 'Invalid OTP token.' };
  }

  const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as {
    email: string;
    otpHash: string;
    exp: number;
  };

  if (Date.now() > parsed.exp) {
    return { valid: false, error: 'OTP expired. Please request a new code.' };
  }

  if (parsed.email !== email.toLowerCase()) {
    return { valid: false, error: 'Email mismatch for this OTP.' };
  }

  const candidateHash = hashEmailOtp(email, otp);
  const hashBuf = Buffer.from(candidateHash);
  const storedBuf = Buffer.from(parsed.otpHash);
  if (hashBuf.length !== storedBuf.length || !crypto.timingSafeEqual(hashBuf, storedBuf)) {
    return { valid: false, error: 'Incorrect OTP code. Please check your Gmail.' };
  }

  return { valid: true };
}
