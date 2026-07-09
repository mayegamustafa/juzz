import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, of, switchMap } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './decorators';

/**
 * Makes mutating requests safe to replay.
 *
 * The mobile app's offline outbox may re-send a request whose response was lost
 * (e.g. the network dropped after the server committed). Clients attach a stable
 * `Idempotency-Key` per queued operation; a replay returns the original response
 * instead of creating a duplicate record.
 *
 * The key row is *reserved before* the handler runs, so the primary-key constraint
 * serializes concurrent replays — a fire-and-forget write after the fact would let
 * a fast retry slip past the lookup.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const key: string | undefined = req.headers?.['idempotency-key'];
    const user = req.user as AuthUser | undefined;

    if (!key || req.method === 'GET' || !user) return next.handle();

    const reserve = this.prisma.idempotencyRecord
      .create({ data: { key, userId: user.id } })
      .then(() => null as Prisma.JsonValue | null)
      .catch(async (e) => {
        if (e?.code !== 'P2002') throw e; // not a duplicate key — surface it
        const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
        // Scope to the caller: a key from one user must never surface another's response.
        if (!existing || existing.userId !== user.id) {
          throw new ConflictException('Idempotency key already used');
        }
        if (existing.response === null) {
          // First attempt is still in flight. Tell the client to retry rather than
          // returning an empty body it would mistake for success.
          throw new ConflictException('Request with this Idempotency-Key is in progress');
        }
        return existing.response;
      });

    return from(reserve).pipe(
      switchMap((replayed) => {
        if (replayed !== null) return of(replayed);

        return next.handle().pipe(
          // Persist the response so a later replay returns exactly this body.
          switchMap((result: unknown) =>
            from(
              this.prisma.idempotencyRecord
                .update({ where: { key }, data: { response: result as Prisma.InputJsonValue } })
                .catch(() => undefined),
            ).pipe(switchMap(() => of(result))),
          ),
          // Handler failed: release the reservation so the client can retry.
          catchError((err) => {
            this.prisma.idempotencyRecord.delete({ where: { key } }).catch(() => undefined);
            throw err;
          }),
        );
      }),
    );
  }
}
