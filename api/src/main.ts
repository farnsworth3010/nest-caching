import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CommandsInterceptor, commandLog } from './redis/command-log';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.use((_req: unknown, _res: unknown, next: () => void) => commandLog.run([], next));
  app.useGlobalInterceptors(new CommandsInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
