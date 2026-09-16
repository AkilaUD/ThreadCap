import type { ErrorCode } from '@threadcap/shared-types';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

/** Thrown by services for speced error codes (docs/04-api-contracts.md §1.3). */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (code: ErrorCode, message: string) => new ApiError(code, message, HttpStatus.NOT_FOUND);
export const badRequest = (code: ErrorCode, message: string, details?: unknown) => new ApiError(code, message, HttpStatus.BAD_REQUEST, details);

/**
 * Renders every error as the speced envelope:
 * `{ requestId, error: { code, message, details? } }`.
 */
@Catch()
export class BodyErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();

    let code: ErrorCode = 'INTERNAL';
    let message = 'Internal error';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let details: unknown;

    if (exception instanceof ApiError) {
      code = exception.code;
      message = exception.message;
      status = exception.status;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      const body = exception.getResponse();
      status = exception.getStatus();
      if (typeof body === 'string') {
        message = body;
        code = status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : 'INVALID_REQUEST';
      } else {
        const b = body as { message?: unknown; error?: string };
        const raw = Array.isArray(b.message) ? b.message.join('; ') : b.message;
        message =
          typeof raw === 'string'
            ? raw
            : raw && typeof raw === 'object'
              ? JSON.stringify(raw)
              : exception.message;
        code = status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : 'INVALID_REQUEST';
        details = b;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    res.status(status).json({ requestId, error: { code, message, details } });
  }
}