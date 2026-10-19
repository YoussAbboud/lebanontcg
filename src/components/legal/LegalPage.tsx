import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_EFFECTIVE_DATE } from '../../lib/site';
import './legal.css';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Long-form legal text: a table of contents, numbered sections, and
    plain language throughout. */
export function LegalPage({
  eyebrow,
  title,
  lede,
  sections,
  sibling,
}: {
  eyebrow: string;
  title: string;
  lede: ReactNode;
  sections: LegalSection[];
  sibling: { to: string; label: string };
}) {
  const effective = new Date(LEGAL_EFFECTIVE_DATE).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <article className="legal">
      <header className="legal-head">
        <div className="mono-label legal-eyebrow">{eyebrow}</div>
        <h1 className="display legal-title">{title}</h1>
        <p className="legal-lede">{lede}</p>
        <p className="mono-label legal-date">
          Effective {effective} · <Link to={sibling.to}>{sibling.label}</Link>
        </p>
      </header>

      <nav className="legal-toc panel" aria-label="Contents">
        <div className="mono-label">Contents</div>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="legal-body">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="legal-section">
            <h2>
              <span className="mono-value legal-num">{String(i + 1).padStart(2, '0')}</span>
              {s.title}
            </h2>
            {s.body}
          </section>
        ))}
      </div>
    </article>
  );
}
