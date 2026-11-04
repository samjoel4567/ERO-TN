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
  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error('The cardiac API response was incomplete. Refresh resources and retry.');
  }
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => `${item.loc?.slice(1).join('.')}: ${item.msg}`).join('; ')
      : data.detail;
    throw new Error(detail || `Cardiac simulation request failed (${response.status}).`);
  }
  return data;
}

export async function loadCardiacCatalog(at) {
  const query = at ? `?at=${encodeURIComponent(at)}` : '';
  const data = await cardiacRequest(`/cardiac-arrest/catalog${query}`);
  if (!Array.isArray(data.aeds) || !Array.isArray(data.ambulances) || !data.summary) {
    throw new Error('The cardiac resource catalogue is invalid. Restart the backend to load the expanded network.');
  }
  return data;
}
