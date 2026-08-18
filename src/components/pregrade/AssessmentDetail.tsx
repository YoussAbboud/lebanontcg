import { useEffect, useRef } from 'react';
import {
  condenseEdgeFindings,
  displayCornerFinding,
  displaySurfaceFinding,
  type DisplayFinding,
} from '../../lib/pregrade/copy';
import { EDGE_STRIP_RECTS, faceCanonicalCard } from '../../lib/pregrade/assessPrep';
import type { CaptureSlot, DefectAssessment } from '../../lib/pregrade/types';

const CORNER_SLOTS: Array<[CaptureSlot, string]> = [
  ['corner_tl', 'TL'],
  ['corner_tr', 'TR'],
  ['corner_br', 'BR'],
  ['corner_bl', 'BL'],
];

function FindingList({ items }: { items: DisplayFinding[] }) {
  if (items.length === 0) return <p className="pgassess-clean mono-label">Clean</p>;
  return (
    <ul className="pgassess-findings">
      {items.map((f, i) => (
        <li key={i}>
          <span>{f.sentence}</span>
          {f.note && <em>{f.note}</em>}
        </li>
      ))}
    </ul>
  );
}

/**
 * One face's four edge strips, cut from the same canonical warp the
 * assessment analysed — vertical strips are drawn rotated so all four
 * read as thin horizontal bars.
 */
function EdgeStrips({ label, url, flattened }: { label: string; url: string; flattened: boolean }) {
  const refs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const blob = await (await fetch(url)).blob();
      const card = await faceCanonicalCard(blob, flattened);
      if (cancelled || !card) return;
      const full = document.createElement('canvas');
      full.width = card.width;
      full.height = card.height;
      full
        .getContext('2d')!
        .putImageData(new ImageData(new Uint8ClampedArray(card.data), card.width, card.height), 0, 0);
      EDGE_STRIP_RECTS.forEach((r, i) => {
        const canvas = refs.current[i];
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const vertical = r.h > r.w;
        canvas.width = vertical ? r.h : r.w;
        canvas.height = vertical ? r.w : r.h;
        ctx.save();
        if (vertical) {
          ctx.translate(r.h, 0);
          ctx.rotate(Math.PI / 2);
        }
        ctx.drawImage(full, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        ctx.restore();
      });
    })().catch(() => {
      // No previews is better than a broken report.
    });
    return () => {
      cancelled = true;
    };
  }, [url, flattened]);

  return (
    <div className="pgassess-strips">
      <span className="mono-label pgassess-strips-label">{label}</span>
      {EDGE_STRIP_RECTS.map((r, i) => (
        <div key={r.loc} className="pgassess-strip">
          <canvas
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={`${label} ${r.loc} edge strip`}
          />
          <span className="mono-label">{r.loc}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The assessment, shown instead of told: each attribute group leads
 * with the exact photos the model analysed — corner macros, edge
 * strips cut from the flat-on shots, raking-light shots — with the
 * findings condensed underneath.
 */
export function AssessmentDetail({
  assessment: a,
  captures,
  frontFlattened,
  backFlattened,
}: {
  assessment: DefectAssessment;
  captures?: Partial<Record<CaptureSlot, string>>;
  frontFlattened?: boolean;
  backFlattened?: boolean;
}) {
  const c = captures ?? {};
  const cornerThumbs = CORNER_SLOTS.filter(([slot]) => c[slot]);
  const surfaceAssessed = a.surface.confidence !== 'not_assessed';
  const rakes = (['rake_front', 'rake_back'] as const).filter((s) => c[s]);

  return (
    <div className="pgassess">
      <section className="pgassess-group" aria-label="Corner analysis">
        <h3 className="mono-label">Corners</h3>
        {cornerThumbs.length > 0 && (
          <div className="pgassess-thumbs">
            {cornerThumbs.map(([slot, label]) => (
              <figure key={slot} className="pgassess-thumb">
                <img src={c[slot]} alt={`${label} corner macro`} />
                <figcaption className="mono-label">{label}</figcaption>
              </figure>
            ))}
          </div>
        )}
        <FindingList items={a.corners.findings.map(displayCornerFinding)} />
      </section>

      <section className="pgassess-group" aria-label="Edge analysis">
        <h3 className="mono-label">Edges</h3>
        {c.front && <EdgeStrips label="Front" url={c.front} flattened={frontFlattened ?? false} />}
        {c.back && <EdgeStrips label="Back" url={c.back} flattened={backFlattened ?? false} />}
        <FindingList items={condenseEdgeFindings(a.edges.findings)} />
      </section>

      {surfaceAssessed && (
        <section className="pgassess-group" aria-label="Surface analysis">
          <h3 className="mono-label">Surface</h3>
          {rakes.length > 0 && (
            <div className="pgassess-thumbs is-rake">
              {rakes.map((slot) => (
                <figure key={slot} className="pgassess-thumb">
                  <img src={c[slot]} alt={`${slot === 'rake_front' ? 'Front' : 'Back'} raking-light shot`} />
                  <figcaption className="mono-label">
                    {slot === 'rake_front' ? 'Front' : 'Back'}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <FindingList items={a.surface.findings.map(displaySurfaceFinding)} />
        </section>
      )}
    </div>
  );
}
