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
    
    // Thay thế .ts" thành .js" và .ts' thành .js'
    content = content.replace(/\.ts"/g, '.js"');
    content = content.replace(/\.ts'/g, ".js'");
    
    // Thêm extension .js vào các import paths không có extension
    // Ví dụ: from "./config/env" -> from "./config/env.js"
    // Ví dụ: from "../config/env" -> from "../config/env.js"
    // Nhưng không thêm vào các import từ node_modules hoặc các package bên ngoài
    content = content.replace(
      /from\s+(["'])(\.\.?\/[^"']+)(["'])/g,
      (match, quote1, path, quote2) => {
        // Chỉ thêm .js nếu path không có extension và không kết thúc bằng /
        if (!path.match(/\.(js|json|ts|tsx|jsx)$/) && !path.endsWith('/')) {
          return `from ${quote1}${path}.js${quote2}`;
        }
        return match;
      }
    );
    
    // Xử lý dynamic import
    content = content.replace(
      /import\s*\(\s*(["'])(\.\.?\/[^"']+)(["'])\s*\)/g,
      (match, quote1, path, quote2) => {
        if (!path.match(/\.(js|json|ts|tsx|jsx)$/) && !path.endsWith('/')) {
          return `import(${quote1}${path}.js${quote2})`;
        }
        return match;
      }
    );
    
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
        fixedCount += await processDirectory(fullPath);
      } else if (stats.isFile() && extname(entry) === '.js') {
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
  const distDir = join(__dirname, '..', 'dist');
  console.log(`Processing directory: ${distDir}`);
  const fixedCount = await processDirectory(distDir);
  console.log(`\n✅ Fixed imports in ${fixedCount} file(s)`);
}

main().catch(console.error);

