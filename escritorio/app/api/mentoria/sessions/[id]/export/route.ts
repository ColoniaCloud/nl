import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool, ensureTables, getUserId } from "@/lib/db-mentoria";
import { getAgent } from "@/lib/mentoria/agents";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

async function resolveToolLabel(tool: string): Promise<string> {
  const a = await getAgent(tool);
  if (!a) return tool;
  return a.subtitle ? `${a.title} — ${a.subtitle}` : a.title;
}

async function auth(): Promise<{ userId: number } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await getUserId(token);
  if (!userId) return null;
  return { userId };
}

function toMarkdown(
  title: string,
  toolLabel: string,
  updatedAt: string,
  messages: Array<{ role: string; content: string; ts?: string }>
): string {
  const header = [
    `# ${title}`,
    ``,
    `**Herramienta:** ${toolLabel}  `,
    `**Actualizado:** ${updatedAt}`,
    ``,
    `---`,
    ``,
  ].join("\n");
  const body = messages
    .map((m) => {
      const who =
        m.role === "user" ? "Alumno"
        : m.role === "agent" ? "MentorIA"
        : "Sistema";
      return `### ${who}\n\n${m.content}\n`;
    })
    .join("\n");
  return header + body;
}

function safeFilename(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "sesion";
}

// GET /api/mentoria/sessions/[id]/export?format=md|json
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const format = (req.nextUrl.searchParams.get("format") || "md").toLowerCase();
  if (format !== "md" && format !== "json") {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 });
  }

  await ensureTables();
  const pool = getPool();
  const [rows] = (await pool.execute(
    `SELECT id, tool, title, messages, updated_at
       FROM mt_sessions
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, session.userId]
  )) as any[];
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const row = rows[0];

  // Prefer relational source
  const [msgRows] = (await pool.execute(
    `SELECT role, content, ts FROM mt_messages
      WHERE session_id = ? ORDER BY seq ASC`,
    [id]
  )) as any[];

  let messages: Array<{ role: string; content: string; ts?: string }>;
  if (msgRows && msgRows.length > 0) {
    messages = msgRows.map((r: any) => ({
      role: r.role,
      content: r.content,
      ts: r.ts instanceof Date ? r.ts.toISOString() : String(r.ts),
    }));
  } else {
    const raw = typeof row.messages === "string" ? JSON.parse(row.messages) : row.messages;
    messages = (Array.isArray(raw) ? raw : []).map((m: any) => ({
      role: String(m.role || "user"),
      content: String(m.content || ""),
      ts: m.timestamp ? String(m.timestamp) : undefined,
    }));
  }

  const toolLabel = await resolveToolLabel(row.tool);
  const updatedAt =
    row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
  const fname = safeFilename(row.title);

  if (format === "json") {
    const payload = {
      id: row.id,
      tool: row.tool,
      toolLabel,
      title: row.title,
      updatedAt,
      messages,
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}.json"`,
      },
    });
  }

  // Markdown
  const md = toMarkdown(row.title, toolLabel, updatedAt, messages);
  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}.md"`,
    },
  });
}
