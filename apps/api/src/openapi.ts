import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export const OPENAPI_PATH = 'api/docs';
export const OPENAPI_JSON_PATH = `${OPENAPI_PATH}/openapi.json`;

/** Swagger UI + JSON document generated from controllers and zod DTOs. Not mounted in production. */
export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('The Mesh API')
    .setDescription('Social network demo app – REST API')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(OPENAPI_PATH, app, cleanupOpenApiDoc(document), {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
  });
}
