async function testDbConfig() {
  // Import từ dist sau khi build, hoặc từ src nếu chạy với tsx
  let ENV;
  try {
    // Thử import từ dist (sau khi build)
    const envModule = await import("../dist/config/env.js");
    ENV = envModule.ENV;
  } catch {
    // Fallback: import từ src (nếu chạy với tsx)
    try {
      const envModule = await import("../src/config/env.ts");
      ENV = envModule.ENV;
    } catch {
      console.error("Cannot import ENV. Please run 'npm run build' first.");
      process.exit(1);
    }
  }

  console.log("=== Testing Database Configuration ===\n");

// Test 1: Kiểm tra các biến môi trường
console.log("1. Environment Variables:");
console.log(`   DATABASE_URL: ${ENV.databaseUrl ? "✓ Set" : "✗ Not set"}`);
console.log(`   DB_HOST: ${ENV.dbHost || "Not set"}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || "Not set"}`);
console.log(`   DB_USER: ${ENV.dbUser || "Not set"}`);
console.log(`   DB_NAME: ${ENV.dbName || "Not set"}`);
console.log(`   DB_PASSWORD: ${ENV.dbPassword ? "***" : "Not set"}\n`);

// Test 2: Parse DATABASE_URL nếu có
if (ENV.databaseUrl && ENV.databaseUrl.trim()) {
  console.log("2. Parsing DATABASE_URL:");
  let databaseUrl = ENV.databaseUrl.trim();
  
  // Xử lý JDBC URL format
  if (databaseUrl.startsWith("jdbc:mysql://")) {
    console.log("   Format: JDBC URL detected");
    databaseUrl = databaseUrl.replace("jdbc:mysql://", "mysql://");
    console.log(`   Converted to: ${databaseUrl.substring(0, 50)}...`);
  } else if (databaseUrl.startsWith("mysql://")) {
    console.log("   Format: Standard MySQL URL");
  } else {
    console.log("   Format: Unknown, will add mysql:// prefix");
    databaseUrl = `mysql://${databaseUrl}`;
  }
  
  try {
    const url = new URL(databaseUrl);
    const parsed = {
      host: url.hostname || ENV.dbHost || "",
      port: url.port ? Number(url.port) : (Number(process.env.DB_PORT) || 3306),
      user: decodeURIComponent(url.username || ENV.dbUser || ""),
      password: url.password ? "***" : "Not in URL",
      dbName: url.pathname.slice(1) || ENV.dbName || "",
    };
    
    // Clean database name
    if (parsed.dbName) {
      const parts = parsed.dbName.split('/');
      const firstPart = parts[0] || "";
      const cleanedParts = firstPart.split('?');
      parsed.dbName = (cleanedParts[0] || "").trim();
    }
    
    console.log("   Parsed values:");
    console.log(`     Host: ${parsed.host}`);
    console.log(`     Port: ${parsed.port}`);
    console.log(`     User: ${parsed.user}`);
    console.log(`     Password: ${parsed.password}`);
    console.log(`     Database: ${parsed.dbName}`);
    
    // Validate
    if (!parsed.host || !parsed.dbName || parsed.dbName.includes('://')) {
      console.log("\n   ⚠️  WARNING: Invalid parsed values!");
    } else {
      console.log("\n   ✓ Parsed successfully!");
    }
  } catch (error) {
    console.log(`   ✗ Error parsing URL: ${error.message}`);
  }
} else {
  console.log("2. DATABASE_URL not set, will use individual env vars");
}

console.log("\n3. Final Connection Configuration:");
const finalConfig = {
  host: ENV.dbHost || "Not set",
  port: Number(process.env.DB_PORT) || 3308,
  user: ENV.dbUser || "Not set",
  dbName: ENV.dbName || "Not set",
  password: ENV.dbPassword ? "***" : "Not set",
};

console.log(`   Host: ${finalConfig.host}`);
console.log(`   Port: ${finalConfig.port}`);
console.log(`   User: ${finalConfig.user}`);
console.log(`   Database: ${finalConfig.dbName}`);
console.log(`   Password: ${finalConfig.password}`);

  // Test 3: Kiểm tra kết nối (nếu có thể)
  console.log("\n4. Connection Test:");
  console.log("   Run 'npm start' to test actual database connection");
  console.log("   Or check logs when deploying to Render\n");
}

testDbConfig().catch(console.error);

