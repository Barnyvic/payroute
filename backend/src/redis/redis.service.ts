import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

const LOCK_PREFIX = 'lock:';
const CACHE_PREFIX = 'cache:';


const RELEASE_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;


@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      maxRetriesPerRequest: 1,
      lazyConnect: false,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }

  
  async acquireLock(key: string, ttlMs = 10_000): Promise<string | null> {
    const fullKey = `${LOCK_PREFIX}${key}`;
    const token = randomUUID();
    const result = await this.client.set(fullKey, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  
  async releaseLock(key: string, token: string): Promise<void> {
    const fullKey = `${LOCK_PREFIX}${key}`;
    await this.client.eval(RELEASE_LOCK_SCRIPT, 1, fullKey, token);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(`${CACHE_PREFIX}${key}`);
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    const fullKey = `${CACHE_PREFIX}${key}`;
    if (ttlMs) {
      await this.client.set(fullKey, value, 'PX', ttlMs);
    } else {
      await this.client.set(fullKey, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(`${CACHE_PREFIX}${key}`);
  }

  async getObject<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setObject(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlMs);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const fullPattern = `${CACHE_PREFIX}${pattern}`;
    let deleted = 0;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.client.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');

    return deleted;
  }
}
