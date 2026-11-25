import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export async function runCommand(command, args, options = {}) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      maxBuffer: MAX_OUTPUT_BYTES,
    });
    return stdout.trim();
  } catch (error) {
    const details = error.stderr?.trim() || error.message;
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${details}`, { cause: error });
  }
}
