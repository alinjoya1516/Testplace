import type { Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

function setup(queryRaw: () => Promise<unknown>) {
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  const status = jest.fn();
  const res = { status } as unknown as Response;
  return { controller: new HealthController(prisma), res, status };
}

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    const { controller, res, status } = setup(() => Promise.resolve([{ '?column?': 1 }]));
    await expect(controller.check(res)).resolves.toEqual({ status: 'ok', db: 'up' });
    expect(status).not.toHaveBeenCalled();
  });

  it('answers 503 when the database is down', async () => {
    const { controller, res, status } = setup(() => Promise.reject(new Error('connection refused')));
    await expect(controller.check(res)).resolves.toEqual({ status: 'error', db: 'down' });
    expect(status).toHaveBeenCalledWith(503);
  });
});
