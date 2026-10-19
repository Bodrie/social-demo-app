import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { UploadResponse } from '@the-mesh/shared';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { notFound, toApiError, validationError } from '../common/errors.js';
import { UploadPathDto, UploadQueryDto } from './uploads.dto.js';
import { UploadsService } from './uploads.service.js';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** multipart/form-data with a single `file` part; `?kind=` selects the processing preset. */
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  upload(
    @CurrentUser() user: AuthUser,
    @Query() query: UploadQueryDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadResponse> {
    if (!file) throw validationError({ file: 'A file is required' });
    return this.uploads.upload(query.kind, file.buffer, user.id);
  }

  /** Uploads are public and immutable (new content always gets a new key), so they are not rate limited. */
  @Public()
  @SkipThrottle()
  @Get(':kind/:file')
  async serve(
    @Param() params: UploadPathDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const stream = await this.uploads.open(`${params.kind}/${params.file}`);
    if (!stream) throw notFound('File not found');
    // Only a file that exists is immutable; a 404 must not be cached for a year (review L11).
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(stream, {
      type: 'image/webp',
      disposition: 'inline',
    }).setErrorHandler((error, response) => {
      // The file vanished between the existence check and the read: answer with the envelope.
      const body = toApiError(
        error.message.includes('ENOENT') ? notFound('File not found') : error,
      );
      response.statusCode = body.statusCode;
      // `response` is the same object as `res`, typed narrowly by Nest.
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.send(JSON.stringify(body));
    });
  }
}
