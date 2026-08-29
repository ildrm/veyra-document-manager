import { Global, Module } from '@nestjs/common';

import { S3StorageAdapter } from './s3-storage.adapter.js';
import { STORAGE_ADAPTER } from './storage.types.js';

@Global()
@Module({
  providers: [S3StorageAdapter, { provide: STORAGE_ADAPTER, useExisting: S3StorageAdapter }],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
