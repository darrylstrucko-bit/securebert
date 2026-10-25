// A raw `await res.json()` throws a raw SyntaxError ("Unexpected token '<', "<!DOCTYPE
// "... is not valid JSON") whenever the response body isn't JSON -- most commonly a
// platform-level HTML timeout/error page (e.g. Vercel's own 504 page) standing in for
// what should have been our route's JSON response. That raw error was leaking straight
// to the UI. This wraps the parse so a non-JSON body becomes one clear, actionable
// message instead.
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const raw = await res.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(
      res.ok
        ? "Server returned an unexpected (non-JSON) response. Please try again."
        : `Server took too long to respond or failed (HTTP ${res.status}). Please try again.`
    );
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Request failed (HTTP ${res.status}).`;
    throw new Error(message);
  }
  return data as T;
}
