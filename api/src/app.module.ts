import { Module } from '@nestjs/common';
import { CacheController } from './cache/cache.controller';
import { HealthController } from './health.controller';
import { TypesController } from './types/types.controller';
import { RedisModule } from './redis/redis.module';
import { SqlModule } from './sql/sql.module';

@Module({
  imports: [SqlModule, RedisModule],
  controllers: [HealthController, CacheController, TypesController],
})
export class AppModule {}
