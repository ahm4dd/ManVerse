import { NotFoundError, BadRequestError, ServerError } from '../errors.ts';
import type { Request, Response, NextFunction } from 'express';

export function middlewareError(err: Error, req: Request, res: Response, next: NextFunction) {
  let statusCode = 500;

  if (err instanceof NotFoundError) {
    statusCode = 404;
  } else if (err instanceof BadRequestError) {
    statusCode = 400;
  } else if (err instanceof ServerError) {
    statusCode = 500;
  }

  if (statusCode >= 500) {
    console.error(err.message);
  }

  res.status(statusCode).send({ error: err.message });
  res.end();
}
