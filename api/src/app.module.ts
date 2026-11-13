import { Module } from '@nestjs/common';
import { CacheController } from './cache/cache.controller';
import { ClusterController } from './cluster/cluster.controller';
import { HealthController } from './health.controller';
import { K8sController } from './k8s/k8s.controller';
import { LockController } from './lock/lock.controller';
import { RateLimitController } from './rate-limit/rate-limit.controller';
import { ArchitecturesController } from './real-world/architectures.controller';
import { LlmController } from './real-world/llm.controller';
import { ReplicationController } from './replication/replication.controller';
import { TypesController } from './types/types.controller';
import { RedisModule } from './redis/redis.module';
import { SqlModule } from './sql/sql.module';

@Module({
  imports: [SqlModule, RedisModule],
  controllers: [HealthController, CacheController, TypesController, RateLimitController, LockController, K8sController, ReplicationController, ClusterController, ArchitecturesController, LlmController],
})
export class AppModule {}
