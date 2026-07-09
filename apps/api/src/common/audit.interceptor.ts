import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './decorators';

/** Records every mutating (non-GET) request to the AuditLog table. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;

    if (method === 'GET' || method === 'OPTIONS') return next.handle();

    const user = req.user as AuthUser | undefined;
    const action =
      method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE';
    const entity = (req.route?.path ?? req.url).split('/').filter(Boolean)[1] ?? 'unknown';

    return next.handle().pipe(
      tap((result: any) => {
        this.prisma.auditLog
          .create({
            data: {
              actorId: user?.id ?? null,
              action,
              entity,
              entityId: result?.id ?? req.params?.id ?? null,
              diff: safeBody(req.body),
              ip: req.ip,
            },
          })
          .catch(() => undefined); // never block the response on audit failure
      }),
    );
  }
}

function safeBody(body: unknown): any {
  if (!body || typeof body !== 'object') return null;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const k of Object.keys(clone)) {
    if (/password/i.test(k)) clone[k] = '***';
  }
  return clone;
}
