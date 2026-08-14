import { Link } from 'react-router-dom';
import './safety.css';

const TIPS: Array<{ title: string; body: string }> = [
  {
    title: 'Meet in public, well-lit places',
    body: 'Coffee shops, malls, or card shop counters. Bring a friend for high-value trades. Never invite strangers home or go to theirs.',
  },
  {
    title: 'Verify condition on video before paying',
    body: 'For shipped deals, ask for a video of the exact card under strong light — front, back, corners, and surface at an angle. A seller who refuses is telling you something.',
  },
  {
    title: 'Use tracked, insured shipping',
    body: 'Always get a tracking number, and insure anything over $50. Photograph the packaging process. Never mark a package as a "gift" to dodge customs — it voids insurance claims.',
  },
  {
    title: 'Check the seller\'s history',
    body: 'Reviews, member age, and other active listings are on every profile. A brand-new account selling a $500 slab at half market price is a red flag, not a deal.',
  },
  {
    title: 'Verify graded slabs with the grader',
    body: 'PSA, BGS, and CGC all offer free cert-number lookups. Confirm the cert matches the card and photos before money moves.',
  },
  {
    title: 'Keep the whole deal in chat',
    body: 'Agree on price, condition, and delivery here — if something goes wrong, the conversation is your record. Be wary of anyone rushing you to another app.',
  },
  {
    title: 'Cash or irreversible payments: hand-to-hand only',
    body: 'Cardpost handles no payments. For remote deals, prefer payment methods with buyer protection; never wire money or send crypto to someone you haven\'t met.',
  },
  {
    title: 'Trust your gut — and report',
    body: 'Pressure tactics, sob stories, too-good prices, refusing photos: walk away and report the listing or user. Reports are anonymous.',
  },
];

export function SafeTradingPage() {
  return (
    <article className="safety">
      <header className="safety-hero">
        <h1 className="display">
          Trade cards, <span className="spectrum-text">not risks</span>
        </h1>
        <p>
          Cardpost is the venue, not the middleman — every deal is arranged directly between
          collectors. These habits keep the hobby fun.
        </p>
      </header>

      <ol className="safety-list">
        {TIPS.map((tip, i) => (
          <li key={tip.title} className="safety-tip card-surface">
            <span className="safety-num display" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h2>{tip.title}</h2>
              <p>{tip.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <footer className="safety-footer panel">
        <p>
          Something felt off? Use the <strong>Report</strong> link on any listing, profile, or
          message — every report goes to moderators.
        </p>
        <Link to="/" className="btn btn-primary">Back to browsing</Link>
      </footer>
    </article>
  );
}
