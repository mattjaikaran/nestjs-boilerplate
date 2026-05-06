import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getRequestContext } from '../context/request-context';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  correlationId?: string;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    return next.handle().pipe(
      map((data) => {
        const requestCtx = getRequestContext();
        if (requestCtx?.correlationId) {
          reply.header('x-correlation-id', requestCtx.correlationId);
        }
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          correlationId: requestCtx?.correlationId,
        };
      }),
    );
  }
}
