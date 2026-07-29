import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(helmet());
  // Comma-separated allow-list. The mobile app sends no Origin header, so it is
  // unaffected; this only gates browsers.
  //
  // Trailing slashes are stripped because an Origin header is only ever
  // scheme://host:port. Configuring "https://example.org/" (the form you get by
  // copying a URL out of the address bar) would otherwise match nothing, and
  // the browser reports that as a bare CORS failure with no hint as to why.
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
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
  // Printed so a browser CORS failure can be diagnosed from the deploy log
  // instead of by guessing at the variable's value.
  // eslint-disable-next-line no-console
  console.log(`CORS allow-list: ${allowedOrigins.join(', ')}`);
}
bootstrap();
