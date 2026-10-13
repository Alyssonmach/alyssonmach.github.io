#!/usr/bin/env python3
"""Generate small first-page previews without loading PDFs in the browser."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata

MAX_EDGE = 640
RENDER_VERSION = 1
GENERATED_NAME = re.compile(r"preview-[a-f0-9]{16}-[a-f0-9]{16}\.webp$")


def render_cover(source, destination):
    try:
        import pypdfium2 as pdfium
        from PIL import Image
    except ImportError as error:
        raise RuntimeError("Instale as dependências: python3 -m pip install -r scripts/preview-requirements.txt") from error
    with pdfium.PdfDocument(source) as document:
        if not len(document):
            raise ValueError("O PDF não possui páginas")
        page = document[0]
        try:
            scale = MAX_EDGE / max(page.get_size())
            bitmap = page.render(scale=scale)
            try:
                image = bitmap.to_pil().convert("RGB")
                image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
                # Save atomically so an interrupted render cannot corrupt a cached cover.
                temporary = destination.with_suffix('.tmp')
                image.save(temporary, format='WEBP', quality=84, method=6)
                temporary.replace(destination)
                return image.size
            finally:
                bitmap.close()
        finally:
            page.close()


def generate(root):
    root = Path(root).resolve()
    pdf_directory = root / 'files/mestrado'
    if not pdf_directory.is_dir():
        raise ValueError(f"Pasta não encontrada: {pdf_directory}")
    preview_directory = root / 'images/mestrado/previews'
    manifest = root / '_data/mestrado_previews.json'
    preview_directory.mkdir(parents=True, exist_ok=True)
    previous = json.loads(manifest.read_text()) if manifest.exists() else []
    cached_entries = {entry['path']: entry for entry in previous}
    entries, errors = [], []
    generated_count = 0
    pdf_paths = sorted(
        path for path in pdf_directory.rglob('*')
        if path.is_file() and path.suffix.lower() == '.pdf'
    )
    for source in pdf_paths:
        # Matching keys are canonical; the PDF link still uses the actual filename.
        source_url = unicodedata.normalize('NFC', '/' + source.relative_to(root).as_posix())
        source_digest = hashlib.sha256(source.read_bytes()).hexdigest()
        path_id = hashlib.sha256(source_url.encode()).hexdigest()[:16]
        version_id = hashlib.sha256(f'{source_digest}:{RENDER_VERSION}:{MAX_EDGE}'.encode()).hexdigest()[:16]
        filename = f'preview-{path_id}-{version_id}.webp'
        cover_url = '/images/mestrado/previews/' + filename
        cached_entry = cached_entries.get(source_url)
        if (
            cached_entry
            and cached_entry.get('source_sha256') == source_digest
            and cached_entry.get('image') == cover_url
            and (preview_directory / filename).is_file()
        ):
            entries.append(cached_entry)
            continue
        try:
            width, height = render_cover(source, preview_directory / filename)
        except Exception as error:
            errors.append(f'{source_url}: {error}')
            continue
        generated_count += 1
        entries.append(dict(path=source_url, image=cover_url, width=width, height=height, source_sha256=source_digest))

    # Do not publish a partial manifest when a PDF could not be rendered.
    if errors:
        raise RuntimeError('\n'.join(errors))
    payload = json.dumps(entries, ensure_ascii=False, indent=2) + '\n'
    manifest.parent.mkdir(parents=True, exist_ok=True)
    if not manifest.exists() or manifest.read_text() != payload:
        temporary = manifest.with_suffix('.tmp')
        temporary.write_text(payload)
        temporary.replace(manifest)
    used = {Path(entry['image']).name for entry in entries}
    for path in preview_directory.iterdir():
        if path.is_file() and GENERATED_NAME.fullmatch(path.name) and path.name not in used:
            path.unlink()
    print(f'{len(entries)} capas disponíveis; {generated_count} geradas ou atualizadas.')
    return entries


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    try:
        generate(args.root)
    except (RuntimeError, ValueError) as error:
        parser.exit(1, f'{error}\n')
