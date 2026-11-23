import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Responde erro como problem+json (RFC 9457), mesmo formato dos templates Java e Go. */
export function sendProblem(
  host: ArgumentsHost,
  status: number,
  detail: string,
) {
  const http = host.switchToHttp();
  const req = http.getRequest<Request>();
  http
    .getResponse<Response>()
    .status(status)
    .type('application/problem+json')
    .json({
      type: 'about:blank',
      title: STATUS_CODES[status],
      status,
      detail,
      instance: req.originalUrl.split('?')[0],
    });
}

/** Global: HttpException (validação, guards, 404...) e qualquer erro inesperado (500). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const detail =
        typeof body === 'string'
          ? body
          : [
              (body as { message?: string | string[] }).message ??
                exception.message,
            ]
              .flat()
              .join('; ');
      sendProblem(host, exception.getStatus(), detail);
      return;
    }
    this.logger.error(exception);
    sendProblem(host, 500, 'Erro interno');
  }
}
