"""Baut dist/BOKU_TicTacTierernaehrung.html: eine einzige Datei mit eingebettetem three.js (läuft offline)."""
from pathlib import Path
root = Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")
three = (root / "three.min.js").read_text(encoding="utf-8")
tag = '<script src="three.min.js"></script>'
assert html.count(tag) == 1
out = html.replace(tag, "<script>\n" + three + "\n</script>")
dst = root.parent.parent / "dist/BOKU_TicTacTierernaehrung_v1.html"
dst.parent.mkdir(exist_ok=True)
dst.write_text(out, encoding="utf-8")
print(dst, len(out.encode()) // 1024, "KB")
