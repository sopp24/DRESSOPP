#!/usr/bin/env python3
"""Add page boxes and metadata without rasterizing DRESSOPP's browser-generated PDFs."""
from __future__ import annotations

import os
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

ROOT = Path(__file__).resolve().parents[1]
PT_PER_MM = 72.0 / 25.4

FILES = {
    "DRESSOPP-Board-A3.pdf": {
        "media": (0, 0, 420, 297),
        "bleed": (0, 0, 420, 297),
        "trim": (0, 0, 420, 297),
        "title": "DRESSOPP - Board de présentation - A3 paysage",
        "subject": "PDF de présentation A3 paysage, format fini 420 x 297 mm."
    },
    "DRESSOPP-Board-Imprimeur-SRA3.pdf": {
        "media": (0, 0, 450, 320),
        "bleed": (12, 8.5, 438, 311.5),
        "trim": (15, 11.5, 435, 308.5),
        "title": "DRESSOPP - Board imprimeur - SRA3 avec fond perdu",
        "subject": "SRA3 450 x 320 mm; coupe A3 420 x 297 mm; fond perdu 3 mm; traits de coupe."
    }
}


def rect(box: tuple[float, float, float, float]) -> RectangleObject:
    return RectangleObject([coordinate * PT_PER_MM for coordinate in box])


def set_boxes(pdf_path: Path, config: dict[str, object]) -> None:
    reader = PdfReader(str(pdf_path), strict=False)
    if len(reader.pages) != 1:
        raise RuntimeError(f"{pdf_path.name}: attendu 1 page, trouvé {len(reader.pages)}.")

    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    page = writer.pages[0]
    page.mediabox = rect(config["media"])
    page.cropbox = rect(config["media"])
    page.bleedbox = rect(config["bleed"])
    page.trimbox = rect(config["trim"])
    page.artbox = rect(config["trim"])

    writer.add_metadata({
        "/Title": str(config["title"]),
        "/Author": "DRESSOPP",
        "/Subject": str(config["subject"]),
        "/Creator": "DRESSOPP - Board export pipeline",
        "/Producer": "Chromium / Playwright + pypdf",
        "/Keywords": "DRESSOPP, A3, SRA3, bleed, crop marks, print"
    })

    temp_path = pdf_path.with_suffix(".prepress.tmp.pdf")
    with temp_path.open("wb") as stream:
        writer.write(stream)
    os.replace(temp_path, pdf_path)


def assert_box(page, key: str, expected: tuple[float, float, float, float]) -> None:
    box = getattr(page, key)
    actual = tuple(float(value) / PT_PER_MM for value in (box.left, box.bottom, box.right, box.top))
    if any(abs(a - e) > 0.15 for a, e in zip(actual, expected)):
        raise RuntimeError(f"{key} incorrect: {actual}, attendu {expected} mm.")


def verify(pdf_path: Path, config: dict[str, object]) -> None:
    reader = PdfReader(str(pdf_path), strict=False)
    if len(reader.pages) != 1:
        raise RuntimeError(f"{pdf_path.name}: nombre de pages incorrect.")
    page = reader.pages[0]
    assert_box(page, "mediabox", config["media"])
    assert_box(page, "bleedbox", config["bleed"])
    assert_box(page, "trimbox", config["trim"])
    if not reader.metadata or reader.metadata.get("/Author") != "DRESSOPP":
        raise RuntimeError(f"{pdf_path.name}: métadonnées d'impression absentes.")
    print(
        f"{pdf_path.name}: MediaBox={config['media'][2]}x{config['media'][3]} mm; "
        f"BleedBox={config['bleed'][2]-config['bleed'][0]}x{config['bleed'][3]-config['bleed'][1]} mm; "
        f"TrimBox={config['trim'][2]-config['trim'][0]}x{config['trim'][3]-config['trim'][1]} mm."
    )


def main() -> None:
    for name, config in FILES.items():
        pdf_path = ROOT / name
        if not pdf_path.is_file():
            raise FileNotFoundError(f"PDF généré manquant : {pdf_path}")
        set_boxes(pdf_path, config)
        verify(pdf_path, config)


if __name__ == "__main__":
    main()
