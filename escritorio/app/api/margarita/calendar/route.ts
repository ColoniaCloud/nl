import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import getPool from "@/lib/db-manu";
import { ensureTables } from "@/app/api/margarita/projects/route";
import { checkAgentAccess } from "@/lib/billing-access";
import { getFirstTeamId, createMargaritaCalendar, createPostTask } from "@/lib/margarita-clickup";
import { decryptToken } from "@/lib/margarita-encrypt";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";
const WP_BASE_URL = process.env.WP_BASE_URL!;

async function getUser(token: string): Promise<{ id: number; roles: string[] } | null> {
  const res = await fetch(`${WP_BASE_URL}/wp-json/nl360/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.ok) {
    const data = await res.json();
    if (data.user?.id) {
      const roles: string[] = Array.isArray(data.roles) ? data.roles : (Array.isArray(data.user?.roles) ? data.user.roles : []);
      return { id: data.user.id, roles };
    }
  }
  const res2 = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res2.ok) return null;
  const data2 = await res2.json();
  return data2.id ? { id: data2.id, roles: Array.isArray(data2.roles) ? data2.roles : [] } : null;
}

// POST /api/margarita/calendar — create ClickUp calendar with all posts
export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    // F3: Verificar acceso al agente por plan
    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();

    const body = await req.json();
    const { strategy_id } = body;

    if (!strategy_id) return NextResponse.json({ error: "strategy_id requerido" }, { status: 400 });

    // Load strategy + brandbook
    const [sRows] = (await pool.execute(
      `SELECT s.*, b.business_name, b.user_id AS owner_id
       FROM mm_strategies s
       JOIN mm_brandbooks b ON b.id = s.brandbook_id
       WHERE s.id = ?`,
      [strategy_id]
    )) as any;

    if (!sRows[0]) return NextResponse.json({ error: "Estrategia no encontrada" }, { status: 404 });

    const strategy = sRows[0];
    if (strategy.owner_id !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    // Load content posts
    const [posts] = (await pool.execute(
      "SELECT * FROM mm_content WHERE strategy_id = ? ORDER BY scheduled_at ASC",
      [strategy_id]
    )) as any;

    if (!posts.length) {
      return NextResponse.json({ error: "No hay posts generados para este plan" }, { status: 400 });
    }

    // Load ClickUp token from user's connected account
    const [cuRows] = (await pool.execute(
      "SELECT access_token FROM mm_social_accounts WHERE user_id = ? AND platform = 'clickup' LIMIT 1",
      [user.id]
    )) as any;

    if (!cuRows[0]?.access_token) {
      await pool.execute(
        "INSERT INTO mm_chat_history (brandbook_id, user_id, role, content, step) VALUES (?, ?, 'assistant', 'Para crear el calendario necesitas conectar tu cuenta de ClickUp.', 'calendar_create')",
        [strategy.brandbook_id, user.id]
      );
      return NextResponse.json({ needs_clickup_connect: true });
    }

    const clickupToken = decryptToken(cuRows[0].access_token);
    if (!clickupToken) {
      await pool.execute(
        "INSERT INTO mm_chat_history (brandbook_id, user_id, role, content, step) VALUES (?, ?, 'assistant', 'Para crear el calendario necesitas conectar tu cuenta de ClickUp.', 'calendar_create')",
        [strategy.brandbook_id, user.id]
      );
      return NextResponse.json({ needs_clickup_connect: true });
    }

    // Get ClickUp workspace
    const teamId = await getFirstTeamId(clickupToken);
    if (!teamId) {
      return NextResponse.json({ error: "No se pudo acceder al workspace de ClickUp" }, { status: 500 });
    }

    // Create calendar structure
    const calendarResult = await createMargaritaCalendar(clickupToken, teamId, strategy.business_name || "Negocio");
    if (!calendarResult) {
      return NextResponse.json({ error: "No se pudo crear el calendario en ClickUp" }, { status: 500 });
    }

    const { listId, url } = calendarResult;

    // Create tasks for each post
    let created = 0;
    let failed = 0;

    for (const post of posts) {
      const taskId = await createPostTask(clickupToken, listId, {
        title: post.title || `Post ${post.platform} - ${post.scheduled_at}`,
        caption: post.caption,
        platform: post.platform,
        post_type: post.post_type,
        hashtags: post.hashtags,
        media_url: post.media_url,
        scheduled_at: post.scheduled_at,
      });

      if (taskId) {
        await pool.execute(
          "UPDATE mm_content SET clickup_task_id = ? WHERE id = ?",
          [taskId, post.id]
        );
        created++;
      } else {
        failed++;
      }
    }

    // Save calendar URL to strategy
    await pool.execute(
      "UPDATE mm_strategies SET clickup_list_id = ?, calendar_url = ? WHERE id = ?",
      [listId, url, strategy_id]
    );

    const chatMessage = `Calendario creado en ClickUp con ${created} tareas.${url ? ` Accede aqui: ${url}` : ""}`;
    await pool.execute(
      "INSERT INTO mm_chat_history (brandbook_id, user_id, role, content, step) VALUES (?, ?, 'assistant', ?, 'complete')",
      [strategy.brandbook_id, user.id, chatMessage]
    );

    return NextResponse.json({
      calendar_url: url,
      clickup_list_id: listId,
      tasks_created: created,
      tasks_failed: failed,
      chat_message: chatMessage,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

// GET /api/margarita/calendar?strategy_id=X
export async function GET(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = await getUser(token);
    if (!user?.id) return NextResponse.json({ error: "Token invalido" }, { status: 401 });

    // F3: Verificar acceso al agente por plan
    const agentCheck = checkAgentAccess(user.roles, "margarita");
    if (!agentCheck.allowed) {
      return Response.json({ ok: false, error: agentCheck.reason }, { status: 403 });
    }

    await ensureTables();
    const pool = getPool();

    const { searchParams } = new URL(req.url);
    const strategyId = searchParams.get("strategy_id");
    if (!strategyId) return NextResponse.json({ error: "strategy_id requerido" }, { status: 400 });

    const [sRows] = (await pool.execute(
      `SELECT s.*, b.user_id AS owner_id FROM mm_strategies s
       JOIN mm_brandbooks b ON b.id = s.brandbook_id
       WHERE s.id = ?`,
      [strategyId]
    )) as any;

    if (!sRows[0] || sRows[0].owner_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [posts] = (await pool.execute(
      `SELECT id, platform, post_type, title, scheduled_at, status, clickup_task_id, media_url
       FROM mm_content WHERE strategy_id = ? ORDER BY scheduled_at ASC`,
      [strategyId]
    )) as any;

    return NextResponse.json({
      calendar_url: sRows[0].calendar_url,
      clickup_list_id: sRows[0].clickup_list_id,
      posts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
