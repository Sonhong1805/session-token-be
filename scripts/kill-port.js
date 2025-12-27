import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function killPort(port) {
  try {
    // Windows command to find and kill process on port
    const { stdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
    
    if (!stdout.trim()) {
      console.log(`✅ Port ${port} is not in use.`);
      return;
    }

    // Extract PID from output
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(pid)) {
        pids.add(pid);
      }
    });

    if (pids.size === 0) {
      console.log(`⚠️  Could not find PID for port ${port}`);
      return;
    }

    // Kill all processes
    for (const pid of pids) {
      try {
        await execAsync(`taskkill /F /PID ${pid}`);
        console.log(`✅ Killed process ${pid} on port ${port}`);
      } catch (error) {
        console.log(`⚠️  Could not kill process ${pid}: ${error.message}`);
      }
    }
  } catch (error) {
    if (error.message.includes('findstr')) {
      console.log(`✅ Port ${port} is not in use.`);
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

const port = process.argv[2] || 8000;
killPort(port);

