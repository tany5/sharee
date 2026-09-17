from __future__ import annotations

import argparse
import csv
import math
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


BRAND = "TheTanti"
PRICE = "199.00 INR"
SITE_URL = "https://www.thetanti.shop"
PHONE = "+91 90381 27527"


META_COLUMNS = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "link",
    "image_link",
    "brand",
    "price",
    "google_product_category",
    "fb_product_category",
    "quantity_to_sell_on_facebook",
    "sale_price",
    "sale_price_effective_date",
    "item_group_id",
    "gender",
    "color",
    "size",
    "age_group",
    "material",
    "pattern",
    "shipping",
    "shipping_weight",
    "offer_disclaimer",
    "offer_disclaimer_url",
    "video[0].url",
    "video[0].tag[0]",
    "gtin",
    "product_tags[0]",
    "product_tags[1]",
    "style[0]",
]


COLOR_TABLE = [
    ("red", (190, 55, 55)),
    ("maroon", (115, 35, 45)),
    ("pink", (210, 70, 150)),
    ("purple", (115, 70, 160)),
    ("blue", (55, 95, 185)),
    ("teal", (35, 140, 145)),
    ("green", (55, 130, 75)),
    ("cream", (212, 198, 166)),
    ("gold", (195, 145, 70)),
    ("orange", (210, 115, 55)),
    ("black", (40, 38, 36)),
    ("white", (225, 222, 210)),
]


@dataclass
class ProductInfo:
    sku: str
    title: str
    color: str
    pattern: str


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def make_background(size: tuple[int, int], poster: bool = False) -> Image.Image:
    w, h = size
    top = (248, 242, 232)
    bottom = (230, 218, 203) if not poster else (238, 225, 214)
    bg = Image.new("RGB", size, top)
    px = bg.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for x in range(w):
            vignette = 1.0 - 0.10 * math.hypot((x / w) - 0.5, (y / h) - 0.46)
            px[x, y] = tuple(
                max(0, min(255, int((top[i] * (1 - t) + bottom[i] * t) * vignette)))
                for i in range(3)
            )
    draw = ImageDraw.Draw(bg, "RGBA")
    line_color = (196, 145, 92, 22)
    step = 56 if poster else 44
    for x in range(-h, w, step):
        draw.line([(x, 0), (x + h, h)], fill=line_color, width=1)
    draw.ellipse((w * 0.58, h * 0.10, w * 1.20, h * 0.64), fill=(196, 90, 90, 22))
    return bg


def remove_background(image: Image.Image, session=None) -> Image.Image:
    try:
        from rembg import remove

        return remove(image, session=session)
    except Exception:
        return image.convert("RGBA")


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda p: 255 if p > 16 else 0).getbbox()
    if bbox:
        return bbox
    return (0, 0, image.width, image.height)


def trim_subject(image: Image.Image) -> Image.Image:
    bbox = alpha_bbox(image)
    x0, y0, x1, y1 = bbox
    pad_x = int((x1 - x0) * 0.02)
    pad_y = int((y1 - y0) * 0.02)
    x0 = max(0, x0 - pad_x)
    y0 = max(0, y0 - pad_y)
    x1 = min(image.width, x1 + pad_x)
    y1 = min(image.height, y1 + pad_y)
    return image.crop((x0, y0, x1, y1))


def fit_subject(subject: Image.Image, canvas_size: tuple[int, int], max_fraction: float) -> tuple[Image.Image, tuple[int, int]]:
    canvas_w, canvas_h = canvas_size
    max_w = int(canvas_w * max_fraction)
    max_h = int(canvas_h * max_fraction)
    subject = subject.copy()
    subject.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    x = (canvas_w - subject.width) // 2
    y = int((canvas_h - subject.height) * 0.48)
    return subject, (x, y)


def composite_product(subject: Image.Image, size: tuple[int, int], poster: bool = False) -> Image.Image:
    bg = make_background(size, poster=poster).convert("RGBA")
    subject, pos = fit_subject(subject, size, 0.84 if poster else 0.88)

    alpha = subject.getchannel("A")
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow_alpha = alpha.filter(ImageFilter.GaussianBlur(22))
    sx = pos[0] + 18
    sy = pos[1] + 26
    shadow.paste((45, 30, 24, 92), (sx, sy), shadow_alpha)
    bg.alpha_composite(shadow)
    bg.alpha_composite(subject, pos)
    return bg.convert("RGB")


def poster_from_subject(subject: Image.Image, info: ProductInfo) -> Image.Image:
    out = composite_product(subject, (1080, 1920), poster=True).convert("RGB")
    draw = ImageDraw.Draw(out)
    draw.rectangle((0, 0, 1080, 186), fill=(23, 19, 17))
    draw.text((54, 42), BRAND, fill=(247, 241, 232), font=font(58, bold=True))
    draw.text((54, 112), "All Sarees Rs 199", fill=(214, 173, 114), font=font(34, bold=True))
    draw.rounded_rectangle((54, 1712, 1026, 1834), radius=28, fill=(196, 90, 90))
    draw.text((98, 1742), f"Order on WhatsApp: {PHONE}", fill=(255, 255, 255), font=font(38, bold=True))
    draw.text((54, 1848), f"{info.title} | {info.color.title()} | Ready stock", fill=(45, 37, 32), font=font(28))
    return out


def enhance_source(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image).convert("RGB")
    image = ImageEnhance.Color(image).enhance(1.08)
    image = ImageEnhance.Contrast(image).enhance(1.07)
    image = ImageEnhance.Sharpness(image).enhance(1.18)
    return image


def nearest_color(rgb: tuple[int, int, int]) -> str:
    def dist(c):
        return sum((rgb[i] - c[i]) ** 2 for i in range(3))

    return min(COLOR_TABLE, key=lambda row: dist(row[1]))[0]


def product_color(subject: Image.Image) -> str:
    rgba = subject.convert("RGBA")
    rgba.thumbnail((160, 160), Image.Resampling.LANCZOS)
    pixels = [
        p[:3]
        for p in rgba.getdata()
        if p[3] > 96 and not (p[0] > 225 and p[1] > 225 and p[2] > 225)
    ]
    if not pixels:
        return "multi color"
    buckets: dict[str, int] = {}
    for rgb in pixels[:: max(1, len(pixels) // 4000)]:
        name = nearest_color(rgb)
        buckets[name] = buckets.get(name, 0) + 1
    top = sorted(buckets.items(), key=lambda item: item[1], reverse=True)[:3]
    names = [name for name, _ in top if name not in {"white", "black"}]
    return " / ".join(names[:2]) if names else top[0][0]


def make_info(index: int, subject: Image.Image) -> ProductInfo:
    sku = f"TT-SAREE-{index:03d}"
    color = product_color(subject)
    title_color = color.replace(" / ", " ")
    title = f"{BRAND} {title_color.title()} Saree {index:03d}"
    return ProductInfo(sku=sku, title=title, color=color, pattern="embroidered / printed")


def save_review_sheet(paths: list[Path], out_path: Path) -> None:
    thumbs = []
    for path in paths[:24]:
        im = Image.open(path).convert("RGB")
        im.thumbnail((220, 220), Image.Resampling.LANCZOS)
        thumbs.append((path.stem, im.copy()))
    cols = 4
    rows = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGB", (cols * 260, rows * 286), (248, 242, 232))
    draw = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(thumbs):
        x = (i % cols) * 260 + 20
        y = (i // cols) * 286 + 18
        sheet.paste(im, (x + (220 - im.width) // 2, y))
        draw.text((x, y + 226), label, fill=(45, 37, 32), font=font(18))
    sheet.save(out_path, quality=92)


def build_assets(input_dir: Path, output_dir: Path, limit: int | None = None) -> None:
    images = sorted([p for p in input_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}])
    if limit:
        images = images[:limit]

    meta_dir = output_dir / "meta_square"
    whatsapp_dir = output_dir / "whatsapp_status"
    cutout_dir = output_dir / "cutouts_png"
    for directory in [meta_dir, whatsapp_dir, cutout_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    session = None
    try:
        from rembg import new_session

        session = new_session("bria-rmbg")
    except Exception:
        session = None

    rows = []
    meta_paths = []
    for index, path in enumerate(images, start=1):
        source = enhance_source(Image.open(path))
        cutout = trim_subject(remove_background(source, session=session))
        info = make_info(index, cutout)
        slug = slugify(info.sku)

        cutout_path = cutout_dir / f"{slug}.png"
        meta_path = meta_dir / f"{slug}.jpg"
        whatsapp_path = whatsapp_dir / f"{slug}-whatsapp.jpg"

        cutout.save(cutout_path)
        composite_product(cutout, (1080, 1080)).save(meta_path, quality=94, optimize=True)
        poster_from_subject(cutout, info).save(whatsapp_path, quality=92, optimize=True)
        meta_paths.append(meta_path)

        rows.append(
            {
                "id": info.sku,
                "title": info.title,
                "description": (
                    f"Beautiful {info.color} saree from {BRAND}. Clear product photo prepared for "
                    "Facebook, Instagram and WhatsApp catalog use. Ready stock at one simple price."
                ),
                "availability": "in stock",
                "condition": "new",
                "link": f"{SITE_URL}/products/{slug}",
                "image_link": f"{SITE_URL}/catalog/meta/{meta_path.name}",
                "brand": BRAND,
                "price": PRICE,
                "google_product_category": "Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing > Saris & Lehengas",
                "fb_product_category": "Clothing & Accessories > Clothing",
                "quantity_to_sell_on_facebook": "10",
                "sale_price": "",
                "sale_price_effective_date": "",
                "item_group_id": "",
                "gender": "female",
                "color": info.color,
                "size": "free size",
                "age_group": "adult",
                "material": "",
                "pattern": info.pattern,
                "shipping": "IN:::49.00 INR",
                "shipping_weight": "",
                "offer_disclaimer": "Price and availability may change. Confirm final order details on checkout or WhatsApp.",
                "offer_disclaimer_url": "",
                "video[0].url": "",
                "video[0].tag[0]": "",
                "gtin": "",
                "product_tags[0]": "saree",
                "product_tags[1]": "ready stock",
                "style[0]": "ethnic",
            }
        )
        print(f"{index:03d}/{len(images):03d} {path.name} -> {meta_path.name}", flush=True)

    csv_path = output_dir / "catalog_products_ready.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=META_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    if meta_paths:
        save_review_sheet(meta_paths, output_dir / "review_contact_sheet.jpg")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build TheTanti saree catalog assets for Meta and WhatsApp.")
    parser.add_argument("--input", default=r"C:\Users\Tanmay_Pc\Downloads\compressedImages")
    parser.add_argument("--output", default=r"C:\Users\Tanmay_Pc\Downloads\processed_catalog")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    build_assets(Path(args.input), Path(args.output), args.limit)


if __name__ == "__main__":
    main()
