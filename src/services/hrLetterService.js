const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  try {
    const raw = localStorage.getItem('alpha_supabase_auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch {
    return null;
  }
}

async function letterApi(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/hr/letters${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export const hrLetterService = {
  listPeople: (q) => letterApi(`/people${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  listTemplates: (letterType) =>
    letterApi(`/templates${letterType ? `?letter_type=${letterType}` : ''}`),
  createTemplate: (body) => letterApi('/templates', { method: 'POST', body: JSON.stringify(body) }),
  updateTemplate: (id, body) => letterApi(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTemplate: (id) => letterApi(`/templates/${id}`, { method: 'DELETE' }),
  preview: (body) => letterApi('/preview', { method: 'POST', body: JSON.stringify(body) }),
  send: (body) => letterApi('/send', { method: 'POST', body: JSON.stringify(body) }),
  history: (letterType) =>
    letterApi(`/history${letterType ? `?letter_type=${letterType}` : ''}`),
};

export const LETTER_TYPES = {
  leave_of_absence: { label: 'Leave of Absence', path: '/admin/hr/letters/leave' },
  permission: { label: 'Permission', path: '/admin/hr/letters/permission' },
  employment_letter: { label: 'Employment Letter', path: '/admin/hr/letters/employment' },
  attestation_of_work: { label: 'Attestation of Work', path: '/admin/hr/letters/attestation' },
};

export default hrLetterService;
