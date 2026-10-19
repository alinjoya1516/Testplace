import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/** Validates a request body or query, answering 400 with readable messages. */
export function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException(
      result.error.issues
        .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')} : ${issue.message}` : issue.message))
        .join(' '),
    );
  }
  return result.data;
}
