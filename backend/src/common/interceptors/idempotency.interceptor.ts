import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { IdempotencyKey } from '../entities/idempotency-key.entity';
import { RedisService } from '../../redis/redis.service';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; 
const LOCK_TTL_MS = 30_000; 


@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
    private readonly redisService: RedisService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const key: string = request.headers['idempotency-key'];

    if (!key) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const cacheKey = `idempotency:${key}`;
    const lockKey = `idempotency:lock:${key}`;

    
    const cached = await this.redisService.getObject<{ body: unknown; statusCode: number }>(cacheKey);
    if (cached) {
      this.logger.log(`Idempotency cache hit (Redis): ${key}`);
      response.status(cached.statusCode || 201);
      return of(cached.body);
    }

    
    const lockToken = await this.redisService.acquireLock(lockKey, LOCK_TTL_MS);

    if (lockToken === null) {
      
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise((r) => setTimeout(r, 250));
        const polled = await this.redisService.getObject<{ body: unknown; statusCode: number }>(cacheKey);
        if (polled) {
          this.logger.log(`Idempotency resolved after polling (attempt ${attempt + 1}): ${key}`);
          response.status(polled.statusCode || 201);
          return of(polled.body);
        }
      }

      throw new ConflictException(
        'This idempotency key is being processed by a concurrent request. Please retry in a moment.',
      );
    }

    
    try {
      const dbRecord = await this.repo.findOne({ where: { key } });
      if (dbRecord?.responseBody !== null && dbRecord?.responseBody !== undefined) {
        this.logger.log(`Idempotency cache hit (DB fallback): ${key}`);
        await this.redisService.setObject(
          cacheKey,
          { body: dbRecord.responseBody, statusCode: dbRecord.statusCode },
          IDEMPOTENCY_TTL_MS,
        ).catch(() => {});
        await this.redisService.releaseLock(lockKey, lockToken).catch(() => {});
        response.status(dbRecord.statusCode || 201);
        return of(dbRecord.responseBody);
      }

      
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(IdempotencyKey)
        .values({ key, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS) })
        .orIgnore()
        .execute();
    } catch (err) {
      this.logger.warn(`Idempotency pre-check error for key=${key}: ${err.message}`);
    }

    request.idempotencyKey = key;

    return next.handle().pipe(
      tap(async (data) => {
        const statusCode = response.statusCode || 201;
        try {
          await Promise.all([
            this.repo.update({ key }, { responseBody: data, statusCode }),
            this.redisService.setObject(cacheKey, { body: data, statusCode }, IDEMPOTENCY_TTL_MS),
          ]);
        } catch (err) {
          this.logger.error(`Failed to persist idempotency response for key=${key}: ${err.message}`);
        } finally {
          await this.redisService.releaseLock(lockKey, lockToken).catch(() => {});
        }
      }),
      catchError(async (err) => {
        await this.redisService.releaseLock(lockKey, lockToken).catch(() => {});
        throw err;
      }),
    );
  }
}
