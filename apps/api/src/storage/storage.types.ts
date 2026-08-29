import type { Readable } from 'node:stream';

export interface QuarantineUpload {
  readonly organizationId: string;
  readonly objectKey: string;
  readonly mediaType: string;
  readonly body: Readable;
}

export interface StoredObjectLocation {
  readonly bucket: string;
  readonly objectKey: string;
}

export interface StorageAdapter {
  putQuarantine(input: QuarantineUpload): Promise<StoredObjectLocation>;
  readQuarantined(objectKey: string, maximumBytes: number): Promise<Uint8Array>;
  deleteQuarantined(objectKey: string): Promise<void>;
  promote(objectKey: string, trustedObjectKey: string): Promise<StoredObjectLocation>;
  createTrustedDownloadUrl(objectKey: string, filename: string): Promise<string>;
  readiness(): Promise<void>;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
