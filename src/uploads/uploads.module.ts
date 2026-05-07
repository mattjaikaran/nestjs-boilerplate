import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './providers/local.storage';
import { S3StorageProvider } from './providers/s3.storage';
import { STORAGE_PROVIDER } from './storage.provider';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService, local: LocalStorageProvider, s3: S3StorageProvider) => {
        const driver = config.get<string>('storage.driver', 'local');
        return driver === 's3' ? s3 : local;
      },
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
    },
    UploadsService,
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
