import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { CommandsInterceptor, commandLog } from './redis/command-log';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.use((_req: unknown, _res: unknown, next: () => void) => commandLog.run([], next));
  app.useGlobalInterceptors(new CommandsInterceptor());

  // The container image serves the built web app itself; in dev Vite does.
  if (process.env.WEB_DIST) app.useStaticAssets(process.env.WEB_DIST);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
