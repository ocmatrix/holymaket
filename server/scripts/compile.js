const bytenode = require('bytenode');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const outputDir = path.join(__dirname, '../compiled');

const skipFiles = [
  '.map',
  '.json',
];

function compileDirectory(dir, outDir) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const outPath = path.join(outDir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      compileDirectory(filePath, outPath);
    } else if (file.endsWith('.js')) {
      try {
        const jscPath = outPath.replace('.js', '.jsc');
        bytenode.compileFile(filePath, jscPath);
        const relativePath = path.relative(path.dirname(outPath), jscPath).replace(/\\/g, '/');
        const loaderContent = `require('bytenode');module.exports=require('./${relativePath}');`;
        fs.writeFileSync(outPath, loaderContent);
        console.log(`✅ Compiled: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to compile ${file}:`, error.message);
        fs.copyFileSync(filePath, outPath);
      }
    } else if (file.endsWith('.d.ts')) {
      console.log(`🚫 Skipped (security): ${file}`);
    } else if (!skipFiles.some(ext => file.endsWith(ext))) {
      fs.copyFileSync(filePath, outPath);
      console.log(`📋 Copied: ${file}`);
    }
  }
}

function removeTypeDefinitions(dir) {
  const files = fs.readdirSync(dir);
  let deletedCount = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      deletedCount += removeTypeDefinitions(filePath);
    } else if (file.endsWith('.d.ts')) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Removed type definition: ${file}`);
      deletedCount++;
    }
  }

  return deletedCount;
}

function main() {
  console.log('🔧 Compiling NestJS to bytecode...');
  console.log(`📁 Source: ${distDir}`);
  console.log(`📁 Output: ${outputDir}`);
  console.log('');

  if (!fs.existsSync(distDir)) {
    console.error('❌ dist directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }

  compileDirectory(distDir, outputDir);

  console.log('');
  console.log('🔐 Removing TypeScript definitions...');
  const deletedCount = removeTypeDefinitions(outputDir);
  console.log(`✅ Removed ${deletedCount} .d.ts files`);

  console.log('');
  console.log('✅ Compilation complete!');
  console.log(`📦 Output directory: ${outputDir}`);
}

main();
