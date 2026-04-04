import { getPublicAgentBySlug, getSoldListing } from "@/lib/data/mock-public-agent";
import { loadPublicAgentFromDb, loadSoldRecordFromDb } from "@/lib/data/load-public-agent";
import type { AgentPublicProfile } from "@/lib/types/public-profile";

export async function resolvePublicAgent(slug: string): Promise<AgentPublicProfile | null> {
  const fromDb = await loadPublicAgentFromDb(slug);
  if (fromDb) return fromDb;
  return getPublicAgentBySlug(slug);
}

export async function resolveSoldRecord(agentSlug: string, recordSlug: string) {
  const fromDb = await loadSoldRecordFromDb(agentSlug, recordSlug);
  if (fromDb) return fromDb;
  return getSoldListing(agentSlug, recordSlug);
}
