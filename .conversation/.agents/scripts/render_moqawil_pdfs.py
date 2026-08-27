from pathlib import Path
import fitz

INPUTS = [
    Path("attached_assets/Files_1787850959598.pdf"),
    Path("attached_assets/moqawil_-_مقــاول_2_1787850959601.pdf"),
]
OUTPUT = Path(".agents/outputs/moqawil_pdf_renders")
OUTPUT.mkdir(parents=True, exist_ok=True)

for pdf_path in INPUTS:
    doc = fitz.open(pdf_path)
    stem = pdf_path.stem
    print(f"{pdf_path}: {len(doc)} page(s)")
    for index, page in enumerate(doc):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        output_path = OUTPUT / f"{stem}_page_{index + 1:02d}.png"
        pixmap.save(output_path)
        print(output_path)