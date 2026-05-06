import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { requestContextStorage } from '../context/request-context';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const correlationId =
      (request.headers['x-correlation-id'] as string) ??
      (request.headers['x-request-id'] as string) ??
      uuidv4();

    const user = (request as unknown as { user?: { id?: string; role?: string } }).user;

    return new Observable((subscriber) => {
      requestContextStorage.run(
        {
          correlationId,
          userId: user?.id,
          userRole: user?.role,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          startTime: Date.now(),
        },
        () => {
          next
            .handle()
            .pipe()
            .subscribe({
              next: (val) => subscriber.next(val),
              error: (err) => subscriber.error(err),
              complete: () => subscriber.complete(),
            });
        },
      );
    });
  }
}
