"""Generate the LebanonTCG cursor artwork (open hand + closed fist).

Shapes are traced as polygons on a 32x32 grid, painted white with a black
outline so they read on both the near-black ground and light surfaces.
Emits SVG; rasterize.mjs turns each into a 32px PNG (Safari has no SVG
cursor support, so the shipped asset is a PNG).
"""
import pathlib

OUT = pathlib.Path(__file__).parent

# --- open hand: fingers up, thumb out to the left -------------------------
HAND = [
    (10.0, 27.0),   # wrist, bottom-left
    (6.6, 23.0),
    (5.0, 18.6),    # heel of the palm
    (4.0, 15.4),    # thumb, out to the left
    (4.6, 13.4),
    (6.4, 13.2),
    (8.0, 15.0),    # thumb rejoins the palm
    (8.0, 7.0),     # index finger, left edge
    (8.6, 5.2),
    (10.2, 5.0),
    (11.0, 6.6),
    (11.2, 9.2),    # valley between index and middle
    (12.2, 6.2),    # middle finger (the tallest)
    (13.0, 4.4),
    (14.6, 4.4),
    (15.4, 6.2),
    (15.6, 9.6),    # valley
    (16.6, 6.8),    # ring finger
    (17.4, 5.2),
    (19.0, 5.4),
    (19.7, 7.2),
    (19.9, 10.4),   # valley
    (21.0, 8.6),    # little finger
    (22.0, 7.4),
    (23.4, 7.8),
    (23.9, 9.6),
    (24.6, 15.0),   # outside edge of the palm
    (24.4, 20.0),
    (22.6, 24.4),
    (20.4, 27.2),   # wrist, bottom-right
]

# Creases between the fingers, drawn as short strokes.
HAND_CREASES = [
    ((11.2, 9.6), (11.2, 13.4)),
    ((15.6, 10.0), (15.6, 13.8)),
    ((19.9, 10.8), (19.9, 14.2)),
]

# --- closed fist: the pressed state ---------------------------------------
FIST = [
    (10.4, 26.6),
    (7.4, 23.4),
    (6.0, 19.0),
    (6.2, 15.6),
    (4.8, 14.0),    # thumb knuckle, sticking out left
    (5.2, 12.2),
    (7.2, 11.8),
    (9.2, 13.0),
    (9.6, 11.4),    # knuckles across the top
    (11.4, 10.4),
    (13.2, 11.2),
    (13.8, 10.2),
    (15.6, 9.4),
    (17.4, 10.2),
    (18.2, 10.4),
    (19.8, 10.0),
    (21.6, 11.0),
    (23.4, 12.8),
    (24.6, 16.0),
    (24.4, 20.4),
    (22.6, 24.2),
    (20.2, 26.8),
]

# Curled-finger creases on the fist.
FIST_CREASES = [
    ((13.3, 11.6), (13.3, 14.6)),
    ((17.6, 10.8), (17.6, 14.0)),
    ((21.2, 12.2), (21.2, 15.2)),
    ((9.0, 15.6), (12.0, 15.0)),   # thumb fold
]


def poly(points):
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in points)


def svg(points, creases):
    lines = "\n".join(
        f'    <line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" />'
        for a, b in creases
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <g fill="#fff" stroke="#000" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="{poly(points)}" />
  </g>
  <g stroke="#000" stroke-width="1.3" stroke-linecap="round" fill="none">
{lines}
  </g>
</svg>
"""


(OUT / "cursor-hand.svg").write_text(svg(HAND, HAND_CREASES))
(OUT / "cursor-fist.svg").write_text(svg(FIST, FIST_CREASES))
print("wrote cursor-hand.svg, cursor-fist.svg")
