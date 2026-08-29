import { Readable } from 'node:stream';
import type { MultipartFile } from '@fastify/multipart';
import { describe, expect, it } from 'vitest';

import { inspectUpload } from '../src/documents/upload-security.js';

function multipart(content: Buffer, mimetype: string, filename = 'contract.pdf'): MultipartFile {
  const file = Readable.from([content]) as MultipartFile['file'];
  file.truncated = false;
  return {
    type: 'file',
    fieldname: 'file',
    filename,
    encoding: '7bit',
    mimetype,
    file,
    fields: {},
    toBuffer: async () => content,
  } as MultipartFile;
}

describe('secure upload inspection', () => {
  it('streams a PDF while calculating its exact SHA-256 and byte size', async () => {
    const content = Buffer.from('%PDF-1.7\ncontract evidence');
    const inspected = await inspectUpload(multipart(content, 'application/pdf'), 1_024);
    const received: Buffer[] = [];
    for await (const chunk of inspected.body) received.push(Buffer.from(chunk));
    await expect(inspected.completed).resolves.toMatchObject({ byteSize: content.length });
    expect(Buffer.concat(received)).toEqual(content);
  });

  it('rejects a declared PDF whose magic bytes do not match', async () => {
    await expect(
      inspectUpload(multipart(Buffer.from('not actually a pdf'), 'application/pdf'), 1_024),
    ).rejects.toThrow('signature does not match');
  });
});
