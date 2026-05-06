import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getRequestContext } from '../context/request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const res = context.switchToHttp().getResponse<FastifyReply>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const ctx = getRequestContext();
          this.logger.log(
            `${method} ${url} → ${res.statusCode} ${ms}ms${ctx?.correlationId ? ` [${ctx.correlationId}]` : ''}`,
          );
        },
        error: (err: Error) => {
          const ms = Date.now() - start;
          const ctx = getRequestContext();
          this.logger.error(
            `${method} ${url} → ${ms}ms | ${err.message}${ctx?.correlationId ? ` [${ctx.correlationId}]` : ''}`,
          );
        },
      }),
    );
  }
}
