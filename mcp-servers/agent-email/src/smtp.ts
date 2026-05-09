import nodemailer from 'nodemailer';

interface SendEmailOptions {
  cc?: string;
  bcc?: string;
  html?: boolean;
  attachments?: Array<{ filename: string; path: string }>;
}

interface SendEmailResult {
  success: boolean;
  messageId: string | null;
  message: string;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  options?: SendEmailOptions,
): Promise<SendEmailResult> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP configuration missing. Required env vars: SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
  }

  const transporter = createTransporter();

  const mailOptions: nodemailer.SendMailOptions = {
    from: process.env.SMTP_USER,
    to,
    subject,
    ...(options?.cc && { cc: options.cc }),
    ...(options?.bcc && { bcc: options.bcc }),
  };

  if (options?.html) {
    mailOptions.html = body;
  } else {
    mailOptions.text = body;
  }

  if (options?.attachments?.length) {
    mailOptions.attachments = options.attachments;
  }

  const maxAttempts = 3;
  const baseDelay = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        message: `Email sent successfully to ${to}`,
      };
    } catch (error) {
      const errMsg = (error as Error).message;
      if (attempt === maxAttempts) {
        return {
          success: false,
          messageId: null,
          message: `Failed to send email after ${maxAttempts} attempts: ${errMsg}`,
        };
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.error(`Send attempt ${attempt} failed (${errMsg}), retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // Unreachable, but satisfies TypeScript
  return { success: false, messageId: null, message: 'Unexpected error' };
}
