"""Green-screen keyer for the AI-generated character clips.

Reads a green-screen video, removes the background, crops to the character,
optionally turns it into a seamless loop, and writes a "stacked alpha" MP4:
the top half is the colour image, the bottom half is the alpha mask.
The website recombines the two halves in a WebGL shader, which works in
every browser (including Safari, where transparent video is unreliable).

Usage:
  python tools/key_video.py IN.mp4 OUT.mp4 [--loop SECONDS] [--lo 18] [--hi 42]
                            [--height 720] [--preview PREVIEW.png]
"""
import argparse
import json
import subprocess

import numpy as np
from PIL import Image


def probe(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", path])
    s = json.loads(out)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return s["width"], s["height"], float(num) / float(den)


def read_frames(path, w, h):
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE)
    size = w * h * 3
    frames = []
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        frames.append(np.frombuffer(buf, np.uint8).reshape(h, w, 3))
    proc.wait()
    return frames


def key(frame, lo, hi):
    f = frame.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    greenness = g - np.maximum(r, b)
    # 0 where clearly green, 1 where clearly not green
    alpha = 1.0 - np.clip((greenness - lo) / (hi - lo), 0.0, 1.0)
    alpha[alpha < 0.04] = 0.0
    # despill: pull green down to the other channels so edges are not green-tinted
    spill_cap = np.maximum(r, b) + 4.0
    f[..., 1] = np.minimum(g, spill_cap)
    return f, alpha


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--loop", type=float, default=0.0,
                    help="crossfade length in seconds to make a seamless loop (0 = no loop)")
    ap.add_argument("--lo", type=float, default=18.0)
    ap.add_argument("--hi", type=float, default=42.0)
    ap.add_argument("--height", type=int, default=0, help="scale output colour height (0 = keep)")
    ap.add_argument("--pad", type=int, default=12)
    ap.add_argument("--border", type=int, default=4, help="ignore this many pixels at the frame edges (black borders)")
    ap.add_argument("--crop", help="force crop box x0,y0,x1,y1 (use the same box for clips that swap)")
    ap.add_argument("--crf", type=int, default=20, help="H.264 quality (higher = smaller file)")
    ap.add_argument("--preview")
    a = ap.parse_args()

    w, h, fps = probe(a.src)
    frames = read_frames(a.src, w, h)
    keyed = [key(fr, a.lo, a.hi) for fr in frames]
    if a.border:
        b = a.border
        for _, al in keyed:
            al[:b, :] = 0
            al[-b:, :] = 0
            al[:, :b] = 0
            al[:, -b:] = 0

    # Union bounding box of the character over all frames
    mask = np.zeros((h, w), bool)
    for _, al in keyed:
        mask |= al > 0.5
    ys, xs = np.nonzero(mask)
    x0, x1 = max(xs.min() - a.pad, 0), min(xs.max() + a.pad, w)
    y0, y1 = max(ys.min() - a.pad, 0), min(ys.max() + a.pad, h)
    if a.crop:
        x0, y0, x1, y1 = (int(v) for v in a.crop.split(","))

    if a.loop > 0:
        n = int(round(a.loop * fps))
        body = keyed[n:]
        out = []
        for i, (c, al) in enumerate(body):
            j = i - (len(body) - n)
            if j >= 0:
                t = (j + 1) / n
                c2, al2 = keyed[j]
                c = c * (1 - t) + c2 * t
                al = al * (1 - t) + al2 * t
            out.append((c, al))
        keyed = out

    cw, ch = x1 - x0, y1 - y0
    if a.height:
        ow = int(round(cw * a.height / ch))
        oh = a.height
    else:
        ow, oh = cw, ch
    ow += ow % 2
    oh += oh % 2

    enc = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{ow}x{oh * 2}", "-r", str(fps), "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf), "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-an", a.dst], stdin=subprocess.PIPE)

    preview_done = False
    for c, al in keyed:
        c = c[y0:y1, x0:x1]
        al = al[y0:y1, x0:x1]
        # colour behind fully transparent pixels does not matter; darken it to avoid halos
        c = c * np.clip(al[..., None] * 1.5, 0, 1)
        ci = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).resize((ow, oh), Image.LANCZOS)
        ai = Image.fromarray((al * 255).astype(np.uint8)).resize((ow, oh), Image.LANCZOS)
        stacked = np.vstack([np.asarray(ci), np.repeat(np.asarray(ai)[..., None], 3, axis=2)])
        enc.stdin.write(stacked.tobytes())
        if a.preview and not preview_done:
            bg = Image.new("RGB", (ow, oh), (18, 22, 34))
            bg.paste(ci, (0, 0), ai)
            bg.save(a.preview)
            preview_done = True
    enc.stdin.close()
    enc.wait()
    print(f"{a.dst}: {len(keyed)} frames, {ow}x{oh} (stacked {ow}x{oh * 2}), crop x{x0}-{x1} y{y0}-{y1}")


if __name__ == "__main__":
    main()
