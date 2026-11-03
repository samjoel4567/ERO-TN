const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function cardiacRequest(path, method = 'GET', payload) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: { Accept: 'application/json', ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    throw new Error('Cardiac simulation backend could not be reached. Start the FastAPI backend on port 8000, then refresh incidents before retrying a submission.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => `${item.loc?.slice(1).join('.')}: ${item.msg}`).join('; ')
      : data.detail;
    throw new Error(detail || `Cardiac simulation request failed (${response.status}).`);
  }
  return data;
}
