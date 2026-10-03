const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', 'src');

function getAllFiles(dir, exts = ['.js', '.jsx']) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      res = res.concat(getAllFiles(full, exts));
    } else if (exts.some(ext => full.endsWith(ext))) {
      res.push(path.resolve(full));
    }
  }
  return res;
}

const allFiles = getAllFiles(rootDir);
const importMap = new Map();
allFiles.forEach(f => importMap.set(f, []));

const importRegex = /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

allFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const impPath = match[1] || match[2] || match[3];
    if (impPath.startsWith('.')) {
      const resolvedBase = path.resolve(path.dirname(f), impPath);
      let target = null;
      for (const ext of ['', '.js', '.jsx', '/index.js', '/index.jsx']) {
        const cand = path.resolve(resolvedBase + ext);
        if (importMap.has(cand)) {
          target = cand;
          break;
        }
      }
      if (target) {
        importMap.get(target).push(f);
      }
    }
  }
});

console.log('=== FILES IMPORT AUDIT ===');
for (const [file, importers] of importMap.entries()) {
  const rel = path.relative(rootDir, file).replace(/\\/g, '/');
  if (importers.length === 0) {
    console.log(`[UNUSED / ENTRY] ${rel}`);
  } else {
    console.log(`[USED] ${rel} (${importers.length} importers)`);
  }
}
