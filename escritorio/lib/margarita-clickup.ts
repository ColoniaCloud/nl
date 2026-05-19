const BASE = "https://api.clickup.com/api/v2";

function headers(userToken: string) {
  return {
    Authorization: userToken,
    "Content-Type": "application/json",
  };
}

export async function getFirstTeamId(userToken: string): Promise<string | null> {
  const res = await fetch(`${BASE}/team`, { headers: headers(userToken) });
  if (!res.ok) return null;
  const data = await res.json();
  return data.teams?.[0]?.id ?? null;
}

export async function createMargaritaCalendar(
  userToken: string,
  teamId: string,
  businessName: string
): Promise<{ listId: string; url: string } | null> {
  // Create space
  const spaceRes = await fetch(`${BASE}/team/${teamId}/space`, {
    method: "POST",
    headers: headers(userToken),
    body: JSON.stringify({
      name: `Margarita Mkt — ${businessName}`,
      multiple_assignees: false,
    }),
  });
  if (!spaceRes.ok) return null;
  const space = await spaceRes.json();

  // Create folder
  const folderRes = await fetch(`${BASE}/space/${space.id}/folder`, {
    method: "POST",
    headers: headers(userToken),
    body: JSON.stringify({ name: "Calendario de Contenido" }),
  });
  if (!folderRes.ok) return null;
  const folder = await folderRes.json();

  // Create list
  const listRes = await fetch(`${BASE}/folder/${folder.id}/list`, {
    method: "POST",
    headers: headers(userToken),
    body: JSON.stringify({ name: "Posts" }),
  });
  if (!listRes.ok) return null;
  const list = await listRes.json();

  return {
    listId: list.id,
    url: `https://app.clickup.com/t/${list.id}`,
  };
}

export async function createPostTask(
  userToken: string,
  listId: string,
  post: {
    title: string;
    caption: string;
    platform: string;
    post_type: string;
    hashtags?: string;
    media_url?: string;
    scheduled_at: string;
  }
): Promise<string | null> {
  const dueDate = new Date(post.scheduled_at).getTime();
  const description = [
    `**Plataforma:** ${post.platform}`,
    `**Tipo:** ${post.post_type}`,
    "",
    "**Caption:**",
    post.caption,
    post.hashtags ? `\n**Hashtags:** ${post.hashtags}` : "",
    post.media_url ? `\n**Imagen:** ${post.media_url}` : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const res = await fetch(`${BASE}/list/${listId}/task`, {
    method: "POST",
    headers: headers(userToken),
    body: JSON.stringify({
      name: post.title,
      description,
      due_date: dueDate,
      due_date_time: true,
      status: "Open",
    }),
  });
  if (!res.ok) return null;
  const task = await res.json();
  return task.id ?? null;
}

export async function getTaskStatus(userToken: string, taskId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/task/${taskId}`, { headers: headers(userToken) });
  if (!res.ok) return null;
  const task = await res.json();
  return task.status?.status ?? null;
}
