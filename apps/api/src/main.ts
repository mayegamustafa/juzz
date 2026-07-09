import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    // Comma-separated allow-list. The mobile app sends no Origin header, so it is
    // unaffected; this only gates browsers.
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Bind all interfaces: container platforms (Railway, Docker) route to the
  // external interface, and a loopback-only bind fails their healthchecks.
  const port = Number(process.env.PORT ?? 4010);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`QPMS API listening on port ${port} (prefix /api)`);
}
bootstrap();
