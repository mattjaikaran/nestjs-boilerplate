import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, unlink } from 'node:fs';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { StorageProvider, UploadedFile } from '../storage.provider';
import { ALLOWED_MIME_TYPES, mimeToExt } from '../uploads.constants';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  private readonly maxBytes: number;

  constructor(private config: ConfigService) {
    this.uploadDir = config.get<string>('storage.local.uploadDir', 'uploads');
    this.baseUrl = config.get<string>('APP_URL', 'http://localhost:3000');
    this.maxBytes = config.get<number>('storage.maxFileSizeMb', 10) * 1024 * 1024;
    mkdirSync(this.uploadDir, { recursive: true });
  }

  async save(file: MultipartFile, subfolder = ''): Promise<UploadedFile> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new AppException(
        ErrorCode.UPLOAD_INVALID_TYPE,
        `File type ${file.mimetype} is not allowed`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const ext = extname(file.filename) || mimeToExt(file.mimetype);
    const filename = `${randomUUID()}${ext}`;
    const targetDir = subfolder ? join(this.uploadDir, subfolder) : this.uploadDir;
    mkdirSync(targetDir, { recursive: true });

    const filePath = join(targetDir, filename);
    let size = 0;
    const maxBytes = this.maxBytes;

    try {
      await pipeline(
        file.file,
        async function* (source) {
          for await (const chunk of source) {
            size += chunk.length;
            if (size > maxBytes) {
              throw new AppException(
                ErrorCode.UPLOAD_TOO_LARGE,
                `File exceeds maximum size of ${maxBytes / 1024 / 1024}MB`,
                HttpStatus.BAD_REQUEST,
              );
            }
            yield chunk;
          }
        },
        createWriteStream(filePath),
      );
    } catch (err) {
      unlink(filePath, (e) => {
        if (e) this.logger.warn(`Failed to clean up partial upload ${filePath}: ${e.message}`);
      });
      throw err;
    }

    const key = subfolder ? `${subfolder}/${filename}` : filename;
    const url = `${this.baseUrl}/api/v1/uploads/${key}`;
    this.logger.log(`Saved local upload: ${key} (${size} bytes)`);

    return { filename, originalName: file.filename, mimeType: file.mimetype, size, url, key };
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.uploadDir, key);
    await new Promise<void>((resolve, reject) => {
      unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') reject(err);
        else resolve();
      });
    });
  }

  async getSignedUrl(key: string): Promise<string> {
    return `${this.baseUrl}/api/v1/uploads/${key}`;
  }
}
