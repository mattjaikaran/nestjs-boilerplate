import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, unlink } from 'node:fs';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';

export interface UploadedFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  path: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private config: ConfigService) {
    this.uploadDir = config.get('UPLOAD_DIR', 'uploads');
    this.baseUrl = config.get('APP_URL', 'http://localhost:3000');
    mkdirSync(this.uploadDir, { recursive: true });
  }

  async saveFile(file: MultipartFile, subfolder = ''): Promise<UploadedFile> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new AppException(
        ErrorCode.UPLOAD_INVALID_TYPE,
        `File type ${file.mimetype} is not allowed`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const ext = extname(file.filename) || this.mimeToExt(file.mimetype);
    const filename = `${randomUUID()}${ext}`;
    const targetDir = subfolder ? join(this.uploadDir, subfolder) : this.uploadDir;
    mkdirSync(targetDir, { recursive: true });

    const filePath = join(targetDir, filename);
    let size = 0;

    const dest = createWriteStream(filePath);

    try {
      await pipeline(
        file.file,
        async function* (source) {
          for await (const chunk of source) {
            size += chunk.length;
            if (size > MAX_FILE_SIZE) {
              throw new AppException(
                ErrorCode.UPLOAD_TOO_LARGE,
                `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                HttpStatus.BAD_REQUEST,
              );
            }
            yield chunk;
          }
        },
        dest,
      );
    } catch (err) {
      unlink(filePath, (unlinkErr) => {
        if (unlinkErr)
          this.logger.warn(`Failed to clean up partial upload ${filePath}: ${unlinkErr.message}`);
      });
      throw err;
    }

    const relativePath = subfolder ? `${subfolder}/${filename}` : filename;
    const url = `${this.baseUrl}/api/v1/uploads/${relativePath}`;

    this.logger.log(`Saved upload: ${relativePath} (${size} bytes)`);

    return {
      filename,
      originalName: file.filename,
      mimeType: file.mimetype,
      size,
      url,
      path: filePath,
    };
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'text/csv': '.csv',
    };
    return map[mime] ?? '';
  }
}
