import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../state/AppContext';
import { countBorderlineFlags } from '../../lib/pregrade/estimate';
import { PREGRADE_DISCLAIMER, type PregradeReport } from '../../lib/pregrade/types';
import { PregradeReportView, type ReportViewData } from './PregradeReportView';
import { CAPTURE_SLOTS } from '../../lib/pregrade/types';
import '../../pages/pregrade.css';

/** Rebuild the report view's shape from a stored report. */
export function reportToViewData(r: PregradeReport): ReportViewData {
  const bordersFrom = (ratios: PregradeReport['front']) => ({
    left: ratios.leftRight[0],
    right: ratios.leftRight[1],
    top: ratios.topBottom[0],
    bottom: ratios.topBottom[1],
  });
  return {
    front: {
      ratios: r.front,
      score: r.scoreCentering ?? 0,
      borders: bordersFrom(r.front),
    },
    back: r.back
      ? { ratios: r.back, score: 0, borders: bordersFrom(r.back) }
      : null,
    assessment: r.assessment,
    estimate: {
      base: r.base,
      isCeiling: r.isCeiling,
      band: r.band,
      borderlineFlags: countBorderlineFlags(r.assessment),
      confidence: r.confidence,
      recommendation: r.recommendation,
      notes: r.notes,
    },
  };
}

/**
 * The published pre-grade panel on a listing page: the full report, the
 * capture set so a buyer can check the work, and a dispute path.
 */
export function PregradeListingPanel({
  listingId,
  sellerId,
}: {
  listingId: string;
  sellerId: string;
}) {
  const { client, user } = useApp();
  const navigate = useNavigate();
  const [report, setReport] = useState<PregradeReport | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .getPublishedPregradeReport(listingId)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch(() => {
        // No panel is better than a broken one.
      });
    return () => {
      cancelled = true;
    };
  }, [client, listingId]);

  if (!report) return null;

  const dispute = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const conv = await client.openConversation(listingId);
      navigate(`/chat/${conv.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pgpanel" aria-label="Pre-grade report">
      {!open ? (
        <button type="button" className="pgpanel-toggle panel" onClick={() => setOpen(true)}>
          <span className="mono-label">Pre-grade report</span>
          <span className="pgpanel-sub">
            Seller-published estimate with the measured numbers and the full photo set.
          </span>
          <span className="mono-label pgpanel-open">View →</span>
        </button>
      ) : (
        <>
          <PregradeReportView data={reportToViewData(report)} />
          <div className="pgpanel-extras panel">
            <div className="pgpanel-captures">
              <span className="mono-label">Check the work — full capture set:</span>
              <div className="pgpanel-capture-links">
                {CAPTURE_SLOTS.filter((s) => report.captures[s]).map((slot) => (
                  <a
                    key={slot}
                    href={report.captures[slot]}
                    target="_blank"
                    rel="noreferrer"
                    className="mono-label pgpanel-capture-link"
                  >
                    {slot.replaceAll('_', ' ')}
                  </a>
                ))}
              </div>
            </div>
            {user && user.id !== sellerId && (
              <button type="button" className="btn-ghost-mono pgpanel-dispute" onClick={() => void dispute()} disabled={busy}>
                Dispute this estimate
              </button>
            )}
            <p className="mono-label pgpanel-disclaimer">{PREGRADE_DISCLAIMER}</p>
          </div>
        </>
      )}
    </section>
  );
}
