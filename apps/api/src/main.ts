import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: false });
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], credentials: true });
  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port);
  console.log(`[api] listening on :${port} (REST /v1 + MCP /mcp, D-021)`);
}

void bootstrap();