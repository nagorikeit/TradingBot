import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const getSafeDirname = (): string => {
  try {
    if (typeof __dirname !== 'undefined' && __dirname) {
      return __dirname;
    }
    if (typeof import.meta !== 'undefined' && import.meta?.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return process.cwd();
};

export const getStorageDir = (): string => {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'tradingbot_storage');
  }
  return path.resolve(getSafeDirname(), '../storage');
};

export const ensureDirSafe = (dirPath: string): void => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch {
    // Non-blocking in read-only environments
  }
};

export const readJsonSafe = <T>(filePath: string, fallback: T): T => {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return fallback;
};

export const writeJsonSafe = (filePath: string, data: any): void => {
  try {
    const dir = path.dirname(filePath);
    ensureDirSafe(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Non-blocking in read-only environments
  }
};
