import { buildMaze } from '../src/lib/maze/build';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from '../src/lib/maze/difficulty';
import { idx } from '../src/lib/qr/types';

// A leading tier name switches difficulty; everything else is a URL.
const args = process.argv.slice(2);
const tier = (DIFFICULTIES as readonly string[]).includes(args[0])
  ? (args.shift() as Difficulty)
  : DEFAULT_DIFFICULTY;

const urls = args.length
  ? args
  : ['https://example.com', 'https://github.com/pmndrs/react-three-fiber'];

for (const url of urls) {
  const r = buildMaze(url, tier);
  if (!r.ok) { console.log(url, 'FAILED', r.reason, r.attempts); continue; }
  const m = r.maze;
  console.log(`\n=== ${url}  [${m.difficulty}]`);
  console.log(`level=${m.level} version=${m.version} size=${m.size} carved=${m.carvedCount} ` +
    `plugged=${m.pluggedCount} damage=${(r.attempts.at(-1)!.damageRatio * 100).toFixed(2)}%`);
  console.log(`start=(${m.start.row},${m.start.col}) end=(${m.end.row},${m.end.col}) ` +
    `moves=${m.analysis.shortestLength} budget=${m.moveBudget} ` +
    `routes=${m.analysis.shortestRouteCount} reachable=${m.analysis.reachableCells}`);
  console.log('attempts:', r.attempts.map(a => `${a.level}:${a.outcome}`).join(' '));
  let out = '';
  for (let row = 0; row < m.size; row++) {
    let line = '';
    for (let col = 0; col < m.size; col++) {
      const i = idx(m.size, row, col);
      if (row === m.start.row && col === m.start.col) line += 'S ';
      else if (row === m.end.row && col === m.end.col) line += 'E ';
      else if (m.carved[i]) line += '+ ';
      else if (m.plugged[i]) line += 'x ';
      else if (m.modules[i]) line += (m.reserved[i] ? '@ ' : '# ');
      else line += (m.reserved[i] ? '- ' : '. ');
    }
    out += line + '\n';
  }
  console.log(out);
}
