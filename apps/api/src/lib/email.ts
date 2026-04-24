import nodemailer from "nodemailer";
import { logger } from "./logger";

let transporter: nodemailer.Transporter | null = null;
let initialized = false;

function getTransporter(): nodemailer.Transporter | null {
  if (initialized) return transporter;
  initialized = true;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    logger.info(
      "SMTP not configured (missing SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS) — reply notifications will be logged only.",
    );
    return null;
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
  const t = getTransporter();
  const from = process.env.SMTP_FROM ?? "Campus Forum <no-reply@campus.local>";
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
    await t.sendMail({ from, to: n.toEmail, subject, text, html });
    logger.info(
      { to: n.toEmail, postId: n.postId },
      "Sent reply notification email",
    );
  } catch (err) {
    logger.error({ err, to: n.toEmail }, "Failed to send reply notification");
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
