const WA_URL    = process.env.WA_SERVICE_URL!;
const WA_SECRET = process.env.WA_SERVICE_SECRET!;

export async function waFetch(
  userId: string,
  path: string,
  init: RequestInit = {}
): Promise<any> {
  const res = await fetch(`${WA_URL}/sessions/${userId}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-service-secret": WA_SECRET,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "Unknown error");
    const e = new Error(`WA service ${res.status}: ${err}`) as any;
    e.status = 502;
    throw e;
  }

  return res.json();
}
