import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MultipartFile } from '@fastify/multipart';
import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { StorageProvider, UploadedFile } from '../storage.provider';
import { ALLOWED_MIME_TYPES, mimeToExt } from '../uploads.constants';

@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(S3StorageProvider.name);
  private client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly maxBytes: number;

  constructor(private config: ConfigService) {
    const s3 = config.get('storage.s3') as {
      bucket: string;
      region: string;
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicUrl: string;
      forcePathStyle: boolean;
    };

    this.bucket = s3.bucket;
    this.publicUrl = s3.publicUrl;
    this.maxBytes = config.get<number>('storage.maxFileSizeMb', 10) * 1024 * 1024;

    this.client = new S3Client({
      region: s3.region,
      ...(s3.endpoint ? { endpoint: s3.endpoint } : {}),
      credentials: {
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
      },
      forcePathStyle: s3.forcePathStyle,
    });
  }

  onModuleInit() {
    if (!this.bucket) {
      this.logger.warn('S3_BUCKET is not set — uploads will fail at runtime');
    }
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
    const key = subfolder ? `${subfolder}/${filename}` : filename;

    // Buffer the stream to enforce size limit and get byte length for S3
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of file.file) {
      size += chunk.length;
      if (size > this.maxBytes) {
        throw new AppException(
          ErrorCode.UPLOAD_TOO_LARGE,
          `File exceeds maximum size of ${this.maxBytes / 1024 / 1024}MB`,
          HttpStatus.BAD_REQUEST,
        );
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const body = Buffer.concat(chunks);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: file.mimetype,
        ContentLength: size,
      }),
    );

    const url = this.publicUrl
      ? `${this.publicUrl.replace(/\/$/, '')}/${key}`
      : await this.getSignedUrl(key, 3600);

    this.logger.log(`Uploaded to S3: ${key} (${size} bytes)`);

    return { filename, originalName: file.filename, mimeType: file.mimetype, size, url, key };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  }
}
