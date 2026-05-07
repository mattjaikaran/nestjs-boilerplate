import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode } from '../errors/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    // Prefer errorCode from AppException, fall back to HTTP-status-derived default
    const body =
      typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : { error: raw };
    const errorCode = (body.errorCode as ErrorCode | undefined) ?? httpStatusToErrorCode(status);

    const errorResponse = {
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: body.message ?? body.error ?? raw,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      Sentry.captureException(exception);
    }

    reply.status(status).send(errorResponse);
  }
}

function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 429:
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    case 422:
      return ErrorCode.VALIDATION_FAILED;
    case 400:
      return ErrorCode.VALIDATION_FAILED;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}
