import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

interface HealthResult {
  status: 'ok' | 'degraded';
  timestamp: string;
  checks: {
    database: { status: 'up' | 'down'; latencyMs?: number; error?: string };
    redis: { status: 'up' | 'down'; latencyMs?: number; error?: string };
  };
}

@ApiTags('health')
@SkipThrottle({ global: true, payments: true, strict: true })
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Service health check — verifies DB and Redis connectivity' })
  @ApiResponse({ status: 200, description: 'All dependencies healthy' })
  @ApiResponse({ status: 503, description: 'One or more dependencies down' })
  async check(): Promise<HealthResult> {
    const [dbCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allUp = dbCheck.status === 'up' && redisCheck.status === 'up';

    const result: HealthResult = {
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { database: dbCheck, redis: redisCheck },
    };

    if (!allUp) {
      this.logger.warn(`Health check degraded: db=${dbCheck.status} redis=${redisCheck.status}`);
    }

    return result;
  }

  private async checkDatabase(): Promise<{ status: 'up' | 'down'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', latencyMs: Date.now() - start, error: err.message };
    }
  }

  private async checkRedis(): Promise<{ status: 'up' | 'down'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      const client = this.redisService.getClient();
      await client.ping();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'down', latencyMs: Date.now() - start, error: err.message };
    }
  }
}
