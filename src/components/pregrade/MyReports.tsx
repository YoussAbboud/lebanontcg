import { useEffect, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { bandLabel } from '../../lib/pregrade/copy';
import { reportToViewData } from './PregradeListingPanel';
import type { PregradeReport } from '../../lib/pregrade/types';

const WEEK_MS = 7 * 24 * 3600 * 1000;

/**
 * The seller's past reports, with the outcome prompt that feeds the
 * calibration loop: any report older than 7 days asks "Did you submit
 * this one? What did it come back as?" — one tap to record the grade,
 * optional cert number.
 */
export function MyReports() {
  const { client, user } = useApp();
  const [reports, setReports] = useState<PregradeReport[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [certs, setCerts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    client
      .listMyPregradeReports()
      .then((r) => {
        if (!cancelled) setReports(r);
      })
      .catch(() => {
        // A missing history list shouldn't block the capture flow.
      });
    return () => {
      cancelled = true;
    };
  }, [client, user]);

  if (reports.length === 0) return null;

  const record = async (report: PregradeReport) => {
    const grade = Number(grades[report.id]);
    if (!Number.isInteger(grade) || grade < 1 || grade > 10) return;
    setSaving(report.id);
    try {
      await client.recordPregradeOutcome(report.id, grade, certs[report.id]?.trim() || undefined);
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? {
                ...r,
                outcome: {
                  actualGrade: grade,
                  certNumber: certs[report.id]?.trim() || null,
                  reportedAt: new Date().toISOString(),
                },
              }
            : r,
        ),
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="pgmine" aria-label="Your pre-grade reports">
      <h2 className="mono-label pgmine-title">Your reports</h2>
      <ul className="pgmine-list">
        {reports.map((r) => {
          const old = Date.now() - Date.parse(r.createdAt) > WEEK_MS;
          const view = reportToViewData(r);
          return (
            <li key={r.id} className="pgmine-row panel">
              <div className="pgmine-main">
                <span className="pgmine-band">{bandLabel(view.estimate)}</span>
                <span className="mono-label pgmine-meta">
                  {new Date(r.createdAt).toLocaleDateString()}
                  {r.published && ' · published'}
                </span>
              </div>
              {r.outcome ? (
                <span className="mono-label pgmine-outcome">
                  Came back PSA {r.outcome.actualGrade}
                  {r.outcome.certNumber ? ` · cert ${r.outcome.certNumber}` : ''}
                </span>
              ) : (
                <div className="pgmine-record">
                  <span className="pgmine-prompt">
                    {old
                      ? 'Did you submit this one? What did it come back as?'
                      : 'Came back already? Record the grade:'}
                  </span>
                  <div className="pgmine-controls">
                    <select
                      className="input"
                      aria-label="Actual grade"
                      value={grades[r.id] ?? ''}
                      onChange={(e) => setGrades((g) => ({ ...g, [r.id]: e.target.value }))}
                    >
                      <option value="">Grade…</option>
                      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((g) => (
                        <option key={g} value={g}>
                          PSA {g}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      placeholder="Cert # (optional)"
                      aria-label="Cert number"
                      value={certs[r.id] ?? ''}
                      onChange={(e) => setCerts((c) => ({ ...c, [r.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={!grades[r.id] || saving === r.id}
                      onClick={() => void record(r)}
                    >
                      {saving === r.id ? 'Saving…' : 'Record'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
