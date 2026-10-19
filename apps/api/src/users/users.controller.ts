import { Controller, Get } from '@nestjs/common';
import type { UserSummary } from '@testplace/shared';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** People who can be assigned a case: readers cannot execute. */
  @Get('assignable')
  assignable(): Promise<UserSummary[]> {
    return this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'EXECUTOR'] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }
}
