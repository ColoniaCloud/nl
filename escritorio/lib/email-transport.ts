import nodemailer from "nodemailer";
import getPool from "@/lib/db-manu";
import { decryptToken } from "@/lib/margarita-encrypt";

export interface EmailAccountRow {
  id: number;
  user_id: number;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: number;
  smtp_user: string;
  smtp_password_enc: string;
  from_name: string | null;
  from_email: string;
  status: "disconnected" | "connected" | "error";
  connected_at: string | null;
}

export async function getEmailAccount(userId: number): Promise<EmailAccountRow | null> {
  const pool = getPool();
  const [[row]] = (await pool.execute(
    `SELECT * FROM mm_email_accounts WHERE user_id = ?`,
    [userId]
  )) as any;
  return row ?? null;
}

export function buildTransport(account: {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: number | boolean;
  smtp_user: string;
  smtp_password_enc: string;
}) {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: !!account.smtp_secure,
    auth: {
      user: account.smtp_user,
      pass: decryptToken(account.smtp_password_enc),
    },
  });
}
