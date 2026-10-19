import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import type { CampaignDetail, CampaignSummary, SelectionPreview } from '@testplace/shared';
import { z } from 'zod';
import { CurrentUser, type CurrentUserInfo } from '../auth/current-user';
import { validate } from '../common/validation';
import { CampaignsService } from './campaigns.service';

const text = (max: number) => z.string().trim().min(1, 'obligatoire').max(max);
const isoDate = z.iso.date('date attendue au format AAAA-MM-JJ').nullable().default(null);
const selectionFields = {
  tagExpression: z.string().trim().max(500).default(''),
  includeDrafts: z.boolean().default(false),
};

const campaignInputSchema = z
  .object({
    name: text(200),
    build: text(100),
    environment: text(100),
    ...selectionFields,
    plannedStart: isoDate,
    plannedEnd: isoDate,
  })
  .refine((c) => !c.plannedStart || !c.plannedEnd || c.plannedStart <= c.plannedEnd, {
    message: 'la date de fin prévue précède la date de début',
    path: ['plannedEnd'],
  });

const previewSchema = z.object(selectionFields);

const assignmentSchema = z.object({
  executionIds: z.array(z.number().int().positive()).min(1, 'au moins une exécution'),
  assigneeId: z.string().min(1).nullable(),
});

const duplicateSchema = z.object({
  build: text(100),
  name: text(200).optional(),
});

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(): Promise<CampaignSummary[]> {
    return this.campaigns.list();
  }

  /** Number of cases an expression selects, shown while the campaign is being written (EF-06). */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() body: unknown): Promise<SelectionPreview> {
    const { tagExpression, includeDrafts } = validate(previewSchema, body);
    return this.campaigns.preview(tagExpression, includeDrafts);
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() user: CurrentUserInfo): Promise<CampaignDetail> {
    return this.campaigns.create(validate(campaignInputSchema, body), user.id);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): Promise<CampaignDetail> {
    return this.campaigns.get(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown): Promise<CampaignDetail> {
    return this.campaigns.update(id, validate(campaignInputSchema, body));
  }

  @Post(':id/launch')
  @HttpCode(HttpStatus.OK)
  launch(@Param('id', ParseIntPipe) id: number): Promise<CampaignDetail> {
    return this.campaigns.launch(id);
  }

  @Post(':id/assignments')
  @HttpCode(HttpStatus.OK)
  assign(@Param('id', ParseIntPipe) id: number, @Body() body: unknown): Promise<CampaignDetail> {
    const { executionIds, assigneeId } = validate(assignmentSchema, body);
    return this.campaigns.assign(id, executionIds, assigneeId);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(@Param('id', ParseIntPipe) id: number): Promise<CampaignDetail> {
    return this.campaigns.close(id);
  }

  @Post(':id/duplicate')
  duplicate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserInfo,
  ): Promise<CampaignDetail> {
    const { build, name } = validate(duplicateSchema, body);
    return this.campaigns.duplicate(id, build, name, user.id);
  }
}
