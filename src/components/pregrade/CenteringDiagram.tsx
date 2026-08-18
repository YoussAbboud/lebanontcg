import type { AxisRatio } from '../../lib/pregrade/types';

export interface DiagramBorders {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Small SVG of the measured card: the inner frame sits where the
 * borders were measured, so an off-centre card LOOKS off-centre.
 */
export function CenteringDiagram({
  borders,
  leftRight,
  topBottom,
}: {
  borders: DiagramBorders;
  leftRight: AxisRatio;
  topBottom: AxisRatio;
}) {
  const W = 100;
  const H = 140;
  // Border budget drawn at a fixed visual scale so thin borders stay visible.
  const bx = borders.left + borders.right;
  const by = borders.top + borders.bottom;
  const budgetX = W * 0.28;
  const budgetY = H * 0.24;
  const l = bx > 0 ? (borders.left / bx) * budgetX : budgetX / 2;
  const t = by > 0 ? (borders.top / by) * budgetY : budgetY / 2;
  return (
    <svg
      className="cdiag"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Centering ${leftRight[0]}/${leftRight[1]} left-right, ${topBottom[0]}/${topBottom[1]} top-bottom`}
    >
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="6" className="cdiag-card" />
      <rect
        x={1 + l}
        y={1 + t}
        width={W - 2 - budgetX}
        height={H - 2 - budgetY}
        rx="3"
        className="cdiag-art"
      />
    </svg>
  );
}
