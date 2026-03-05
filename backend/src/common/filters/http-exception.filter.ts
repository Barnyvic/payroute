import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        details = Array.isArray(resp.message) ? resp.message : resp.details;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = 'Internal server error';
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    } else {
      message = 'Internal server error';
    }

    response.status(status).json({
      statusCode: status,
      message,
      details: details || undefined,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
