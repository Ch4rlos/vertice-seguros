#!/usr/bin/env python3
"""Genera avatares y logo genericos (sin IA, sin costo) para reemplazar la identidad
de Carlos en el repo publico de agente de seguros. Paleta: azul marino + naranja."""
import pathlib
from PIL import Image, ImageDraw, ImageFilter

OUT = pathlib.Path.home() / "dev" / "cq-asesor-patrimonial" / "frontend" / "src" / "assets" / "reemplazos"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = (12, 30, 58)
NAVY_2 = (23, 54, 100)
ORANGE = (232, 118, 42)
LIGHT = (238, 242, 248)
INK = (10, 18, 32)
S = 4  # supersampling


def grad(size, c1, c2, diagonal=True):
    w, h = size
    img = Image.new("RGB", (w, h), c1)
    d = ImageDraw.Draw(img)
    steps = max(w, h)
    for i in range(steps):
        t = i / max(steps - 1, 1)
        col = tuple(int(c1[k] + (c2[k] - c1[k]) * t) for k in range(3))
        if diagonal:
            d.line([(i, 0), (0, i)], fill=col, width=2)
        else:
            d.line([(0, i), (w, i)], fill=col)
    return img


def silueta(size, bg, figure, accent):
    """Retrato abstracto: cabeza + hombros, estilo avatar profesional."""
    w, h = size[0] * S, size[1] * S
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img)
    # halo suave
    halo_r = int(w * 0.42)
    halo = Image.new("RGB", (w, h), bg)
    dh = ImageDraw.Draw(halo)
    cx, cy = w // 2, int(h * 0.40)
    dh.ellipse([cx - halo_r, cy - halo_r, cx + halo_r, cy + halo_r], fill=accent)
    halo = halo.filter(ImageFilter.GaussianBlur(w // 12))
    img = Image.blend(img, halo, 0.22)
    d = ImageDraw.Draw(img)
    # hombros
    sw = int(w * 0.66)
    sh = int(h * 0.42)
    d.ellipse([cx - sw // 2, int(h * 0.62) - sh // 3, cx + sw // 2, int(h * 0.62) + sh],
              fill=figure)
    # cuello
    d.rectangle([cx - int(w * 0.075), int(h * 0.50), cx + int(w * 0.075), int(h * 0.68)], fill=figure)
    # cabeza
    hr = int(w * 0.155)
    d.ellipse([cx - hr, int(h * 0.20), cx + hr, int(h * 0.20) + int(hr * 2.35)], fill=figure)
    # camisa (V clara) y corbata (acento) para que se lea profesional, no icono por defecto
    vw = int(w * 0.105)
    vy0 = int(h * 0.615)
    vy1 = int(h * 0.86)
    d.polygon([(cx - vw, vy0), (cx + vw, vy0), (cx, vy1)], fill=(248, 250, 253))
    # solapas del saco encima de la camisa
    d.polygon([(cx - vw, vy0), (cx - int(vw * 0.18), vy0), (cx, vy1), (cx - int(vw * 0.55), vy1)],
              fill=figure)
    d.polygon([(cx + vw, vy0), (cx + int(vw * 0.18), vy0), (cx, vy1), (cx + int(vw * 0.55), vy1)],
              fill=figure)
    # corbata
    tw = int(w * 0.022)
    d.polygon([(cx - tw, int(h * 0.655)), (cx + tw, int(h * 0.655)),
               (cx + int(tw * 1.5), vy1 - int(h * 0.02)), (cx, vy1 + int(h * 0.015)),
               (cx - int(tw * 1.5), vy1 - int(h * 0.02))], fill=accent)
    return img.resize(size, Image.LANCZOS)


def logo(size=1254):
    w = size * S
    img = Image.new("RGBA", (w, w), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)
    cx = cy = w // 2
    r = int(w * 0.36)
    import math
    pts = [(cx + r * math.cos(math.radians(60 * i - 30)), cy + r * math.sin(math.radians(60 * i - 30)))
           for i in range(6)]
    # hexagono exterior grueso en azul marino
    d.line(pts + [pts[0]], fill=NAVY, width=int(w * 0.055), joint="curve")
    # hexagono interior en naranja
    r2 = int(r * 0.55)
    pts2 = [(cx + r2 * math.cos(math.radians(60 * i - 30)), cy + r2 * math.sin(math.radians(60 * i - 30)))
            for i in range(6)]
    d.line(pts2 + [pts2[0]], fill=ORANGE, width=int(w * 0.038), joint="curve")
    # nodos en las esquinas
    for (x, y) in pts:
        rr = int(w * 0.028)
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=NAVY)
    # escudo central
    sh_w = int(r2 * 1.25)
    d.polygon([(cx - sh_w // 2, cy - int(sh_w * 0.45)), (cx + sh_w // 2, cy - int(sh_w * 0.45)),
               (cx + sh_w // 2, cy + int(sh_w * 0.1)), (cx, cy + int(sh_w * 0.62)),
               (cx - sh_w // 2, cy + int(sh_w * 0.1))], fill=NAVY)
    return img.resize((size, size), Image.LANCZOS)


print("assets genericos (sin IA):")
p1 = OUT / "asesor-about.png"
silueta((900, 812), LIGHT, NAVY_2, ORANGE).save(p1)
print(" OK", p1.name, p1.stat().st_size // 1024, "KB")

p2 = OUT / "asesor-hero-negro.png"
silueta((620, 620), INK, (54, 78, 116), ORANGE).save(p2)
print(" OK", p2.name, p2.stat().st_size // 1024, "KB")

p3 = OUT / "asesor-hero-blanco.png"
silueta((800, 800), (250, 250, 252), NAVY, ORANGE).save(p3)
print(" OK", p3.name, p3.stat().st_size // 1024, "KB")

p4 = OUT / "logo-generico.png"
logo().save(p4)
print(" OK", p4.name, p4.stat().st_size // 1024, "KB")
print("->", OUT)
