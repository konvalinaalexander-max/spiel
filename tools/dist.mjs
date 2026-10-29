// Gemeinsame Pfade der Auslieferung (Version 3). Version 2 bleibt unverändert als dist/BOKU_TicTacTierernaehrung_v2.html liegen.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const DIST_NAME = 'BOKU_TicTacTierernaehrung_v3.html';
export const DIST = 'dist/' + DIST_NAME;
export const MOBILE_ZIP = 'BOKU_TicTacTierernaehrung_v3_mobile.zip';
/** dist/SHA256.txt: Prüfsummen aller ausgelieferten Dateien (v3 Desktop, v3 Mobil-ZIP, Zwischenlieferungen, unveränderte Vorversionen) */
export function writeSums(root) {
  const files = [DIST_NAME, MOBILE_ZIP, 'BOKU_TicTacTierernaehrung_v3-beta.html', 'BOKU_TicTacTierernaehrung_v3-alpha.html', 'BOKU_TicTacTierernaehrung_v2.html', 'BOKU_TicTacTierernaehrung_v1.html'];
  const sums = files.filter(f => fs.existsSync(path.join(root, 'dist', f))).map(f => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'dist', f))).digest('hex')}  ${f}`);
  fs.writeFileSync(path.join(root, 'dist/SHA256.txt'), sums.join('\n') + '\n');
}
