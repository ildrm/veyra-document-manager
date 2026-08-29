import { z } from 'zod';
import { HttpStatus } from '@nestjs/common';

import { ApiException } from '../common/api-error.js';

const CursorSchema = z.object({
  updatedAt: z.iso.datetime(),
  id: z.uuid(),
});

export interface DocumentCursor {
  readonly updatedAt: string;
  readonly id: string;
}

export function decodeCursor(cursor: string | undefined): DocumentCursor | undefined {
  if (!cursor) return undefined;
  try {
    return CursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  } catch {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'INVALID_CURSOR',
      'Pagination cursor is invalid',
    );
  }
}

export function encodeCursor(cursor: DocumentCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}
