import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ['log', 'error', 'warn', 'debug'],
  });

  
  
  app.use('/api/webhooks/provider', (req: any, res: any, next: any) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      req.rawBody = Buffer.concat(chunks);
      try {
        req.body = JSON.parse(req.rawBody.toString());
      } catch {
        req.body = {};
      }
      next();
    });
  });

  app.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api/webhooks/')) return next();
    express.json()(req, res, next);
  });
  app.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api/webhooks/')) return next();
    express.urlencoded({ extended: true })(req, res, next);
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Webhook-Signature'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PayRoute API')
    .setDescription('Cross-border payment processing — PayRoute Engineering Assessment')
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'Idempotency-Key', in: 'header' },
      'idempotency-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`PayRoute API running on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
