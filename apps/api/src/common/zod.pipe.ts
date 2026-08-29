import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  public constructor(private readonly schema: ZodType<T>) {}

  public transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
