"""Convert the supplied Windows cursors into web assets.

Browsers can't be relied on for .cur (Safari ignores it) and no browser
animates .ani, so the shipped assets are PNGs: one per cursor, plus one
per frame for the animated busy cursor. Hotspots come straight out of the
CUR directory entries and are printed for the CSS to use.

Run:  python3 src/assets/cursors/convert.py
Deps: none (stdlib zlib/struct only).
"""
import pathlib
import struct
import sys
import zlib

HERE = pathlib.Path(__file__).parent
SRC = HERE / "source"


# ---------------------------------------------------------------- PNG out
def write_png(path, width, height, rgba):
    """Minimal RGBA8 PNG writer."""
    raw = b"".join(
        b"\x00" + bytes(rgba[y * width * 4 : (y + 1) * width * 4]) for y in range(height)
    )

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


# ------------------------------------------------------------- CUR/ICO in
def decode_image(buf, off, size):
    """One ICONDIRENTRY payload -> (w, h, rgba bytes). Handles the DIB
    forms Windows cursors actually use plus embedded PNG."""
    data = buf[off : off + size]
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        raise SystemExit("embedded PNG frame: not expected in these files")

    (hdr_size, w, h_both, planes, bpp) = struct.unpack_from("<IiiHH", data, 0)
    compression, = struct.unpack_from("<I", data, 16)
    if compression != 0:
        raise SystemExit(f"compressed DIB ({compression}) unsupported")
    h = h_both // 2  # the DIB holds XOR image + AND mask stacked

    n_colors, = struct.unpack_from("<I", data, 32)
    if bpp <= 8 and n_colors == 0:
        n_colors = 1 << bpp
    palette_off = hdr_size
    palette = data[palette_off : palette_off + n_colors * 4]
    xor_off = palette_off + n_colors * 4

    row_bits = w * bpp
    xor_stride = ((row_bits + 31) // 32) * 4
    and_stride = ((w + 31) // 32) * 4
    and_off = xor_off + xor_stride * h

    out = bytearray(w * h * 4)
    for y in range(h):
        src_y = h - 1 - y  # DIBs are bottom-up
        xrow = xor_off + src_y * xor_stride
        arow = and_off + src_y * and_stride
        for x in range(w):
            if bpp == 32:
                b, g, r, a = data[xrow + x * 4 : xrow + x * 4 + 4]
            elif bpp == 24:
                b, g, r = data[xrow + x * 3 : xrow + x * 3 + 3]
                a = 255
            elif bpp == 8:
                idx = data[xrow + x]
                b, g, r, _ = palette[idx * 4 : idx * 4 + 4]
                a = 255
            elif bpp == 4:
                byte = data[xrow + x // 2]
                idx = (byte >> 4) if x % 2 == 0 else (byte & 0x0F)
                b, g, r, _ = palette[idx * 4 : idx * 4 + 4]
                a = 255
            elif bpp == 1:
                byte = data[xrow + x // 8]
                idx = (byte >> (7 - x % 8)) & 1
                b, g, r, _ = palette[idx * 4 : idx * 4 + 4]
                a = 255
            else:
                raise SystemExit(f"unsupported bpp {bpp}")

            # The AND mask wins for non-32bpp images; 32bpp carries alpha,
            # but some cursors still zero it out, so honour the mask when
            # the whole alpha channel is empty (handled by the caller).
            if and_off + and_stride * h <= len(data):
                masked = (data[arow + x // 8] >> (7 - x % 8)) & 1
            else:
                masked = 0
            if bpp != 32 and masked:
                a = 0

            o = (y * w + x) * 4
            out[o : o + 4] = bytes((r, g, b, a))

    if bpp == 32 and not any(out[3::4]):
        # Alpha channel present but empty: fall back to the AND mask.
        for y in range(h):
            src_y = h - 1 - y
            arow = and_off + src_y * and_stride
            for x in range(w):
                masked = (data[arow + x // 8] >> (7 - x % 8)) & 1
                out[(y * w + x) * 4 + 3] = 0 if masked else 255
    return w, h, out


def read_cur(buf):
    """-> list of dicts, one per directory entry, largest last."""
    reserved, kind, count = struct.unpack_from("<HHH", buf, 0)
    if reserved != 0 or kind not in (1, 2):
        raise SystemExit("not an ICO/CUR")
    entries = []
    for i in range(count):
        (w, h, colors, _r, hx, hy, size, off) = struct.unpack_from("<BBBBHHII", buf, 6 + i * 16)
        w = w or 256
        h = h or 256
        entries.append({"w": w, "h": h, "hx": hx, "hy": hy, "size": size, "off": off,
                        "kind": kind})
    return entries


def best(entries, buf):
    """Prefer 32x32 (the size browsers draw a cursor at), and among those
    the richest colour depth — these files carry the same size four times
    over at 32/8/4/1 bpp, and the 1bpp copy is a black-and-white stencil."""
    def bpp(e):
        return struct.unpack_from("<H", buf, e["off"] + 14)[0]

    pool = [e for e in entries if e["w"] == 32] or entries
    return max(pool, key=lambda e: (bpp(e), e["w"]))


# ------------------------------------------------------------------ ANI in
def read_ani(buf):
    if buf[:4] != b"RIFF" or buf[8:12] != b"ACON":
        raise SystemExit("not an ANI")
    pos, end = 12, struct.unpack_from("<I", buf, 4)[0] + 8
    frames, rate_default, rates, seq = [], 10, None, None
    while pos + 8 <= end:
        tag = buf[pos : pos + 4]
        size, = struct.unpack_from("<I", buf, pos + 4)
        body = pos + 8
        if tag == b"anih":
            (_cb, n_frames, n_steps, _w, _h, _bpp, _planes, disp, _flags) = struct.unpack_from(
                "<9I", buf, body
            )
            rate_default = disp
        elif tag == b"rate":
            rates = list(struct.unpack_from(f"<{size // 4}I", buf, body))
        elif tag == b"seq ":
            seq = list(struct.unpack_from(f"<{size // 4}I", buf, body))
        elif tag == b"LIST" and buf[body : body + 4] == b"fram":
            p = body + 4
            while p + 8 <= body + size:
                stag = buf[p : p + 4]
                ssize, = struct.unpack_from("<I", buf, p + 4)
                if stag == b"icon":
                    frames.append(buf[p + 8 : p + 8 + ssize])
                p += 8 + ssize + (ssize & 1)
        pos = body + size + (size & 1)
    return frames, rate_default, rates, seq


# --------------------------------------------------------------------- run
def upscale(w, h, rgba, factor):
    """Nearest-neighbour scale — keeps the pixel-art edges crisp, which is
    what these cursors are; a smooth resampler would just blur them."""
    nw, nh = w * factor // 1, h * factor // 1
    nw, nh = int(round(w * factor)), int(round(h * factor))
    out = bytearray(nw * nh * 4)
    for y in range(nh):
        sy = min(h - 1, int(y * h / nh))
        for x in range(nw):
            sx = min(w - 1, int(x * w / nw))
            so = (sy * w + sx) * 4
            do = (y * nw + x) * 4
            out[do : do + 4] = rgba[so : so + 4]
    return nw, nh, out


def convert_cur(name, out_stem, big=None):
    buf = (SRC / name).read_bytes()
    entries = read_cur(buf)
    e = best(entries, buf)
    w, h, rgba = decode_image(buf, e["off"], e["size"])
    write_png(HERE / f"{out_stem}.png", w, h, rgba)
    print(f"{name}: {len(entries)} sizes {[x['w'] for x in entries]} -> "
          f"{out_stem}.png {w}x{h} hotspot ({e['hx']}, {e['hy']})")
    if big:
        bw, bh, brgba = upscale(w, h, rgba, big / w)
        bx = int(e["hx"] * big / w + 0.5)
        by = int(e["hy"] * big / w + 0.5)
        write_png(HERE / f"{out_stem}-{big}.png", bw, bh, brgba)
        print(f"  + {out_stem}-{big}.png {bw}x{bh} hotspot ({bx}, {by})")
    return e["hx"], e["hy"], w, h


def convert_ani(name, out_stem, keep=None):
    buf = (SRC / name).read_bytes()
    frames, rate, rates, seq = read_ani(buf)
    order = seq if seq else list(range(len(frames)))
    if keep:  # thin the sequence out; every frame is a separate asset
        order = [order[round(i * (len(order) - 1) / (keep - 1))] for i in range(keep)]
    hotspot = None
    for i, fi in enumerate(order):
        fbuf = frames[fi]
        e = best(read_cur(fbuf), fbuf)
        w, h, rgba = decode_image(fbuf, e["off"], e["size"])
        write_png(HERE / f"{out_stem}-{i}.png", w, h, rgba)
        hotspot = (e["hx"], e["hy"], w, h)
    ms = round(rate * 1000 / 60)
    print(f"{name}: {len(frames)} frames @ {rate} jiffies ({ms}ms) -> "
          f"{len(order)} PNGs, hotspot ({hotspot[0]}, {hotspot[1]})")
    return hotspot, ms, len(order)


if __name__ == "__main__":
    if not SRC.exists():
        sys.exit(f"put Link.cur / Move.cur / Busy.ani in {SRC}")
    convert_cur("Link.cur", "link", big=48)
    convert_cur("Move.cur", "move", big=48)
    convert_ani("Busy.ani", "busy", keep=12)
