import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_KEY, type AuditMetadata } from '../decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMetadata | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.id;
    const ipAddress: string | undefined = req.ip;
    const userAgent: string | undefined = req.headers?.['user-agent'];

    return next.handle().pipe(
      tap((responseBody) => {
        const resourceId = req.params?.id ?? (responseBody as Record<string, unknown> | null)?.id;

        this.auditService
          .log({
            userId,
            action: meta.action,
            resource: meta.resource,
            resourceId: typeof resourceId === 'string' ? resourceId : undefined,
            ipAddress,
            userAgent,
          })
          .catch(() => {
            /* already logged inside AuditService */
          });
      }),
    );
  }
}
