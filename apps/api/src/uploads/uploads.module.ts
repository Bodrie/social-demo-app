import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Env } from '../config/env.js';
import { ImageProcessor } from './image-processor.js';
import { LocalStorageService } from './local-storage.service.js';
import { STORAGE } from './storage.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.get('UPLOAD_MAX_BYTES', { infer: true }), files: 1 },
      }),
    }),
  ],
  controllers: [UploadsController],
  providers: [{ provide: STORAGE, useClass: LocalStorageService }, ImageProcessor, UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
