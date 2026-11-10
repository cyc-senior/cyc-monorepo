import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Response } from 'express'

import { Prisma } from '../../generated/prisma/client'
import { logEvent } from '../logging/log-event'

interface Mapped {
  status: HttpStatus
  message: string
}

/**
 * Maps expected database errors to HTTP errors instead of a bare 500.
 *
 * A `PrismaClientValidationError` here means a value the DTO let through (for
 * example an explicit `null` for a required column) was rejected by Prisma:
 * the client's fault, so 400.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Prisma')

  catch(
    exception:
      Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ): void {
    const { status, message } = this.map(exception)
    const code = 'code' in exception ? exception.code : 'validation'
    if (status >= 500) {
      this.logger.error(
        logEvent('db.request_failed', { code, error: exception.message }),
        exception.stack,
      )
    } else {
      this.logger.debug(logEvent('db.request_rejected', { code, status }))
    }

    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
    })
  }

  private map(
    exception:
      Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
  ): Mapped {
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'One or more fields have an invalid value.',
      }
    }

    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'A record with the same unique value already exists.',
        }
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          message:
            'The operation conflicts with a related record (it is still in use or does not exist).',
        }
      case 'P2025': {
        const model = (exception.meta as { modelName?: string } | undefined)
          ?.modelName

        return {
          status: HttpStatus.NOT_FOUND,
          message: model ? `${model} not found.` : 'Record not found.',
        }
      }
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        }
    }
  }
}
