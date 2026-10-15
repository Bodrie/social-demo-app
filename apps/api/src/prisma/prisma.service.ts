import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
        application_name: 'the-mesh-api',
        max: 10,
        // Fail fast instead of queueing forever when the pool is exhausted.
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 30_000,
        // A runaway query must not hold a connection indefinitely.
        statement_timeout: 15_000,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Runs after the HTTP server stopped accepting connections, so in-flight requests finish first. */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log({ signal }, 'Disconnecting from the database');
    await this.$disconnect();
  }
}
