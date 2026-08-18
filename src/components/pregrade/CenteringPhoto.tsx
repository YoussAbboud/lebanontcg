import type { AxisRatio, DiagramGuides } from '../../lib/pregrade/types';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The measured centering drawn over the actual capture: the flattened
 * card photo with the eight guide lines exactly where the measurement
 * put them (outer = card edge, inner = art frame). Only used for
 * corner-pinned flattened captures — there the frame IS the card, so
 * the normalised guide positions land truthfully on the photo.
 */
export function CenteringPhoto({
  src,
  face,
  guides,
  leftRight,
  topBottom,
}: {
  src: string;
  face: 'front' | 'back';
  guides: DiagramGuides;
  leftRight: AxisRatio;
  topBottom: AxisRatio;
}) {
  const lines: Array<{ key: keyof DiagramGuides; axis: 'v' | 'h'; outer: boolean }> = [
    { key: 'outL', axis: 'v', outer: true },
    { key: 'outR', axis: 'v', outer: true },
    { key: 'outT', axis: 'h', outer: true },
    { key: 'outB', axis: 'h', outer: true },
    { key: 'inL', axis: 'v', outer: false },
    { key: 'inR', axis: 'v', outer: false },
    { key: 'inT', axis: 'h', outer: false },
    { key: 'inB', axis: 'h', outer: false },
  ];
  return (
    <div
      className="cphoto"
      role="img"
      aria-label={`${face === 'front' ? 'Front' : 'Back'} centering ${leftRight[0]}/${leftRight[1]} left-right, ${topBottom[0]}/${topBottom[1]} top-bottom — measured lines over the photo`}
    >
      <img src={src} alt="" className="cphoto-img" />
      {lines.map(({ key, axis, outer }) => (
        <span
          key={key}
          className={`cphoto-line is-${axis} ${outer ? 'is-outer' : 'is-inner'}`}
          style={
            axis === 'v'
              ? { left: `${clamp01(guides[key]) * 100}%` }
              : { top: `${clamp01(guides[key]) * 100}%` }
          }
        />
      ))}
    </div>
  );
}
