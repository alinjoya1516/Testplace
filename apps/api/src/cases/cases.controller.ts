import { Controller, Get, Param, Query } from '@nestjs/common';
import type { TestCaseDetail, TestCaseList } from '@testplace/shared';
import { z } from 'zod';
import { validate } from '../common/validation';
import { CasesService } from './cases.service';

const oneOrMany = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => (value === undefined ? [] : [value].flat()));

const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  // Accepted with or without the leading @.
  tag: oneOrMany.transform((tags) =>
    tags.map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith('@') ? t : `@${t}`)),
  ),
  priority: z.string().trim().min(1).optional(),
  status: z.enum(['READY', 'DRAFT', 'RETIRED']).optional(),
  requirement: z.string().trim().min(1).optional(),
});

const detailQuerySchema = z.object({
  version: z.coerce.number().int().positive().optional(),
});

@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(@Query() query: unknown): Promise<TestCaseList> {
    const { q, tag, priority, status, requirement } = validate(listQuerySchema, query);
    return this.cases.list({ q: q || undefined, tags: tag, priority, status, requirement });
  }

  @Get(':id')
  get(@Param('id') id: string, @Query() query: unknown): Promise<TestCaseDetail> {
    return this.cases.get(id, validate(detailQuerySchema, query).version);
  }
}
