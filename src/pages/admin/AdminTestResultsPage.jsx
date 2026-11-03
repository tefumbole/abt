import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api';

function authHeaders() {
  try {
    const parsed = JSON.parse(localStorage.getItem('alpha_supabase_auth') || '{}');
    const token = parsed?.access_token || parsed?.currentSession?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export function AdminTestResultsPage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/system-test/reports`, { headers: authHeaders() })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load results');
        setReports(json.reports || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-[#003D82]">System test results</h1>
      <p className="text-gray-600 mb-4 text-sm">
        Secretary submissions from{' '}
        <a className="text-[#003D82] underline" href="/system-test" target="_blank" rel="noreferrer">
          /system-test
        </a>
        .
      </p>
      {error && <p className="text-red-700">{error}</p>}
      <ul className="bg-white rounded-xl border divide-y">
        {reports.map((report) => (
          <li key={report.id} className="p-4">
            <Link className="text-[#003D82] font-semibold text-lg" to={`/admin/help/results/${report.id}`}>
              {report.tester_name}
            </Link>
            <p className="text-sm text-gray-600">
              {report.tester_phone} · works {report.counts?.works ?? 0} · does not work {report.counts?.fails ?? 0} · not tested {report.counts?.skipped ?? 0}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(report.modules || []).filter((mod) => mod.fails > 0).map((mod) => (
                <span key={mod.id} className="text-xs font-semibold rounded-full bg-rose-50 text-rose-700 px-2 py-0.5">
                  {mod.label}: {mod.fails} failed
                </span>
              ))}
            </div>
          </li>
        ))}
        {!reports.length && !error && <li className="p-4 text-gray-600">No finished tests yet.</li>}
      </ul>
    </div>
  );
}

export function AdminTestResultDetailPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/system-test/reports/${id}`, { headers: authHeaders() })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not open this result');
        setReport(json.report);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <div className="p-4 sm:p-6">
      <Link className="text-sm text-[#003D82] underline" to="/admin/help/results">Back to results</Link>
      {error && <p className="text-red-700 mt-3">{error}</p>}
      {report && (
        <article className="mt-3 bg-white rounded-xl border p-4 sm:p-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#003D82]">{report.tester_name}</h1>
          <p className="text-gray-600">{report.tester_phone}</p>
          <p className="mt-2 text-sm">
            Works {report.counts?.works}. Does not work {report.counts?.fails}. Not tested {report.counts?.skipped}.
          </p>
          {report.summary && <p className="mt-3"><strong>Note:</strong> {report.summary}</p>}
          <div className="mt-4 grid sm:grid-cols-2 gap-2">
            {(report.modules || []).map((mod) => (
              <div key={mod.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-semibold text-[#003D82]">{mod.label}</p>
                <p>Works {mod.works} · Failed {mod.fails} · Skipped {mod.skipped}</p>
              </div>
            ))}
          </div>
          <ol className="mt-4 space-y-3">
            {(report.rows || []).map((row) => (
              <li key={row.id || row.number} className="border-t pt-3">
                <p className="text-xs uppercase text-[#8a6d1d]">{row.module}</p>
                <p className="font-semibold">{row.number}. {row.label}</p>
                <p className="text-sm">
                  {row.result === 'works' ? 'Works' : row.result === 'fails' ? 'Does not work' : row.result === 'skipped' ? 'Not tested' : 'No answer'}
                </p>
                {row.note && <p className="text-sm text-gray-600">{row.note}</p>}
                {row.screenshot && (
                  <a href={row.screenshot} target="_blank" rel="noreferrer">
                    <img src={row.screenshot} alt="" className="mt-2 max-h-56 rounded-lg border" />
                  </a>
                )}
              </li>
            ))}
          </ol>
        </article>
      )}
    </div>
  );
}
