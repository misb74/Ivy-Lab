import nodemailer from 'nodemailer';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function getTransporter(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail(
  recipient: string,
  subject: string | undefined,
  body: string,
): Promise<EmailResult> {
  try {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: recipient,
      subject: subject || '(No Subject)',
      text: body,
      html: body.includes('<') ? body : undefined,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
