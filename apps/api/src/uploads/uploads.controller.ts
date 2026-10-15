import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UploadResponse } from '@the-mesh/shared';
import { Public } from '../auth/public.decorator.js';
import { UploadPathDto, UploadQueryDto } from './uploads.dto.js';
import { UploadsService } from './uploads.service.js';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** multipart/form-data with a single `file` field; `?kind=` selects the processing preset. */
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  upload(@Query() query: UploadQueryDto, @UploadedFile() file?: Express.Multer.File): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fields: { file: 'A file is required' },
      });
    }
    return this.uploads.upload(query.kind, file.buffer);
  }

  /** Uploads are public and immutable (new content always gets a new key). */
  @Public()
  @Get(':kind/:file')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async serve(@Param() params: UploadPathDto): Promise<StreamableFile> {
    const stream = await this.uploads.open(`${params.kind}/${params.file}`);
    if (!stream) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'File not found' });
    }
    return new StreamableFile(stream, { type: 'image/webp', disposition: 'inline' });
  }
}
