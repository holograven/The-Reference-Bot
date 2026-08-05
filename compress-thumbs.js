/**
 * compress-thumbs.js
 * Compresses all images in reference/film/ → reference/thumbs/
 * Resizes to max 400px width, WebP quality 70.
 * 
 * Usage: node compress-thumbs.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, 'reference', 'film');
const TARGET = path.join(__dirname, 'reference', 'thumbs');
const MAX_WIDTH = 400;
const QUALITY = 70;

if (!fs.existsSync(SOURCE)) {
  console.error('Source directory not found: ' + SOURCE);
  process.exit(1);
}

// Walk all .jpg/.jpeg/.png files
function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function compressFile(src) {
  const relPath = path.relative(SOURCE, src);
  const dest = path.join(TARGET, relPath.replace(/\.(jpe?g|png)$/i, '.webp'));
  
  // Ensure target directory exists
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // Skip if target already exists and is newer
  if (fs.existsSync(dest) && fs.statSync(dest).mtime > fs.statSync(src).mtime) {
    console.log('  SKIP (up to date): ' + relPath);
    return;
  }

  try {
    await sharp(src)
      .resize(MAX_WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(dest);
    
    const srcSize = (fs.statSync(src).size / 1024).toFixed(0);
    const dstSize = (fs.statSync(dest).size / 1024).toFixed(0);
    console.log(`  OK: ${relPath}  (${srcSize}KB → ${dstSize}KB)`);
  } catch (err) {
    console.error(`  FAIL: ${relPath} — ${err.message}`);
  }
}

(async () => {
  const files = walkDir(SOURCE);
  console.log(`Found ${files.length} images to compress...\n`);
  
  for (const file of files) {
    await compressFile(file);
  }
  
  console.log('\n✓ Done. Compressed images in: ' + TARGET);
})();
