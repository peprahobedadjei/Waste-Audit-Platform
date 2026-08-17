import "server-only";

import nodemailer from "nodemailer";

/*
  All outbound mail - auditor invites, email-change confirmations, manager
  alerts - goes through a single Gmail account using an app password.

  Gmail caps a free account at roughly 500 recipients a day, which comfortably
  covers a one-off batch of 160 auditor invites but is worth remembering before
  wiring up high-frequency alerting.
*/

let transporter: nodemailer.Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD);
}

function getTransporter(): nodemailer.Transporter {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_USER and SMTP_APP_PASSWORD in .env.local",
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        // Gmail app passwords are shown with spaces; they are entered without
        pass: process.env.SMTP_APP_PASSWORD?.replace(/\s/g, ""),
      },
    });
  }

  return transporter;
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail({ to, subject, html, text }: SendArgs) {
  const fromName = process.env.SMTP_FROM_NAME ?? "Waste Audit System";
  await getTransporter().sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

function layout(appName: string, heading: string, body: string) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111827">
    <div style="display:inline-block;background:#16a34a;color:#fff;padding:8px 14px;border-radius:8px;font-weight:600;font-size:14px">
      ${appName}
    </div>
    <h1 style="font-size:20px;margin:24px 0 12px">${heading}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />
    <p style="font-size:12px;color:#6b7280;margin:0">
      This is an automated message from ${appName}. If you were not expecting it, you can ignore it.
    </p>
  </div>`;
}

export async function sendAuditorInvite(args: {
  to: string;
  auditorName: string;
  districtName: string;
  inviteUrl: string;
  appName: string;
}) {
  const { to, auditorName, districtName, inviteUrl, appName } = args;

  const html = layout(
    appName,
    `You have been added as an auditor`,
    `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">
       Hello ${auditorName}, you have been added as an auditor for
       <strong>${districtName}</strong> district.
     </p>
     <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
       Use the link below to set your PIN, then sign in to the mobile app.
       This link can only be used once and expires in 7 days.
     </p>
     <a href="${inviteUrl}"
        style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px">
       Set up my account
     </a>`,
  );

  const text =
    `Hello ${auditorName},\n\n` +
    `You have been added as an auditor for ${districtName} district.\n\n` +
    `Set your PIN here (single use, expires in 7 days):\n${inviteUrl}\n`;

  await sendEmail({
    to,
    subject: `${appName} - set up your auditor account`,
    html,
    text,
  });
}

export async function sendEmailChangeConfirmation(args: {
  to: string;
  name: string;
  confirmUrl: string;
  appName: string;
}) {
  const { to, name, confirmUrl, appName } = args;

  const html = layout(
    appName,
    "Confirm your new email address",
    `<p style="font-size:15px;line-height:1.6;margin:0 0 24px">
       Hello ${name}, a request was made to change your sign-in email to this
       address. The change only takes effect once you confirm it below.
     </p>
     <a href="${confirmUrl}"
        style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px">
       Confirm email change
     </a>`,
  );

  const text =
    `Hello ${name},\n\n` +
    `Confirm your new sign-in email address:\n${confirmUrl}\n\n` +
    `If you did not request this, ignore this message.\n`;

  await sendEmail({
    to,
    subject: `${appName} - confirm your new email address`,
    html,
    text,
  });
}
