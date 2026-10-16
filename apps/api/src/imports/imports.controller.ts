import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  ImportRevisionDetail,
  ImportRevisionSummary,
} from '@testplace/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, type CurrentUserInfo } from '../auth/current-user';
import { ImportsService } from './imports.service';

const importBodySchema = z.object({
  gitCommit: z
    .string()
    .regex(/^[0-9a-f]{7,40}$/i, 'gitCommit doit être un identifiant de commit Git (7 à 40 caractères hexadécimaux).')
    .optional(),
});

@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  /** Answers 201 when the import is applied and 422 when it is rejected, with the report in both cases. */
  @Post()
  @UseInterceptors(FileInterceptor('archive'))
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserInfo,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ImportRevisionDetail> {
    if (!file) throw new BadRequestException('Fichier manquant : envoyer l’archive dans le champ « archive ».');
    const parsedBody = importBodySchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.issues.map((issue) => issue.message).join(' '));
    }
    const revision = await this.imports.importArchive({
      data: file.buffer,
      archiveName: file.originalname.slice(0, 255),
      gitCommit: parsedBody.data.gitCommit ?? null,
      authorId: user.id,
    });
    if (revision.status === 'REJECTED') res.status(HttpStatus.UNPROCESSABLE_ENTITY);
    return revision;
  }

  @Get()
  list(): Promise<ImportRevisionSummary[]> {
    return this.imports.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): Promise<ImportRevisionDetail> {
    return this.imports.get(id);
  }
}
