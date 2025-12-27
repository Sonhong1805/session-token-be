import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function fixImportsInFile(filePath) {
  try {
    let content = await readFile(filePath, 'utf-8');
    const originalContent = content;
    
    // Thay thế .ts" thành " và .ts' thành ' trong import statements
    // Chỉ thay thế khi nó là extension của file (không phải trong string khác)
    content = content.replace(/from\s+(["'])([^"']+)\.ts(["'])/g, 'from $1$2$3');
    content = content.replace(/import\s+\((["'])([^"']+)\.ts(["'])\)/g, 'import($1$2$3)');
    
    if (content !== originalContent) {
      await writeFile(filePath, content, 'utf-8');
      console.log(`Fixed imports in: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

async function processDirectory(dir) {
  try {
    const entries = await readdir(dir);
    let fixedCount = 0;
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        // Bỏ qua node_modules và dist
        if (entry === 'node_modules' || entry === 'dist' || entry === '.git') {
          continue;
        }
        fixedCount += await processDirectory(fullPath);
      } else if (stats.isFile() && extname(entry) === '.ts') {
        if (await fixImportsInFile(fullPath)) {
          fixedCount++;
        }
      }
    }
    
    return fixedCount;
  } catch (error) {
    console.error(`Error processing directory ${dir}:`, error.message);
    return 0;
  }
}

async function main() {
  const srcDir = join(__dirname, '..', 'src');
  console.log(`Processing directory: ${srcDir}`);
  const fixedCount = await processDirectory(srcDir);
  console.log(`\n✅ Fixed imports in ${fixedCount} file(s)`);
}

main().catch(console.error);

