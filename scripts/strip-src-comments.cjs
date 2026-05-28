const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const roots = [
  path.join(projectRoot, 'src'),
  path.join(projectRoot, 'server', 'src'),
  path.join(projectRoot, 'admin-web', 'src'),
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

function scriptKind(filePath) {
  return filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

const printer = ts.createPrinter({
  removeComments: true,
  newLine: ts.NewLineKind.LineFeed,
});

let ok = 0;
let fail = 0;

for (const root of roots) {
  for (const file of walk(root)) {
    const sourceText = fs.readFileSync(file, 'utf8');
    try {
      const sf = ts.createSourceFile(
        file,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(file),
      );
      const out = printer.printFile(sf);
      if (out !== sourceText) {
        fs.writeFileSync(file, out, 'utf8');
      }
      ok++;
    } catch (e) {
      console.error('SKIP', file, e.message);
      fail++;
    }
  }
}

console.log('strip-comments done:', { ok, fail });
