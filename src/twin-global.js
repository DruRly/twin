import { readdir, writeFile, mkdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export function getGlobalTwinDir() {
  return resolve(homedir(), '.twin');
}

export async function ensureGlobalTwinDir() {
  const dir = getGlobalTwinDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Returns the path to the global twin file, or null if none exists.
 * If multiple twins exist, uses the first alphabetically.
 */
export async function findGlobalTwinPath() {
  const dir = getGlobalTwinDir();
  try {
    const files = await readdir(dir);
    const twins = files.filter((f) => f.endsWith('.twin')).sort();
    if (twins.length === 0) return null;
    return resolve(dir, twins[0]);
  } catch {
    return null;
  }
}

/**
 * Resolves the twin file path for a given project directory.
 * Checks ~/.twin/ first, falls back to a local *.twin in cwd.
 */
export async function findTwinPath(cwd) {
  const globalPath = await findGlobalTwinPath();
  if (globalPath) return globalPath;

  try {
    const files = await readdir(cwd);
    const twins = files.filter((f) => f.endsWith('.twin'));
    if (twins.length > 0) return resolve(cwd, twins[0]);
  } catch {}

  return null;
}

/**
 * Acquires an advisory lock on the twin file before writing.
 * Retries up to 5 times with 1s delay. Returns the lock path.
 */
export async function acquireTwinLock(twinPath) {
  const lockPath = twinPath + '.lock';
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 1000;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await writeFile(lockPath, String(process.pid), { flag: 'wx' });
      return lockPath;
    } catch (err) {
      if (err.code === 'EEXIST' && i < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
      } else if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }
  // Stale lock — proceed anyway
  return lockPath;
}

export async function releaseTwinLock(lockPath) {
  try {
    await unlink(lockPath);
  } catch {}
}
