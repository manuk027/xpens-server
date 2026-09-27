import nodemailer from 'nodemailer';

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

  if (EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST || 'smtp.gmail.com',
      port: Number(EMAIL_PORT) || 587,
      secure: Number(EMAIL_PORT) === 465,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    });
  } else {
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });
  }

  return transporter;
};

/**
 * Sends an OTP email to the user
 * 
 * @param {string} email - Destination email address
 * @param {string} fullName - Recipient full name
 * @param {string} otp - 6-digit OTP code
 */
export const sendOtpEmail = async (email, fullName, otp) => {
  const mailTransporter = await getTransporter();
  const fromAddress = process.env.EMAIL_FROM || '"xpens Security" <no-reply@xpens.app>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
        .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
        .logo-text { font-size: 24px; font-weight: 900; color: #2563eb; letter-spacing: -0.03em; margin-bottom: 20px; }
        .title { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
        .desc { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
        .otp-box { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb; background: #eff6ff; border: 1px dashed #bfdbfe; border-radius: 8px; text-align: center; padding: 16px 0; margin-bottom: 24px; }
        .expiry { font-size: 13px; color: #dc2626; font-weight: 600; text-align: center; margin-bottom: 24px; }
        .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo-text">xpens</div>
        <div class="title">Verify Your Email Address</div>
        <div class="desc">Hello <strong>${fullName}</strong>, thank you for registering with xpens. Use the verification code below to complete your account setup:</div>
        <div class="otp-box">${otp}</div>
        <div class="expiry">⚠️ This code expires in 5 minutes. Do not share it with anyone.</div>
        <div class="footer">If you did not request this verification code, please ignore this email.</div>
      </div>
    </body>
    </html>
  `;

  // Always log OTP to server console for testing/development reliability
  console.log('\n======================================================');
  console.log('📨 [OTP EMAIL NOTIFICATION]');
  console.log(`• To:         ${email} (${fullName})`);
  console.log(`• OTP Code:   👉  ${otp}  👈`);
  console.log(`• Time Limit: 5 Minutes (MongoDB TTL Protected)`);
  console.log('======================================================\n');

  try {
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `${otp} is your xpens verification code`,
      text: `Hello ${fullName}, your xpens verification OTP code is: ${otp}. It expires in 5 minutes.`,
      html: htmlContent
    });

    return info;
  } catch (err) {
    console.error('[Nodemailer Error]: Failed to dispatch email:', err.message);
    // Don't crash signup if SMTP fails; console OTP is still provided in development
    return null;
  }
};
