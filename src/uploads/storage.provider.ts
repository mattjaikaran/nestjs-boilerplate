import type { MultipartFile } from '@fastify/multipart';

export interface UploadedFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  key: string; // storage path / S3 key
}

export interface StorageProvider {
  save(file: MultipartFile, subfolder?: string): Promise<UploadedFile>;
  delete(key: string): Promise<void>;
  /** Returns a pre-signed GET URL valid for `ttlSeconds` (S3 only; local returns the public URL). */
  getSignedUrl(key: string, ttlSeconds?: number): Promise<string>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
