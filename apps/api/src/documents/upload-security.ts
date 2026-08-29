import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { HttpStatus } from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';

import { ApiException } from '../common/api-error.js';

const allowedMediaTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export interface InspectedUpload {
  readonly body: Readable;
  readonly safeFilename: string;
  readonly mediaType: string;
  readonly completed: Promise<{ readonly byteSize: number; readonly sha256: string }>;
}

export async function inspectUpload(
  file: MultipartFile,
  maximumBytes: number,
): Promise<InspectedUpload> {
  if (!allowedMediaTypes.has(file.mimetype)) {
    throw new ApiException(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'UNSUPPORTED_FILE_TYPE',
      'Only PDF, DOCX, and plain text files are accepted',
    );
  }

  const safeFilename = normalizeFilename(file.filename);
  const iterator = file.file[Symbol.asyncIterator]();
  const initial: Buffer[] = [];
  let initialBytes = 0;
  while (initialBytes < 16) {
    const next = await iterator.next();
    if (next.done) break;
    const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
    initial.push(chunk);
    initialBytes += chunk.length;
    if (initialBytes > maximumBytes) throw tooLarge(maximumBytes);
  }
  if (initialBytes === 0) {
    throw new ApiException(HttpStatus.BAD_REQUEST, 'EMPTY_UPLOAD', 'The uploaded file is empty');
  }

  const prefix = Buffer.concat(initial).subarray(0, 16);
  validateSignature(file.mimetype, prefix);

  let resolveCompleted!: (value: { readonly byteSize: number; readonly sha256: string }) => void;
  let rejectCompleted!: (reason: unknown) => void;
  const completed = new Promise<{ readonly byteSize: number; readonly sha256: string }>(
    (resolve, reject) => {
      resolveCompleted = resolve;
      rejectCompleted = reject;
    },
  );
  const hash = createHash('sha256');

  const body = Readable.from(
    (async function* secureStream(): AsyncGenerator<Buffer> {
      let byteSize = 0;
      try {
        for (const chunk of initial) {
          byteSize += chunk.length;
          hash.update(chunk);
          yield chunk;
        }
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
          byteSize += chunk.length;
          if (byteSize > maximumBytes) throw tooLarge(maximumBytes);
          hash.update(chunk);
          yield chunk;
        }
        if (file.file.truncated) throw tooLarge(maximumBytes);
        resolveCompleted({ byteSize, sha256: hash.digest('hex') });
      } catch (error) {
        rejectCompleted(error);
        throw error;
      }
    })(),
  );

  return { body, safeFilename, mediaType: file.mimetype, completed };
}

function validateSignature(mediaType: string, prefix: Buffer): void {
  const pdf = prefix.subarray(0, 5).toString('ascii') === '%PDF-';
  const zip =
    prefix.length >= 4 &&
    prefix[0] === 0x50 &&
    prefix[1] === 0x4b &&
    ((prefix[2] === 0x03 && prefix[3] === 0x04) ||
      (prefix[2] === 0x05 && prefix[3] === 0x06) ||
      (prefix[2] === 0x07 && prefix[3] === 0x08));
  const plainText = !prefix.includes(0) && isValidUtf8(prefix);
  const valid =
    (mediaType === 'application/pdf' && pdf) ||
    (mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      zip) ||
    (mediaType === 'text/plain' && plainText);
  if (!valid) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'FILE_SIGNATURE_MISMATCH',
      'The file signature does not match its declared media type',
    );
  }
}

function isValidUtf8(value: Buffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeFilename(value: string): string {
  const basename = value.normalize('NFKC').split(/[\\/]/).at(-1) ?? 'upload';
  const safe = basename
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 180);
  if (!safe || safe === '.' || safe === '..') {
    throw new ApiException(HttpStatus.BAD_REQUEST, 'INVALID_FILENAME', 'Filename is invalid');
  }
  return safe;
}

function tooLarge(maximumBytes: number): ApiException {
  return new ApiException(
    HttpStatus.PAYLOAD_TOO_LARGE,
    'UPLOAD_TOO_LARGE',
    `The file exceeds the ${maximumBytes} byte upload limit`,
  );
}
