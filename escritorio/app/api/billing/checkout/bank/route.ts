import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getPool, ensureTables, getUserId, COOKIE_NAME } from "@/lib/db-billing";
import { PLANS, getPlanPrice } from "@/lib/billing-plans";
import type { PlanId, BillingCycle } from "@/lib/billing-plans";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

async function auth() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

// POST /api/billing/checkout/bank
// multipart/form-data: planId, billingCycle, receipt (file)
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "invalid_form" }, { status: 400 }); }

  const planId = formData.get("planId") as PlanId;
  const billingCycle = formData.get("billingCycle") as BillingCycle;
  const receipt = formData.get("receipt") as File | null;

  const plan = PLANS[planId];
  if (!plan || planId === "free") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }
  if (billingCycle !== "monthly" && billingCycle !== "annual") {
    return NextResponse.json({ error: "invalid_cycle" }, { status: 400 });
  }
  if (!receipt) {
    return NextResponse.json({ error: "receipt_required" }, { status: 400 });
  }
  if (receipt.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(receipt.type)) {
    return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
  }

  // Save file to public/uploads/receipts/
  const ext = receipt.type === "application/pdf" ? ".pdf"
    : receipt.type === "image/png" ? ".png"
    : receipt.type === "image/webp" ? ".webp"
    : ".jpg";

  const filename = `${randomUUID()}${ext}`;
  const uploadsDir = join(process.cwd(), "public", "uploads", "receipts");
  await mkdir(uploadsDir, { recursive: true });

  const bytes = await receipt.arrayBuffer();
  await writeFile(join(uploadsDir, filename), Buffer.from(bytes));
  const receiptUrl = `/uploads/receipts/${filename}`;

  const amount = getPlanPrice(planId, billingCycle);
  const transferId = randomUUID();

  await ensureTables();
  const pool = getPool();

  await pool.execute(
    `INSERT INTO bl_bank_transfers
       (id, user_id, plan_slug, billing_cycle, amount_usd, receipt_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [transferId, session.userId, plan.slug, billingCycle, amount, receiptUrl]
  );

  return NextResponse.json({
    ok: true,
    message: "Comprobante recibido. Un administrador revisara tu pago en 24-48 horas habiles.",
    transferId,
  });
}
