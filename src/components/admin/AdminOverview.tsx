import type { AdminAction, AdminStats } from '../../lib/types';
import { ADMIN_ACTION_LABELS } from '../../lib/types';
import { relativeTime } from '../../lib/format';
import { handleOf } from './shared';

interface Props {
  stats: AdminStats | null;
  recent: AdminAction[];
  onGo(tab: string): void;
}

function Stat({
  label,
  value,
  note,
  alert = false,
}: {
  label: string;
  value: string | number;
  note?: string;
  /** Draws the eye to the number that means "someone has to act". */
  alert?: boolean;
}) {
  return (
    <div className={`astat${alert ? ' astat-alert' : ''}`}>
      <p className="mono-label astat-k">{label}</p>
      <p className="display astat-v">{value}</p>
      <p className="astat-note">{note ?? ' '}</p>
    </div>
  );
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

export function AdminOverview({ stats, recent, onGo }: Props) {
  if (!stats) {
    return (
      <div className="astats">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="astat skeleton" style={{ height: 108 }} />
        ))}
      </div>
    );
  }

  const openWork = stats.reportsOpen + stats.reportsReviewing;

  return (
    <div className="aoverview">
      {openWork > 0 && (
        <button type="button" className="aqueue-cta" onClick={() => onGo('reports')}>
          <span className="mono-label">Waiting on you</span>
          <span className="display aqueue-n">{openWork}</span>
          <span className="aqueue-go mono-label">Open the queue →</span>
        </button>
      )}

      <div className="astats">
        <Stat
          label="Open reports"
          value={stats.reportsOpen}
          note={`${stats.reportsReviewing} in review`}
          alert={stats.reportsOpen > 0}
        />
        <Stat label="Accounts" value={stats.users} note={`+${stats.usersNew7d} this week`} />
        <Stat
          label="Suspended"
          value={stats.suspended}
          note={`${stats.admins} admin${stats.admins === 1 ? '' : 's'}`}
          alert={stats.suspended > 0}
        />
        <Stat
          label="Active listings"
          value={stats.listingsActive}
          note={`+${stats.listingsNew7d} this week`}
        />
        <Stat
          label="Live auctions"
          value={stats.auctionsLive}
          note={`${stats.bids24h} bids in 24h`}
        />
        <Stat
          label="Sold"
          value={stats.listingsSold}
          note={`${stats.listingsReserved} reserved`}
        />
        <Stat
          label="Removed"
          value={stats.listingsRemoved}
          note={`${stats.reviews} reviews written`}
        />
        <Stat label="Messages 24h" value={stats.messages24h} note="Chat is the transaction layer" />
        <Stat
          label="Listed value"
          value={money(stats.gmvListedActive)}
          note="Asking prices, live inventory"
        />
        <Stat
          label="Sold value"
          value={money(stats.valueSold)}
          note="Asking prices — nothing is paid here"
        />
      </div>

      <section className="apanel">
        <div className="apanel-head">
          <h2 className="display">Recent moderation</h2>
          <button type="button" className="btn-ghost-mono" onClick={() => onGo('audit')}>
            Full log →
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="aempty">No admin actions yet. Everything you do here lands in this log.</p>
        ) : (
          <ul className="afeed">
            {recent.slice(0, 6).map((a) => (
              <li key={a.id} className="afeed-row">
                <span className="mono-label afeed-kind">{ADMIN_ACTION_LABELS[a.kind]}</span>
                <span className="afeed-who">{handleOf(a.actor)}</span>
                {a.reason && <span className="afeed-reason">“{a.reason}”</span>}
                <span className="mono-label afeed-when">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
