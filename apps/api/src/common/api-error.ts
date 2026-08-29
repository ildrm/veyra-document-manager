import { HttpException, type HttpStatus } from '@nestjs/common';

export class ApiException extends HttpException {
  public constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message, status);
  }
}
