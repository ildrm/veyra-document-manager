import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';

import { AppConfigService } from '../config/config.module.js';

export type TenantTransaction<T> = (client: PoolClient) => Promise<T>;

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  public constructor(config: AppConfigService) {
    this.pool = new Pool({
      connectionString: config.values.DATABASE_URL,
      max: config.values.DATABASE_POOL_MAX,
      application_name: 'veyra-api',
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      maxUses: 10_000,
    });
    this.pool.on('error', (error) => this.logger.error({ event: 'postgres.pool.error', error }));
  }

  /**
   * All tenant repositories must execute through this boundary. The transaction-local
   * setting activates PostgreSQL RLS and cannot leak into a reused pooled connection.
   */
  public async withTenant<T>(organizationId: string, operation: TenantTransaction<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      await client.query("SELECT set_config('statement_timeout', '15000', true)");
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async readiness(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
