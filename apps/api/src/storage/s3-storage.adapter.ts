import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/config.module.js';
import type { QuarantineUpload, StorageAdapter, StoredObjectLocation } from './storage.types.js';

@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly quarantineBucket: string;
  private readonly trustedBucket: string;

  public constructor(config: AppConfigService) {
    this.quarantineBucket = config.values.S3_QUARANTINE_BUCKET;
    this.trustedBucket = config.values.S3_TRUSTED_BUCKET;
    this.client = new S3Client({
      endpoint: config.values.S3_ENDPOINT,
      region: config.values.S3_REGION,
      forcePathStyle: config.values.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.values.S3_ACCESS_KEY_ID,
        secretAccessKey: config.values.S3_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  public async putQuarantine(input: QuarantineUpload): Promise<StoredObjectLocation> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.quarantineBucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.mediaType,
        ServerSideEncryption: 'AES256',
        Metadata: {
          organization_id: input.organizationId,
          security_state: 'quarantined',
        },
      }),
    );
    return { bucket: this.quarantineBucket, objectKey: input.objectKey };
  }

  public async deleteQuarantined(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.quarantineBucket, Key: objectKey }),
    );
  }

  public async readQuarantined(objectKey: string, maximumBytes: number): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.quarantineBucket, Key: objectKey }),
    );
    if ((result.ContentLength ?? maximumBytes + 1) > maximumBytes) {
      throw new Error('Quarantined object exceeds the configured processing limit');
    }
    if (!result.Body) throw new Error('Quarantined object has no body');
    const bytes = await result.Body.transformToByteArray();
    if (bytes.byteLength > maximumBytes) throw new Error('Quarantined object is too large');
    return bytes;
  }

  public async promote(objectKey: string, trustedObjectKey: string): Promise<StoredObjectLocation> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.trustedBucket,
        Key: trustedObjectKey,
        CopySource: `${encodeURIComponent(this.quarantineBucket)}/${objectKey
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
        ServerSideEncryption: 'AES256',
        MetadataDirective: 'REPLACE',
        Metadata: { security_state: 'trusted' },
      }),
    );
    return { bucket: this.trustedBucket, objectKey: trustedObjectKey };
  }

  public createTrustedDownloadUrl(objectKey: string, filename: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.trustedBucket,
        Key: objectKey,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      }),
      { expiresIn: 60 },
    );
  }

  public async readiness(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.quarantineBucket }));
    await this.client.send(new HeadBucketCommand({ Bucket: this.trustedBucket }));
  }
}
