import nodemailer from "nodemailer";
import { logger } from "./logger";

let transporter: nodemailer.Transporter | null = null;
let initialized = false;

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (initialized) return transporter;
  initialized = true;

  const resendApiKey = process.env.RESEND_API_KEY;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Even if Resend API key is present, we might still want the transporter for other emails
  // But for now, if RESEND_API_KEY is there, we'll try to use the HTTP API in sendVerificationEmail.
  // We still configure SMTP as a fallback or for other email types.
  if (resendApiKey) {
    logger.info("Configuring SMTP using Resend API Key...");
    transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: resendApiKey,
      },
    });
    return transporter;
  }

  if (!host || !port || !user || !pass) {
    logger.info("SMTP not configured. Creating Ethereal Email test account for development...");
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      logger.info("Ethereal Email test account created successfully.");
      return transporter;
    } catch (err) {
      logger.error({ err }, "Failed to create Ethereal Email account");
      return null;
    }
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });

  return transporter;
}

export interface ReplyNotification {
  toEmail: string;
  toName: string;
  postTitle: string;
  postId: number;
  replierName: string;
  replyExcerpt: string;
}

export async function sendReplyNotification(
  n: ReplyNotification,
): Promise<void> {
  const t = await getTransporter();
  const from = process.env.SMTP_FROM ?? (process.env.RESEND_API_KEY ? "onboarding@resend.dev" : "Campus Forum <no-reply@campus.local>");
  const subject = `New reply on your post: ${n.postTitle}`;
  const text = `Hi ${n.toName},\n\n${n.replierName} replied to your post "${n.postTitle}":\n\n"${n.replyExcerpt}"\n\nView the full thread: /post/${n.postId}\n\n— Campus Forum`;
  const html = `<p>Hi <strong>${escapeHtml(n.toName)}</strong>,</p>
<p><strong>${escapeHtml(n.replierName)}</strong> replied to your post <em>${escapeHtml(n.postTitle)}</em>:</p>
<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${escapeHtml(n.replyExcerpt)}</blockquote>
<p><a href="/post/${n.postId}">View the full thread</a></p>
<p style="color:#888;font-size:12px">— Campus Forum</p>`;

  if (!t) {
    logger.info(
      { to: n.toEmail, postId: n.postId, replier: n.replierName },
      "[email-stub] reply notification (SMTP not configured)",
    );
    return;
  }

  try {
    const info = await t.sendMail({ from, to: n.toEmail, subject, text, html });
    logger.info(
      { to: n.toEmail, postId: n.postId },
      "Sent reply notification email",
    );
    if (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY) {
      logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    logger.error({ err, to: n.toEmail }, "Failed to send reply notification");
  }
}

export async function sendVerificationEmail(toEmail: string, code: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.SMTP_FROM || "UWDegree Explorer <no-reply@uwdegree.org>";
  logger.info({ from, to: toEmail }, "Preparing to send email...");
  const subject = "Verify your student email";
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #333;">Verify your email address</h2>
      <p style="color: #555; font-size: 16px;">Hi there,</p>
      <p style="color: #555; font-size: 16px;">Thank you for using <strong>UWDegree Explorer</strong>. Please use the following verification code to complete your registration:</p>
      <div style="background-color: #f4f4f7; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #2563eb;">${code}</span>
      </div>
      <p style="color: #777; font-size: 14px;">This code will expire in <strong>15 minutes</strong>. If you did not request this code, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px; text-align: center;">
        &copy; 2026 UWDegree Explorer. Built for UWaterloo Students.
      </p>
    </div>`;

  if (resendApiKey) {
    logger.info({ to: toEmail }, "Sending verification email via Resend HTTP API...");
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from,
          to: toEmail,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error({ error, to: toEmail }, "Resend API error response");
      } else {
        logger.info({ to: toEmail }, "Successfully sent email via Resend API");
        return;
      }
    } catch (err) {
      logger.error({ err, to: toEmail }, "Failed to call Resend API, falling back to SMTP");
    }
  }

  const t = await getTransporter();
  if (!t) {
    logger.info(
      { to: toEmail, code },
      "[email-stub] student verification (SMTP not configured)",
    );
    return;
  }

  try {
    const info = await t.sendMail({ from, to: toEmail, subject, html });
    logger.info({ to: toEmail }, "Sent student verification email via SMTP");
    if (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY) {
      logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    logger.error({ err, to: toEmail }, "Failed to send student verification email via SMTP");
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
