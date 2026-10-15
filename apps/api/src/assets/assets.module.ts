import { Global, Module } from '@nestjs/common';
import { AssetsService } from './assets.service.js';

@Global()
@Module({
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
