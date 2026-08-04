import React from 'react';
import { CheckCircle2, GitBranch, Rocket } from 'lucide-react';
import { APP_VERSION, DEPLOYMENT_HISTORY } from '@/constants/appVersion';
import { cn } from '@/lib/utils';

export default function DeploymentVersionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#003D82]">Deployment Versions</h1>
        <p className="text-slate-600 mt-1">
          Release history for Alpha Bridge production deploys. Current build:&nbsp;
          <span className="font-semibold text-[#0A2540]">{APP_VERSION}</span>
        </p>
      </div>

      <div className="rounded-xl border border-[#D4AF37]/40 bg-[#FFF9E8] px-4 py-3 flex items-center gap-3">
        <Rocket className="h-5 w-5 text-[#D4AF37] shrink-0" />
        <div className="text-sm">
          <div className="font-semibold text-[#0A2540]">Live version</div>
          <div className="text-slate-700">{APP_VERSION} — this admin UI build</div>
        </div>
      </div>

      <div className="space-y-4">
        {DEPLOYMENT_HISTORY.map((release) => {
          const isCurrent = release.version === APP_VERSION;
          return (
            <article
              key={release.version}
              className={cn(
                'rounded-xl border bg-white p-5 shadow-sm',
                isCurrent && 'border-[#003D82] ring-1 ring-[#003D82]/20'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-[#003D82]" />
                    <h2 className="text-lg font-bold text-[#0A2540]">{release.version}</h2>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-700 mt-1">{release.title}</p>
                </div>
                <div className="text-sm text-slate-500">{release.date}</div>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-600 list-disc pl-5">
                {(release.notes || []).map((note) => (
                  <li key={`${release.version}-${note}`}>{note}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
