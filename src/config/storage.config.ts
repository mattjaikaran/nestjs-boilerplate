import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  driver: process.env.STORAGE_DRIVER || 'local', // 'local' | 's3'
  local: {
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
  },
  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || '', // Cloudflare R2: https://<accountId>.r2.cloudflarestorage.com
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    publicUrl: process.env.S3_PUBLIC_URL || '', // CDN or public bucket URL prefix
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // required for R2 / MinIO
  },
  maxFileSizeMb: Number.parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10),
}));
