import type { MultipartFile } from '@fastify/multipart';
import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_PROVIDER, type StorageProvider, type UploadedFile } from './storage.provider';

export type { UploadedFile };

@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  saveFile(file: MultipartFile, subfolder = ''): Promise<UploadedFile> {
    return this.storage.save(file, subfolder);
  }

  deleteFile(key: string): Promise<void> {
    return this.storage.delete(key);
  }

  getSignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
    return this.storage.getSignedUrl(key, ttlSeconds);
  }
}
