import { apiKeys, cuidUsers } from '../../modules/database/schema';

export type ApiKeyRecord = typeof apiKeys.$inferSelect;
export type CuidUserRecord = typeof cuidUsers.$inferSelect;

export interface AuthenticatedRequest {
  headers: Record<string, string | undefined>;
  apiKeyRecord?: ApiKeyRecord;
  cuidUserRecord?: CuidUserRecord;
}
