import { Global, Logger, Module } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { seed } from './seed';

@Global()
@Module({
  providers: [
    {
      provide: DatabaseSync,
      useFactory: () => {
        mkdirSync('data', { recursive: true });

        const db = new DatabaseSync('data/demo.db');
        const start = performance.now();
        const seeded = seed(db);

        if (seeded) new Logger('SqlModule').log(`Seeded in ${Math.round(performance.now() - start)} ms`);

        return db;
      },
    },
  ],
  exports: [DatabaseSync],
})
export class SqlModule {}
