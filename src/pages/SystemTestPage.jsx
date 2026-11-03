import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { COMPANY_NAME } from '@/constants/branding';
import { PAGE_SIZE } from '@/config/systemTestCatalog';

const API = import.meta.env.VITE_API_URL || '/api';
const STORE = 'alpha-system-test';

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}');
  } catch {
    return {};
  }
}

function writeStore(patch) {
  const next = { ...readStore(), ...patch };
  localStorage.setItem(STORE, JSON.stringify(next));
  return next;
}

async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch(`${API}/system-test${path}`, {
    method,
    headers: form ? undefined : { 'Content-Type': 'application/json' },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Could not save the test.');
  return json;
}

function ScreenshotBox({ token, checkId, value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sendFile(file) {
    if (!file || !token) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('token', token);
      form.append('checkId', checkId);
      const json = await api('/screenshot', { method: 'POST', form });
      onChange(json.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onPaste(event) {
    const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    event.preventDefault();
    const file = item.getAsFile();
    if (file) sendFile(file);
  }

  return (
    <div
      className="mt-3 rounded-xl border border-dashed border-[#D4AF37] bg-[#fffaf0] p-3"
      onPaste={onPaste}
      tabIndex={0}
    >
      <p className="text-sm font-semibold text-[#003D82] mb-2">Screenshot (paste, drop, or upload)</p>
      {value ? (
        <div className="relative">
          <img src={value} alt="Screenshot" className="w-full max-h-56 object-contain rounded-lg bg-white" />
          <button
            type="button"
            className="absolute top-2 right-2 rounded-full bg-white/90 p-1 shadow"
            onClick={() => onChange('')}
            aria-label="Remove screenshot"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="w-full min-h-[88px] rounded-lg bg-white text-[#003D82] text-sm font-medium flex flex-col items-center justify-center gap-1"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) sendFile(file);
          }}
        >
          <ImagePlus className="w-6 h-6 text-[#D4AF37]" />
          {busy ? 'Uploading…' : 'Tap to add, or paste a picture'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) sendFile(file);
          event.target.value = '';
        }}
      />
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}

export default function SystemTestPage() {
  const stored = readStore();
  const [meta, setMeta] = useState(null);
  const [phase, setPhase] = useState(stored.token ? 'test' : 'start');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(stored.name || '');
  const [phone, setPhone] = useState(stored.phone || '');
  const [token, setToken] = useState(stored.token || '');
  const [checks, setChecks] = useState(stored.checks || {});
  const [notes, setNotes] = useState(stored.notes || {});
  const [screenshots, setScreenshots] = useState(stored.screenshots || {});
  const [summary, setSummary] = useState(stored.summary || '');
  const [page, setPage] = useState(stored.page || 1);
  const [report, setReport] = useState(null);

  const pageCount = meta?.pages?.length || 1;
  const current = meta?.pages?.[page - 1];

  const progress = useMemo(() => {
    const total = meta?.total || 0;
    const answered = Object.values(checks).filter((value) => ['works', 'fails', 'skipped'].includes(value)).length;
    return { total, answered, percent: total ? Math.round((answered / total) * 100) : 0 };
  }, [checks, meta]);

  useEffect(() => {
    writeStore({ name, phone, token, checks, notes, screenshots, summary, page });
  }, [name, phone, token, checks, notes, screenshots, summary, page]);

  useEffect(() => {
    api('/catalog').then(setMeta).catch((err) => setError(err.message));
  }, []);

  async function persist(nextPage = page) {
    if (!token) return;
    await api('/save', {
      method: 'POST',
      body: { token, checks, notes, screenshots, summary, page: nextPage },
    });
  }

  async function onStart(event, retrieve = false) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const json = await api(retrieve ? '/retrieve' : '/start', {
        method: 'POST',
        body: { tester_name: name, tester_phone: phone },
      });
      setToken(json.token);
      setMeta((prev) => ({ ...(prev || {}), pages: json.pages, total: json.total }));
      if (json.draft) {
        setName(json.draft.tester_name || name);
        setChecks(json.draft.checks || {});
        setNotes(json.draft.notes || {});
        setScreenshots(json.draft.screenshots || {});
        setSummary(json.draft.summary || '');
        setPage(json.draft.page || 1);
      }
      setPhase('test');
      setNotice(retrieve ? 'Saved answers loaded.' : 'Test started. Work through each module.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function goPage(next) {
    const safe = Math.min(Math.max(1, next), pageCount);
    setPage(safe);
    setBusy(true);
    try {
      await persist(safe);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function onSubmit() {
    setBusy(true);
    setError('');
    try {
      await persist(page);
      const json = await api('/submit', {
        method: 'POST',
        body: { token, checks, notes, screenshots, summary },
      });
      setReport(json.report);
      setPhase('thanks');
      localStorage.removeItem(STORE);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const fails = (report?.rows || []).filter((row) => row.result === 'fails');

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fb] text-[#1c2430]">
      <header className="sticky top-0 z-40 bg-[#003D82] h-14 sm:h-16 flex items-center px-3 sm:px-4 shadow">
        <Link to="/" aria-label={COMPANY_NAME}>
          <BrandLogo variant="onDark" className="h-9 sm:h-10 w-auto" alt={COMPANY_NAME} />
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28">
        <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#8a6d1d]">Secretary system test</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#003D82] mt-1">Test every module</h1>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          Mark Works, Does not work, or Not tested. Paste a screenshot when something fails. Submit when you are done.
        </p>
        {error && <p className="mb-3 rounded-xl bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</p>}
        {notice && <p className="mb-3 rounded-xl bg-amber-50 text-amber-900 px-4 py-3 text-sm">{notice}</p>}

        {phase === 'start' && (
          <div className="grid gap-4">
            <form className="rounded-2xl bg-white border p-4 sm:p-5 shadow-sm" onSubmit={(event) => onStart(event, false)}>
              <h2 className="text-xl font-bold text-[#003D82] mb-3">Start a new test</h2>
              <label className="block text-sm font-semibold mb-1">Your name</label>
              <input
                className="w-full rounded-xl border px-3 py-3 text-base"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
              <label className="block text-sm font-semibold mt-3 mb-1">WhatsApp number</label>
              <input
                className="w-full rounded-xl border px-3 py-3 text-base"
                inputMode="tel"
                placeholder="+250794006160"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
              <button disabled={busy} className="mt-4 w-full min-h-12 rounded-full bg-[#003D82] text-white font-semibold">
                Start testing
              </button>
            </form>
            <form className="rounded-2xl bg-white border p-4 sm:p-5 shadow-sm" onSubmit={(event) => onStart(event, true)}>
              <h2 className="text-xl font-bold text-[#003D82] mb-2">Continue a saved test</h2>
              <p className="text-sm text-gray-600 mb-3">Use the same WhatsApp number.</p>
              <input
                className="w-full rounded-xl border px-3 py-3 text-base"
                inputMode="tel"
                placeholder="+250794006160"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
              <button disabled={busy} className="mt-4 w-full min-h-12 rounded-full border border-[#003D82] text-[#003D82] font-semibold">
                Retrieve saved answers
              </button>
            </form>
          </div>
        )}

        {phase === 'test' && current && (
          <>
            <div className="sticky top-14 sm:top-16 z-30 mb-4 rounded-2xl border bg-white/95 backdrop-blur px-4 py-3 shadow">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#003D82] leading-none">{progress.percent}%</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">{progress.answered} of {progress.total} answered</p>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[#003D82] text-right">
                  {current.title}<br />Page {page} of {pageCount}
                </p>
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#003D82] to-[#D4AF37]" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>

            {current.checks.map((item, index) => {
              const number = (page - 1) * PAGE_SIZE + index + 1;
              return (
                <article key={item.id} className="mb-4 rounded-2xl bg-white border p-4 sm:p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#8a6d1d]">
                    Check {number} · {item.module}
                  </p>
                  <h2 className="text-lg sm:text-xl font-bold text-[#003D82] mt-1">{item.text}</h2>
                  <ol className="mt-3 space-y-2">
                    {item.steps.map((step, stepIndex) => (
                      <li key={step} className="flex gap-3 border-t border-slate-100 pt-2 first:border-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#003D82] text-white text-sm font-bold">
                          {stepIndex + 1}
                        </span>
                        <span className="text-sm sm:text-base leading-snug">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      ['works', 'Works', 'bg-emerald-600'],
                      ['fails', 'Does not work', 'bg-rose-600'],
                      ['skipped', 'Not tested', 'bg-slate-500'],
                    ].map(([value, label, active]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setChecks((prev) => ({ ...prev, [item.id]: value }))}
                        className={`min-h-12 rounded-full px-3 py-2 text-sm font-semibold border ${
                          checks[item.id] === value
                            ? `${active} text-white border-transparent`
                            : 'bg-white border-slate-200 text-[#003D82]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {checks[item.id] === 'fails' && (
                    <>
                      <textarea
                        className="mt-3 w-full rounded-xl border px-3 py-2 text-base"
                        rows={3}
                        placeholder="What went wrong?"
                        value={notes[item.id] || ''}
                        onChange={(event) => setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      />
                      <ScreenshotBox
                        token={token}
                        checkId={item.id}
                        value={screenshots[item.id]}
                        onChange={(url) => setScreenshots((prev) => ({ ...prev, [item.id]: url }))}
                      />
                    </>
                  )}
                </article>
              );
            })}

            <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur px-3 py-3 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:mt-2">
              <div className="max-w-3xl mx-auto flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || busy}
                  className="flex-1 min-h-12 rounded-full border font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-40"
                  onClick={() => goPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                {page < pageCount ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="flex-[2] min-h-12 rounded-full bg-[#003D82] text-white font-semibold inline-flex items-center justify-center gap-1"
                    onClick={() => goPage(page + 1)}
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className="flex-[2] min-h-12 rounded-full bg-[#D4AF37] text-[#003D82] font-bold"
                    onClick={onSubmit}
                  >
                    Submit results
                  </button>
                )}
              </div>
              {page === pageCount && (
                <textarea
                  className="mt-2 w-full max-w-3xl mx-auto rounded-xl border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Overall note for the owner (optional)"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                />
              )}
            </div>
          </>
        )}

        {phase === 'thanks' && report && (
          <div className="rounded-2xl bg-white border p-5 shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            <h2 className="text-2xl font-bold text-[#003D82] mt-2">Submitted</h2>
            <p className="mt-2 text-sm">
              Works {report.counts.works}. Does not work {report.counts.fails}. Not tested {report.counts.skipped}.
            </p>
            <h3 className="mt-4 font-semibold flex items-center gap-2"><Camera className="w-4 h-4" /> What does not work</h3>
            {fails.length === 0 && <p className="text-sm text-gray-600">Nothing was marked as not working.</p>}
            <ul className="mt-2 space-y-2">
              {fails.map((row) => (
                <li key={row.id} className="text-sm border-t pt-2">
                  <p className="font-semibold">{row.module}: {row.text}</p>
                  {row.note && <p className="text-gray-600">{row.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
