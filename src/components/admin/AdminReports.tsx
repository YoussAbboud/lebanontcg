import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Report, ReportStatus } from '../../lib/types';
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from '../../lib/types';
import { relativeTime } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../state/ToastContext';
import { ReasonPrompt } from './ReasonPrompt';
import { Chip, handleOf } from './shared';

const FILTERS: Array<{ key: ReportStatus | 'all'; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'all', label: 'All' },
];

const STATUS_TONE: Record<ReportStatus, 'plain' | 'acid' | 'danger' | 'warn'> = {
  open: 'danger',
  reviewing: 'warn',
  resolved: 'acid',
  dismissed: 'plain',
};

interface Pending {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  requireReason: boolean;
  reasonLabel: string;
  destructive: boolean;
  run(reason: string): Promise<void>;
}

export function AdminReports({ onChanged }: { onChanged(): void }) {
  const { client } = useApp();
  const toast = useToast();
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setReports(await client.adminListReports(filter));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const after = async (message: string) => {
    toast(message);
    onChanged();
    await load();
  };

  const setStatus = async (report: Report, status: ReportStatus) => {
    await client.adminResolveReport(report.id, status, '');
    await after(`Marked ${REPORT_STATUS_LABELS[status].toLowerCase()}`);
  };

  const settle = (report: Report, status: Extract<ReportStatus, 'resolved' | 'dismissed'>) =>
    setPending({
      title: status === 'resolved' ? 'Resolve report' : 'Dismiss report',
      body:
        status === 'resolved'
          ? 'Close this report as actioned. The note is for the next moderator, not the reporter.'
          : 'Close this report with no action taken.',
      confirmLabel: status === 'resolved' ? 'Resolve' : 'Dismiss',
      requireReason: false,
      reasonLabel: 'Note',
      destructive: false,
      run: async (note) => {
        await client.adminResolveReport(report.id, status, note);
        await after(status === 'resolved' ? 'Report resolved' : 'Report dismissed');
      },
    });

  const removeListing = (report: Report) =>
    setPending({
      title: 'Remove this listing',
      body: (
        <>
          <strong>{report.subject?.label}</strong> leaves browse immediately and everyone in its
          conversations is told a moderator removed it. It can be restored later.
        </>
      ),
      confirmLabel: 'Remove listing',
      requireReason: true,
      reasonLabel: 'Reason',
      destructive: true,
      run: async (reason) => {
        await client.adminSetListingStatus(report.targetId, 'removed', reason);
        await client.adminResolveReport(report.id, 'resolved', `Listing removed: ${reason}`);
        await after('Listing removed');
      },
    });

  const suspendUser = (report: Report, userId: string, label: string) =>
    setPending({
      title: `Suspend ${label}`,
      body: 'They keep their history and can still read, but cannot list, message or bid until this is lifted.',
      confirmLabel: 'Suspend account',
      requireReason: true,
      reasonLabel: 'Reason',
      destructive: true,
      run: async (reason) => {
        await client.adminSetSuspended(userId, true, reason);
        await client.adminResolveReport(report.id, 'resolved', `Account suspended: ${reason}`);
        await after('Account suspended');
      },
    });

  if (state === 'loading') {
    return <div className="skeleton" style={{ height: 320 }} />;
  }
  if (state === 'error') {
    return (
      <div className="empty-dashed">
        <h3>Couldn&apos;t load the queue</h3>
        <p>The report queue is admin-only — if you were just demoted, that&apos;s why.</p>
        <button className="btn-outline" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="asection">
      <div className="afilters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="pill"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {reports.length === 0 ? (
        <div className="empty-dashed">
          <h3>Nothing here</h3>
          <p>
            {filter === 'open'
              ? 'No open reports. The queue is clear.'
              : `No ${filter === 'all' ? '' : filter} reports.`}
          </p>
        </div>
      ) : (
        <ul className="acards">
          {reports.map((r) => (
            <li key={r.id} className="acard">
              <div className="acard-top">
                <Chip tone={STATUS_TONE[r.status]}>{REPORT_STATUS_LABELS[r.status]}</Chip>
                <Chip>{REPORT_REASON_LABELS[r.reason]}</Chip>
                <Chip>{r.targetType}</Chip>
                <span className="mono-label acard-when">{relativeTime(r.createdAt)}</span>
              </div>

              <div className="acard-subject">
                {r.subject ? (
                  <>
                    {r.subject.href ? (
                      <Link to={r.subject.href} className="acard-link">
                        {r.subject.label}
                      </Link>
                    ) : (
                      <span className="acard-quote">“{r.subject.label}”</span>
                    )}
                    {r.subject.ownerName && (
                      <span className="acard-owner mono-label">by {r.subject.ownerName}</span>
                    )}
                  </>
                ) : (
                  <span className="aperson-missing mono-label">
                    Subject no longer exists — already deleted
                  </span>
                )}
              </div>

              {r.detail && <p className="acard-detail">{r.detail}</p>}

              <p className="mono-label acard-meta">
                Reported by {handleOf(r.reporter)}
                {r.resolvedAt && ` · closed ${relativeTime(r.resolvedAt)}`}
              </p>
              {r.resolutionNote && <p className="acard-note">Note: {r.resolutionNote}</p>}

              <div className="acard-actions">
                {r.status === 'open' && (
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => void setStatus(r, 'reviewing')}
                  >
                    I&apos;m on it
                  </button>
                )}
                {(r.status === 'open' || r.status === 'reviewing') && (
                  <>
                    {r.subject?.kind === 'listing' && (
                      <button
                        type="button"
                        className="btn-outline btn-danger-outline"
                        onClick={() => removeListing(r)}
                      >
                        Remove listing
                      </button>
                    )}
                    {r.subject?.ownerId && (
                      <button
                        type="button"
                        className="btn-outline btn-danger-outline"
                        onClick={() =>
                          suspendUser(r, r.subject!.ownerId!, r.subject!.ownerName ?? 'this user')
                        }
                      >
                        Suspend {r.subject.kind === 'user' ? 'user' : 'owner'}
                      </button>
                    )}
                    <button type="button" className="btn-acid" onClick={() => settle(r, 'resolved')}>
                      Resolve
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => settle(r, 'dismissed')}
                    >
                      Dismiss
                    </button>
                  </>
                )}
                {(r.status === 'resolved' || r.status === 'dismissed') && (
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => void setStatus(r, 'open')}
                  >
                    Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <ReasonPrompt
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          requireReason={pending.requireReason}
          reasonLabel={pending.reasonLabel}
          destructive={pending.destructive}
          onConfirm={pending.run}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
