import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { ACCESS_COOKIE } from './auth/cookies.js';

export const OPENAPI_PATH = 'api/docs';
export const OPENAPI_JSON_PATH = `${OPENAPI_PATH}/openapi.json`;

/** Swagger UI + JSON document generated from controllers and zod DTOs. Not mounted in production. */
export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    // 3.1: zod writes nullable fields as `type: [..., "null"]`, which 3.0 does not know.
    .setOpenAPIVersion('3.1.0')
    .setTitle('BeSo API')
    .setDescription(
      'REST API of BeSo, a small social network. Browser clients authenticate with the httpOnly access cookie; other clients may send the same token as a Bearer header. Routes marked @Public() need no session.',
    )
    .setVersion('1.0')
    .addCookieAuth(ACCESS_COOKIE, { type: 'apiKey', in: 'cookie', name: ACCESS_COOKIE }, 'cookie')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addSecurityRequirements('cookie')
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '').toLowerCase()}_${methodKey}`,
  });
  SwaggerModule.setup(OPENAPI_PATH, app, cleanupOpenApiDoc(document), {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
  });
}
