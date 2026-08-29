import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { Principal } from '../auth/auth.types.js';
import { AppConfigService } from '../config/config.module.js';
import type {
  AuthorizationAdapter,
  AuthorizationCheck,
  AuthorizationScope,
  Relation,
  ResourceType,
} from './authorization.types.js';

const CheckResponseSchema = z.object({ allowed: z.boolean() });
const ListObjectsResponseSchema = z.object({ objects: z.array(z.string()) });
const uuid = z.uuid();

/** Production adapter for the OpenFGA HTTP API. No role logic is duplicated in controllers. */
@Injectable()
export class OpenFgaAuthorizationAdapter implements AuthorizationAdapter {
  private readonly baseUrl: string;
  private readonly storeId: string;
  private readonly modelId: string;

  public constructor(config: AppConfigService) {
    this.baseUrl = config.values.OPENFGA_API_URL.replace(/\/$/, '');
    this.storeId = config.values.OPENFGA_STORE_ID;
    this.modelId = config.values.OPENFGA_MODEL_ID;
  }

  public async check(input: AuthorizationCheck): Promise<boolean> {
    const response = await this.request('/check', {
      authorization_model_id: this.modelId,
      tuple_key: {
        user: `user:${input.principal.userId}`,
        relation: input.relation,
        object: `${input.resourceType}:${input.resourceId}`,
      },
      context: { organization_id: input.principal.organizationId },
    });
    return CheckResponseSchema.parse(response).allowed;
  }

  public async listAuthorizedScope(
    principal: Principal,
    relation: Relation,
  ): Promise<AuthorizationScope> {
    const [workspaces, documents] = await Promise.all([
      this.listObjects(principal, 'workspace', relation),
      this.listObjects(principal, 'document', relation),
    ]);
    return { workspaceIds: workspaces, documentIds: documents };
  }

  private async listObjects(
    principal: Principal,
    resourceType: ResourceType,
    relation: Relation,
  ): Promise<string[]> {
    const response = await this.request('/list-objects', {
      authorization_model_id: this.modelId,
      type: resourceType,
      relation,
      user: `user:${principal.userId}`,
      context: { organization_id: principal.organizationId },
    });
    return ListObjectsResponseSchema.parse(response)
      .objects.map((object) => object.replace(`${resourceType}:`, ''))
      .filter((id) => uuid.safeParse(id).success);
  }

  private async request(path: string, body: Readonly<Record<string, unknown>>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/stores/${this.storeId}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`OpenFGA ${path} failed with ${response.status}`);
    return response.json();
  }
}
