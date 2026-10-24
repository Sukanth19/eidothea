// Browser-side writes. Requests go to /api/*, which Next forwards to FastAPI.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type FastApiDetail = string | { loc?: (string | number)[]; msg: string }[] | undefined;

function messageFrom(detail: FastApiDetail): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(e => {
        const field = e.loc?.[e.loc.length - 1];
        return field && field !== "body" ? `${field}: ${e.msg}` : e.msg;
      })
      .join(" · ");
  }
  return "Something went wrong. The signal is weak.";
}

export async function api<T = unknown>(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFrom(data?.detail));
  return data as T;
}
