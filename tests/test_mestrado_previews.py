import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('previews', Path(__file__).resolve().parents[1] / 'scripts/generate_mestrado_previews.py')
previews = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previews)


class PreviewGenerationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pdf = self.root / 'files/mestrado/apresentac\u0327o\u0303es/Primeira apresentação.PDF'
        self.pdf.parent.mkdir(parents=True)
        self.pdf.write_bytes(b'first PDF content')
        self.manifest = self.root / '_data/mestrado_previews.json'

    @staticmethod
    def render(source, destination):
        destination.write_bytes(b'rendered first page')
        return 640, 480

    def test_unchanged_pdf_reuses_thumbnail_without_rewriting_manifest(self):
        with patch.object(previews, 'render_cover', side_effect=self.render) as render:
            entries = previews.generate(self.root)
            timestamp = self.manifest.stat().st_mtime_ns
            previews.generate(self.root)
            self.assertEqual(render.call_count, 1)
            self.assertEqual(self.manifest.stat().st_mtime_ns, timestamp)
            self.assertEqual(entries[0]['path'], '/files/mestrado/apresentações/Primeira apresentação.PDF')

    def test_updated_pdf_gets_new_url_and_preserves_manual_assets(self):
        with patch.object(previews, 'render_cover', side_effect=self.render):
            old = previews.generate(self.root)[0]
            previous = self.root / old['image'].lstrip('/')
            manual = previous.parent / 'custom.webp'
            manual.write_bytes(b'keep me')
            self.pdf.write_bytes(b'replaced PDF content')
            new = previews.generate(self.root)[0]
            self.assertNotEqual(old['image'], new['image'])
            self.assertFalse(previous.exists())
            self.assertTrue(manual.exists())

    def test_deleted_pdf_is_removed_from_manifest_and_generated_assets(self):
        with patch.object(previews, 'render_cover', side_effect=self.render):
            old = previews.generate(self.root)[0]
            self.pdf.unlink()
            self.assertEqual(previews.generate(self.root), [])
            self.assertFalse((self.root / old['image'].lstrip('/')).exists())

    def test_render_failure_preserves_last_successful_manifest(self):
        with patch.object(previews, 'render_cover', side_effect=self.render):
            previews.generate(self.root)
        previous = self.manifest.read_bytes()
        self.pdf.write_bytes(b'unreadable PDF')
        with patch.object(previews, 'render_cover', side_effect=ValueError('Invalid PDF')):
            with self.assertRaisesRegex(RuntimeError, 'Invalid PDF'):
                previews.generate(self.root)
        self.assertEqual(self.manifest.read_bytes(), previous)


if __name__ == '__main__':
    unittest.main()
