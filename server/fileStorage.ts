import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface StorageProvider {
  save(filename: string, buffer: Buffer): Promise<string>;
  read(filePath: string): Promise<Buffer>;
  delete(filePath: string): Promise<void>;
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export class LocalStorageProvider implements StorageProvider {
  constructor() {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async save(filename: string, buffer: Buffer): Promise<string> {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${randomUUID()}_${sanitized}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  async read(filePath: string): Promise<Buffer> {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
      throw new Error("Path traversal detected");
    }
    return fs.promises.readFile(resolved);
  }

  async delete(filePath: string): Promise<void> {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
      throw new Error("Path traversal detected");
    }
    try {
      await fs.promises.unlink(resolved);
    } catch (e) {
      // File may already be deleted
    }
  }
}

export const fileStorage = new LocalStorageProvider();
