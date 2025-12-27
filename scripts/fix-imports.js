import { readdir, readFile, writeFile, stat, access } from 'fs/promises';
import { join, extname, dirname as pathDirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function isDirectory(dirPath) {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function fixImportsInFile(filePath, distDir) {
  try {
    let content = await readFile(filePath, 'utf-8');
    const originalContent = content;
    const fileDir = pathDirname(filePath);
    
    // Xử lý path alias ~/* -> chuyển thành đường dẫn tương đối
    // ~/configs/env -> ../configs/env.js (từ dist/routes/index.js)
    // Các file đã được compile trực tiếp vào dist, không có dist/src
    content = content.replace(
      /from\s+(["'])~(\/[^"']+)(["'])/g,
      (match, quote1, aliasPath, quote2) => {
        // Bỏ dấu / đầu tiên
        const cleanPath = aliasPath.replace(/^\//, '');
        // Tính đường dẫn tương đối từ file hiện tại đến dist/cleanPath
        const targetPath = join(distDir, cleanPath);
        const targetDir = pathDirname(targetPath);
        const fileName = cleanPath.split('/').pop();
        let relativePath = relative(fileDir, targetDir).replace(/\\/g, '/');
        if (!relativePath.startsWith('.')) {
          relativePath = './' + relativePath;
        }
        const finalPath = `${relativePath}/${fileName}`.replace(/\/\//g, '/');
        return `from ${quote1}${finalPath}${quote2}`;
      }
    );
    
    // Xử lý import từ src/ (tsc-alias có thể tạo ra)
    // src/configs/env -> ../configs/env.js (từ dist/routes/index.js)
    content = content.replace(
      /from\s+(["'])src(\/[^"']+)(["'])/g,
      (match, quote1, aliasPath, quote2) => {
        // Bỏ dấu / đầu tiên
        const cleanPath = aliasPath.replace(/^\//, '');
        // Tính đường dẫn tương đối từ file hiện tại đến dist/cleanPath
        const targetPath = join(distDir, cleanPath);
        const targetDir = pathDirname(targetPath);
        const fileName = cleanPath.split('/').pop();
        let relativePath = relative(fileDir, targetDir).replace(/\\/g, '/');
        if (!relativePath.startsWith('.')) {
          relativePath = './' + relativePath;
        }
        const finalPath = `${relativePath}/${fileName}`.replace(/\/\//g, '/');
        return `from ${quote1}${finalPath}${quote2}`;
      }
    );
    
    // Thay thế .ts" thành .js" và .ts' thành .js'
    content = content.replace(/\.ts"/g, '.js"');
    content = content.replace(/\.ts'/g, ".js'");
    
    // Thêm extension .js vào các import paths không có extension
    // Ví dụ: from "./config/env" -> from "./config/env.js"
    // Ví dụ: from "../config/env" -> from "../config/env.js"
    // Nhưng không thêm vào các import từ node_modules hoặc các package bên ngoài
    // Nếu path là thư mục, thêm /index.js thay vì .js
    const importRegex = /from\s+(["'])(\.\.?\/[^"']+)(["'])/g;
    const matches = [...content.matchAll(importRegex)];
    
    for (const match of matches) {
      const [fullMatch, quote1, path, quote2] = match;
      if (!path.match(/\.(js|json|ts|tsx|jsx)$/) && !path.endsWith('/')) {
        const resolvedPath = resolve(fileDir, path);
        const isDir = await isDirectory(resolvedPath);
        
        if (isDir) {
          // Nếu là thư mục, thêm /index.js
          content = content.replace(fullMatch, `from ${quote1}${path}/index.js${quote2}`);
        } else {
          // Nếu không phải thư mục, thêm .js
          content = content.replace(fullMatch, `from ${quote1}${path}.js${quote2}`);
        }
      }
    }
    
    // Xử lý dynamic import
    const dynamicImportRegex = /import\s*\(\s*(["'])(\.\.?\/[^"']+)(["'])\s*\)/g;
    const dynamicMatches = [...content.matchAll(dynamicImportRegex)];
    
    for (const match of dynamicMatches) {
      const [fullMatch, quote1, path, quote2] = match;
      if (!path.match(/\.(js|json|ts|tsx|jsx)$/) && !path.endsWith('/')) {
        const resolvedPath = resolve(fileDir, path);
        const isDir = await isDirectory(resolvedPath);
        
        if (isDir) {
          content = content.replace(fullMatch, `import(${quote1}${path}/index.js${quote2})`);
        } else {
          content = content.replace(fullMatch, `import(${quote1}${path}.js${quote2})`);
        }
      }
    }
    
    // Xử lý dynamic import với path alias
    content = content.replace(
      /import\s*\(\s*(["'])~(\/[^"']+)(["'])\s*\)/g,
      (match, quote1, aliasPath, quote2) => {
        const cleanPath = aliasPath.replace(/^\//, '');
        const targetPath = join(distDir, cleanPath);
        const targetDir = pathDirname(targetPath);
        const fileName = cleanPath.split('/').pop();
        let relativePath = relative(fileDir, targetDir).replace(/\\/g, '/');
        if (!relativePath.startsWith('.')) {
          relativePath = './' + relativePath;
        }
        const finalPath = `${relativePath}/${fileName}`.replace(/\/\//g, '/');
        return `import(${quote1}${finalPath}${quote2})`;
      }
    );
    
    // Xử lý dynamic import từ src/
    content = content.replace(
      /import\s*\(\s*(["'])src(\/[^"']+)(["'])\s*\)/g,
      (match, quote1, aliasPath, quote2) => {
        const cleanPath = aliasPath.replace(/^\//, '');
        const targetPath = join(distDir, cleanPath);
        const targetDir = pathDirname(targetPath);
        const fileName = cleanPath.split('/').pop();
        let relativePath = relative(fileDir, targetDir).replace(/\\/g, '/');
        if (!relativePath.startsWith('.')) {
          relativePath = './' + relativePath;
        }
        const finalPath = `${relativePath}/${fileName}`.replace(/\/\//g, '/');
        return `import(${quote1}${finalPath}${quote2})`;
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

async function processDirectory(dir, distDir) {
  try {
    const entries = await readdir(dir);
    let fixedCount = 0;
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        fixedCount += await processDirectory(fullPath, distDir);
      } else if (stats.isFile() && extname(entry) === '.js') {
        if (await fixImportsInFile(fullPath, distDir)) {
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
  const fixedCount = await processDirectory(distDir, distDir);
  console.log(`\n✅ Fixed imports in ${fixedCount} file(s)`);
}

main().catch(console.error);

