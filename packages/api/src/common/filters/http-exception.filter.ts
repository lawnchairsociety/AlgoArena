import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse();
    const request = ctx.getRequest();

    const url = request.url || request.raw?.url || '';
    const method = request.method || request.raw?.method || '';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string' ? response : ((response as Record<string, unknown>).message ?? exception.message);

      reply.status(status).send({
        statusCode: status,
        message,
        error: exception.name,
        timestamp: new Date().toISOString(),
        path: url,
      });
    } else {
      this.logger.error(
        `Unhandled exception on ${method} ${url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      reply.status(500).send({
        statusCode: 500,
        message: 'Internal server error',
        error: 'InternalServerError',
        timestamp: new Date().toISOString(),
        path: url,
      });
    }
  }
}
