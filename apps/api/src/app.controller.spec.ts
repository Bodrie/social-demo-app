import { Test, type TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get(AppController);
  });

  it('reports a healthy status with a timestamp', () => {
    const health = appController.getHealth();

    expect(health.status).toBe('ok');
    expect(Number.isNaN(Date.parse(health.timestamp))).toBe(false);
  });
});
