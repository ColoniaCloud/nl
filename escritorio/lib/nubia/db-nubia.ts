/**
 * Nubia DB — queries against nb_* tables (manu_dev database)
 */
import getPool from "@/lib/db-manu";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NbProject = {
  id: number;
  user_id: number;
  subdomain: string;
  name: string;
  description: string | null;
  industry: string | null;
  template: "boutique" | "fresh" | "spark" | "classic" | "neon" | "terra";
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  whatsapp: string | null;
  manu_dev_project_id: number | null;
  container_id: string | null;
  site_url: string | null;
  status: "draft" | "building" | "active" | "error";
  last_build_error: string | null;
  created_at: string;
  build_started_at: string | null;
  build_finished_at: string | null;
};

export type NbDesign = {
  id: number;
  project_id: number;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  tagline: string | null;
};

export type NbProduct = {
  id: number;
  project_id: number;
  category_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  description_enhanced: string | null;
  price: number;
  compare_price: number | null;
  stock: number | null;
  track_stock: number;
  images: string[];
  featured: number;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type NbCategory = {
  id: number;
  project_id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  active: number;
};

export type NbPaymentConfig = {
  id: number;
  project_id: number;
  bank_transfer_enabled: number;
  bank_transfer_details: string | null;
  mercadopago_enabled: number;
  mercadopago_access_token: string | null;
  mercadopago_public_key: string | null;
  mercadopago_country: string | null;
  mercadopago_currency: string | null;
  coinbase_enabled: number;
  coinbase_api_key: string | null;
  coinbase_webhook_secret: string | null;
};

export type NbOrder = {
  id: number;
  project_id: number;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  subtotal: number;
  total: number;
  payment_method: "bank_transfer" | "mercadopago" | "coinbase";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_reference: string | null;
  notes: string | null;
  admin_notes: string | null;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type NbOrderItem = {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
};

// ─── Projects ────────────────────────────────────────────────────────────────

export async function getProjectsByUser(userId: number): Promise<NbProject[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM nb_projects WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );
  return rows as NbProject[];
}

export async function getProjectById(id: number, userId: number): Promise<NbProject | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM nb_projects WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  const list = rows as NbProject[];
  return list[0] ?? null;
}

export async function getProjectBySubdomain(subdomain: string): Promise<NbProject | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM nb_projects WHERE subdomain = ?",
    [subdomain]
  );
  const list = rows as NbProject[];
  return list[0] ?? null;
}

export async function createProject(data: {
  user_id: number;
  subdomain: string;
  name: string;
  description?: string;
  industry?: string;
  template: "boutique" | "fresh" | "spark" | "classic" | "neon" | "terra";
  email?: string;
  phone?: string;
  location?: string;
  whatsapp?: string;
  manu_dev_project_id?: number;
}): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO nb_projects
      (user_id, subdomain, name, description, industry, template, email, phone, location, whatsapp, manu_dev_project_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.subdomain,
      data.name,
      data.description ?? null,
      data.industry ?? null,
      data.template,
      data.email ?? null,
      data.phone ?? null,
      data.location ?? null,
      data.whatsapp ?? null,
      data.manu_dev_project_id ?? null,
    ]
  );
  return (result as { insertId: number }).insertId;
}

export async function updateProjectStatus(
  id: number,
  status: NbProject["status"],
  extra?: { container_id?: string; site_url?: string; last_build_error?: string; build_started_at?: string; build_finished_at?: string }
) {
  const pool = getPool();
  const fields: string[] = ["status = ?"];
  const values: unknown[] = [status];
  if (extra?.container_id !== undefined) { fields.push("container_id = ?"); values.push(extra.container_id); }
  if (extra?.site_url !== undefined) { fields.push("site_url = ?"); values.push(extra.site_url); }
  if (extra?.last_build_error !== undefined) { fields.push("last_build_error = ?"); values.push(extra.last_build_error); }
  if (extra?.build_started_at !== undefined) { fields.push("build_started_at = ?"); values.push(extra.build_started_at.replace("T", " ").replace("Z", "").slice(0, 19)); }
  if (extra?.build_finished_at !== undefined) { fields.push("build_finished_at = ?"); values.push(extra.build_finished_at.replace("T", " ").replace("Z", "").slice(0, 19)); }
  values.push(id);
  await pool.execute(`UPDATE nb_projects SET ${fields.join(", ")} WHERE id = ?`, values as any);
}

export async function updateProjectInfo(
  id: number,
  userId: number,
  data: Partial<Pick<NbProject, "name" | "description" | "industry" | "logo_url" | "email" | "phone" | "location" | "whatsapp">>
) {
  const pool = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    fields.push(`${k} = ?`);
    values.push(v);
  }
  if (fields.length === 0) return;
  values.push(id, userId);
  await pool.execute(
    `UPDATE nb_projects SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    values as any
  );
}

export async function subdomainAvailable(subdomain: string): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT id FROM nb_projects WHERE subdomain = ? LIMIT 1",
    [subdomain]
  );
  return (rows as unknown[]).length === 0;
}

// ─── Design ──────────────────────────────────────────────────────────────────

export async function getDesign(projectId: number): Promise<NbDesign | null> {
  const pool = getPool();
  const [rows] = await pool.execute("SELECT * FROM nb_design WHERE project_id = ?", [projectId]);
  const list = rows as NbDesign[];
  return list[0] ?? null;
}

export async function upsertDesign(projectId: number, data: Partial<Omit<NbDesign, "id" | "project_id">>) {
  const pool = getPool();
  const existing = await getDesign(projectId);
  if (!existing) {
    await pool.execute(
      `INSERT INTO nb_design (project_id, primary_color, secondary_color, accent_color, font_heading, font_body, tagline)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        data.primary_color ?? "#6366f1",
        data.secondary_color ?? "#4f46e5",
        data.accent_color ?? "#f59e0b",
        data.font_heading ?? "Playfair Display",
        data.font_body ?? "Inter",
        data.tagline ?? null,
      ]
    );
  } else {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
    if (fields.length === 0) return;
    values.push(projectId);
    await pool.execute(`UPDATE nb_design SET ${fields.join(", ")} WHERE project_id = ?`, values as any);
  }
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategories(projectId: number): Promise<NbCategory[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM nb_categories WHERE project_id = ? ORDER BY sort_order, name",
    [projectId]
  );
  return rows as NbCategory[];
}

export async function createCategory(projectId: number, data: { name: string; slug: string; description?: string }): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute(
    "INSERT INTO nb_categories (project_id, name, slug, description) VALUES (?, ?, ?, ?)",
    [projectId, data.name, data.slug, data.description ?? null]
  );
  return (result as { insertId: number }).insertId;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function getProducts(projectId: number, onlyActive = false): Promise<NbProduct[]> {
  const pool = getPool();
  const where = onlyActive ? "WHERE project_id = ? AND active = 1" : "WHERE project_id = ?";
  const [rows] = await pool.execute(
    `SELECT * FROM nb_products ${where} ORDER BY featured DESC, sort_order, name`,
    [projectId]
  );
  return (rows as NbProduct[]).map(parseProductImages);
}

export async function getProductBySlug(projectId: number, slug: string): Promise<NbProduct | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM nb_products WHERE project_id = ? AND slug = ? AND active = 1",
    [projectId, slug]
  );
  const list = rows as NbProduct[];
  return list[0] ? parseProductImages(list[0]) : null;
}

export async function createProduct(projectId: number, data: {
  name: string; slug: string; description?: string; price: number;
  compare_price?: number; images?: string[]; category_id?: number; featured?: boolean;
}): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO nb_products (project_id, category_id, name, slug, description, price, compare_price, images, featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      data.category_id ?? null,
      data.name,
      data.slug,
      data.description ?? null,
      data.price,
      data.compare_price ?? null,
      JSON.stringify(data.images ?? []),
      data.featured ? 1 : 0,
    ]
  );
  return (result as { insertId: number }).insertId;
}

export async function updateProduct(
  id: number,
  projectId: number,
  data: Partial<Omit<NbProduct, "id" | "project_id" | "created_at" | "updated_at">>
) {
  const pool = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    fields.push(`${k} = ?`);
    values.push(k === "images" ? JSON.stringify(v) : v);
  }
  if (fields.length === 0) return;
  values.push(id, projectId);
  await pool.execute(
    `UPDATE nb_products SET ${fields.join(", ")} WHERE id = ? AND project_id = ?`,
    values as any
  );
}

export async function deleteProduct(id: number, projectId: number) {
  const pool = getPool();
  await pool.execute("DELETE FROM nb_products WHERE id = ? AND project_id = ?", [id, projectId]);
}

export async function deleteCategory(id: number, projectId: number) {
  const pool = getPool();
  await pool.execute("DELETE FROM nb_categories WHERE id = ? AND project_id = ?", [id, projectId]);
}

function parseProductImages(p: NbProduct): NbProduct {
  if (typeof p.images === "string") {
    try { p.images = JSON.parse(p.images); } catch { p.images = []; }
  }
  return p;
}

// ─── Payment Config ──────────────────────────────────────────────────────────

export async function getPaymentConfig(projectId: number): Promise<NbPaymentConfig | null> {
  const pool = getPool();
  const [rows] = await pool.execute("SELECT * FROM nb_payment_config WHERE project_id = ?", [projectId]);
  const list = rows as NbPaymentConfig[];
  return list[0] ?? null;
}

export async function upsertPaymentConfig(projectId: number, data: Partial<Omit<NbPaymentConfig, "id" | "project_id">>) {
  const pool = getPool();
  const existing = await getPaymentConfig(projectId);
  if (!existing) {
    await pool.execute(
      `INSERT INTO nb_payment_config (project_id, bank_transfer_enabled, bank_transfer_details,
        mercadopago_enabled, mercadopago_access_token, mercadopago_public_key,
        mercadopago_country, mercadopago_currency,
        coinbase_enabled, coinbase_api_key, coinbase_webhook_secret)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        data.bank_transfer_enabled ?? 0,
        data.bank_transfer_details ?? null,
        data.mercadopago_enabled ?? 0,
        data.mercadopago_access_token ?? null,
        data.mercadopago_public_key ?? null,
        data.mercadopago_country ?? null,
        data.mercadopago_currency ?? null,
        data.coinbase_enabled ?? 0,
        data.coinbase_api_key ?? null,
        data.coinbase_webhook_secret ?? null,
      ]
    );
  } else {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
    if (fields.length === 0) return;
    values.push(projectId);
    await pool.execute(`UPDATE nb_payment_config SET ${fields.join(", ")} WHERE project_id = ?`, values as any);
  }
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function getOrders(projectId: number, limit = 50): Promise<NbOrder[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM nb_orders WHERE project_id = ? ORDER BY created_at DESC LIMIT ${Number(limit)}`,
    [projectId]
  );
  return rows as NbOrder[];
}

export async function getOrderById(id: number, projectId: number): Promise<NbOrder | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM nb_orders WHERE id = ? AND project_id = ?",
    [id, projectId]
  );
  const list = rows as NbOrder[];
  return list[0] ?? null;
}

export async function getOrderByNumber(orderNumber: string, projectId: number): Promise<NbOrder | null> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM nb_orders WHERE order_number = ? AND project_id = ?",
    [orderNumber, projectId]
  );
  const list = rows as NbOrder[];
  return list[0] ?? null;
}

export async function getOrderItems(orderId: number): Promise<NbOrderItem[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM nb_order_items WHERE order_id = ?",
    [orderId]
  );
  return rows as NbOrderItem[];
}

export async function createOrder(
  projectId: number,
  data: {
    customer_name?: string; customer_email?: string; customer_phone?: string;
    shipping_address?: string; subtotal: number; total: number;
    payment_method: "bank_transfer" | "mercadopago" | "coinbase";
    notes?: string;
  },
  items: Array<{ product_id?: number; product_name: string; product_price: number; quantity: number }>
): Promise<{ orderId: number; orderNumber: string }> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Generate order number: NB + timestamp + random
    const orderNumber = `NB${Date.now().toString(36).toUpperCase()}`;
    const [result] = await conn.execute(
      `INSERT INTO nb_orders
         (project_id, order_number, customer_name, customer_email, customer_phone,
          shipping_address, subtotal, total, payment_method, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId, orderNumber,
        data.customer_name ?? null, data.customer_email ?? null, data.customer_phone ?? null,
        data.shipping_address ?? null, data.subtotal, data.total,
        data.payment_method, data.notes ?? null,
      ]
    );
    const orderId = (result as { insertId: number }).insertId;
    for (const item of items) {
      const subtotal = item.product_price * item.quantity;
      await conn.execute(
        `INSERT INTO nb_order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id ?? null, item.product_name, item.product_price, item.quantity, subtotal]
      );
    }
    await conn.commit();
    return { orderId, orderNumber };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateOrderPayment(
  orderId: number,
  projectId: number,
  paymentStatus: NbOrder["payment_status"],
  paymentReference?: string
) {
  const pool = getPool();
  await pool.execute(
    `UPDATE nb_orders SET payment_status = ?, payment_reference = ?,
       status = IF(? = 'paid', 'confirmed', status)
     WHERE id = ? AND project_id = ?`,
    [paymentStatus, paymentReference ?? null, paymentStatus, orderId, projectId]
  );
}

export async function updateOrderStatus(orderId: number, projectId: number, status: NbOrder["status"], adminNotes?: string) {
  const pool = getPool();
  const fields = adminNotes !== undefined
    ? "status = ?, admin_notes = ?"
    : "status = ?";
  const values = adminNotes !== undefined
    ? [status, adminNotes, orderId, projectId]
    : [status, orderId, projectId];
  await pool.execute(
    `UPDATE nb_orders SET ${fields} WHERE id = ? AND project_id = ?`,
    values as any
  );
}

// ─── Chat History ─────────────────────────────────────────────────────────────

export async function saveChatMessage(
  userId: number,
  role: "user" | "assistant",
  content: string,
  step: string,
  projectId?: number
) {
  const pool = getPool();
  await pool.execute(
    "INSERT INTO nb_chat_history (user_id, project_id, role, content, step) VALUES (?, ?, ?, ?, ?)",
    [userId, projectId ?? null, role, content, step]
  );
}

export async function getChatHistory(userId: number, projectId?: number, limit = 30) {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(100, Number(limit)));
  const where = projectId ? "user_id = ? AND project_id = ?" : "user_id = ? AND project_id IS NULL";
  const params = projectId ? [userId, projectId] : [userId];
  const [rows] = await pool.execute(
    `SELECT role, content, step FROM nb_chat_history WHERE ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`,
    params
  );
  return (rows as { role: string; content: string; step: string }[]).reverse();
}
