"""Shared mask helpers for cut.py (3x canvas, 600x360)."""
import numpy as np, cv2
from scipy import ndimage


def poly(P, shape):
    m = np.zeros(shape, np.uint8); cv2.fillPoly(m, [np.round(np.array(P) * 16).astype(np.int32)], 1, lineType=cv2.LINE_8, shift=4)
    return m.astype(bool)


def disc(cx, cy, r, shape, soft=0.0):
    yy, xx = np.mgrid[:shape[0], :shape[1]]
    d = np.hypot(xx - cx, yy - cy) - r
    if soft <= 0: return d <= 0
    return np.clip(0.5 - d / soft, 0, 1)


def hsv(rgb):
    x = np.clip(rgb, 0, 255).astype(np.uint8)
    h = cv2.cvtColor(x, cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
    return h[..., 0] * 360 / 256, h[..., 1] / 255, h[..., 2] / 255


def component_at(binary, pts):
    lab, n = ndimage.label(binary)
    out = np.zeros(binary.shape, bool)
    for x, y in pts:
        i = lab[int(y), int(x)]
        if i: out |= lab == i
    return out


def grow_into(m, alpha, px=2, thr=0):
    """grow a core mask over its soft (low-alpha) rim so edge pixels travel with the piece."""
    return (ndimage.binary_dilation(m, iterations=px) & (alpha > thr)) | m


def fill_holes(m): return ndimage.binary_fill_holes(m)
