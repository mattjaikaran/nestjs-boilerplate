import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

export class AppException extends HttpException {
  constructor(
    readonly errorCode: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ errorCode, message }, status);
  }
}
