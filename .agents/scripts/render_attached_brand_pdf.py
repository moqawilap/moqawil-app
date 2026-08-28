from pathlib import Path
import fitz

source = Path("attached_assets/Files_1787945873673.pdf")
output = Path(".agents/outputs/attached_brand_pdf_latest")
output.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
print(f"pages={document.page_count}")
print(f"metadata={document.metadata}")
for index, page in enumerate(document):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    destination = output / f"page_{index + 1:02d}.png"
    pixmap.save(destination)
    print(f"rendered={destination} size={page.rect.width:.0f}x{page.rect.height:.0f}")
    for image_index, image in enumerate(page.get_images(full=True)):
        xref = image[0]
        extracted = document.extract_image(xref)
        image_destination = output / f"embedded_{index + 1:02d}_{image_index + 1:02d}.{extracted['ext']}"
        image_destination.write_bytes(extracted["image"])
        print(f"extracted={image_destination} size={extracted['width']}x{extracted['height']}")