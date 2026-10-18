"""Synthetic offline checks for ZIP safety and workbook-to-photo matching."""

from pathlib import Path
import stat
from tempfile import TemporaryDirectory
import unittest
from zipfile import ZipFile, ZipInfo

from openpyxl import Workbook

from import_memories import HEADERS, ImportProblem, PLACEHOLDER, build_data, main


JPEG = b"\xff\xd8\xffsynthetic-image-bytes\xff\xd9"


class ImportMemoriesTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.workbook_path = self.root / "memories.xlsx"
        self.zip_path = self.root / "photos.zip"
        self.workbook = Workbook()
        self.sheet = self.workbook.active
        self.sheet.title = "Du_lieu_ky_niem"
        self.sheet.append(HEADERS)
        self.sheet.append([1, "event-01", "  Sự kiện đầy đủ  ", None, "one.jpg\ntwo.jpg\n", "  Nội dung nguyên văn\nDòng tiếp theo.  "])
        with ZipFile(self.zip_path, "w") as archive:
            archive.writestr("photos/one.jpg", JPEG)
            archive.writestr("photos/two.JPG", JPEG + b"\xff\xd9")

    def tearDown(self):
        self.workbook.close()
        self.directory.cleanup()

    def build(self):
        self.workbook.save(self.workbook_path)
        return build_data(self.workbook_path, self.zip_path)

    def test_exact_text_multiline_photos_case_and_no_invented_date(self):
        memories, assets, diagnostics = self.build()
        self.assertEqual(memories[0]["title"], "Sự kiện đầy đủ")
        self.assertEqual(memories[0]["description"], "Nội dung nguyên văn\nDòng tiếp theo.")
        self.assertNotIn("date", memories[0])
        self.assertEqual(memories[0]["images"][1]["src"], "/images/memories/two.jpg")
        self.assertEqual(assets["one.jpg"], JPEG)
        self.assertEqual(diagnostics["missing"], [])

    def test_missing_photo_keeps_event_and_blank_description(self):
        self.sheet["E2"] = "one.jpg\nmissing.jpg"
        self.sheet["F2"] = None
        memories, _, diagnostics = self.build()
        self.assertEqual(memories[0]["description"], "")
        self.assertEqual(memories[0]["images"][1]["src"], PLACEHOLDER)
        self.assertTrue(memories[0]["images"][1]["isPlaceholder"])
        self.assertEqual(diagnostics["missing"], [{"id": "event-01", "file": "missing.jpg"}])

    def test_unique_explicit_filename_alias(self):
        with ZipFile(self.zip_path, "a") as archive:
            archive.writestr("photos/cnxhkh1.jpg", JPEG)
        self.sheet["E2"] = "cnxkh1.jpg\none.jpg"
        memories, _, diagnostics = self.build()
        self.assertEqual(memories[0]["images"][0]["src"], "/images/memories/cnxhkh1.jpg")
        self.assertEqual(diagnostics["aliases"][0]["from"], "cnxkh1.jpg")

    def test_ignores_documentation_sheets_and_styled_empty_rows(self):
        self.workbook.create_sheet("Huong_dan").append(["=1/0", "Not event data"])
        self.sheet["F1001"].number_format = "@"
        memories, _, _ = self.build()
        self.assertEqual(len(memories), 1)

    def test_only_grounded_boy_day_title_fallback(self):
        self.sheet["B2"] = "ky-niem-13"
        self.sheet["C2"] = None
        self.sheet["F2"] = "Đến Boy Day 2026 rồi!"
        self.assertEqual(self.build()[0][0]["title"], "Boy Day 2026")
        self.sheet["B2"] = "another-event"
        with self.assertRaisesRegex(ImportProblem, "missing event title"):
            self.build()

    def test_rejects_formula_in_data(self):
        self.sheet["F2"] = '=HYPERLINK("https://example.org","text")'
        with self.assertRaisesRegex(ImportProblem, "formulas"):
            self.build()

    def test_rejects_zip_traversal_before_writing(self):
        with ZipFile(self.zip_path, "a") as archive:
            archive.writestr("../outside.jpg", JPEG)
        with self.assertRaisesRegex(ImportProblem, "unsafe path"):
            self.build()
        self.assertFalse((self.root / "outside.jpg").exists())

    def test_rejects_zip_symlink(self):
        with ZipFile(self.zip_path, "a") as archive:
            info = ZipInfo("photos/link.jpg")
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(info, "one.jpg")
        with self.assertRaisesRegex(ImportProblem, "links"):
            self.build()

    def test_rejects_case_collisions(self):
        with ZipFile(self.zip_path, "a") as archive:
            archive.writestr("photos/ONE.JPG", JPEG)
        with self.assertRaisesRegex(ImportProblem, "duplicate filenames"):
            self.build()

    def test_main_preserves_bytes_and_refuses_conflicting_existing_photo(self):
        self.workbook.save(self.workbook_path)
        output = self.root / "site"
        main([str(self.workbook_path), str(self.zip_path), "--root", str(output)])
        target = output / "public/images/memories/one.jpg"
        self.assertEqual(target.read_bytes(), JPEG)
        self.assertTrue((output / "docs/memories-import-report.md").exists())
        target.write_bytes(b"existing unrelated file")
        with self.assertRaisesRegex(ImportProblem, "Refusing to overwrite"):
            main([str(self.workbook_path), str(self.zip_path), "--root", str(output)])
        self.assertEqual(target.read_bytes(), b"existing unrelated file")


if __name__ == "__main__":
    unittest.main()
