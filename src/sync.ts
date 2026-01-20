import * as core from '@actions/core';
import type { ShortioClient } from './shortio-client.js';
import type {
  YamlConfig,
  YamlLink,
  ShortioLink,
  ShortioCreateLink,
  ShortioUpdateLink,
  LinkDiff,
  SyncResult,
} from './types.js';
import { getLinkKey, getLinksArray, MANAGED_TAG } from './types.js';
import { getUniqueDomains } from './config.js';

/** Extract optional link parameters from a YamlLink */
function getLinkParams(link: YamlLink): Omit<ShortioCreateLink, 'originalURL' | 'domain' | 'path'> {
  return {
    title: link.title,
    tags: link.tags,
    cloaking: link.cloaking,
    redirectType: link.redirectType,
    expiresAt: link.expiresAt,
    expiredURL: link.expiredURL,
    password: link.password,
    passwordContact: link.passwordContact,
    utmSource: link.utmSource,
    utmMedium: link.utmMedium,
    utmCampaign: link.utmCampaign,
    utmTerm: link.utmTerm,
    utmContent: link.utmContent,
    androidURL: link.androidURL,
    iphoneURL: link.iphoneURL,
    clicksLimit: link.clicksLimit,
    splitURL: link.splitURL,
    splitPercent: link.splitPercent,
    integrationGA: link.integrationGA,
    integrationFB: link.integrationFB,
    integrationAdroll: link.integrationAdroll,
    integrationGTM: link.integrationGTM,
    folderId: link.folderId,
    archived: link.archived,
    skipQS: link.skipQS,
  };
}

function arraysEqual(a?: string[], b?: string[]): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

function needsUpdate(yaml: YamlLink, existing: ShortioLink): boolean {
  // Core fields
  if (yaml.url !== existing.originalURL) return true;
  if ((yaml.title || '') !== (existing.title || '')) return true;
  if (!arraysEqual(yaml.tags, existing.tags)) return true;
  // Redirect settings
  if (yaml.cloaking !== existing.cloaking) return true;
  if (yaml.redirectType !== existing.redirectType) return true;
  // Expiration
  if (yaml.expiresAt !== existing.expiresAt) return true;
  if (yaml.expiredURL !== existing.expiredURL) return true;
  // Password protection
  if (yaml.password !== existing.password) return true;
  if (yaml.passwordContact !== existing.passwordContact) return true;
  // UTM parameters
  if (yaml.utmSource !== existing.utmSource) return true;
  if (yaml.utmMedium !== existing.utmMedium) return true;
  if (yaml.utmCampaign !== existing.utmCampaign) return true;
  if (yaml.utmTerm !== existing.utmTerm) return true;
  if (yaml.utmContent !== existing.utmContent) return true;
  // Platform-specific URLs
  if (yaml.androidURL !== existing.androidURL) return true;
  if (yaml.iphoneURL !== existing.iphoneURL) return true;
  // Limits
  if (yaml.clicksLimit !== existing.clicksLimit) return true;
  // A/B testing
  if (yaml.splitURL !== existing.splitURL) return true;
  if (yaml.splitPercent !== existing.splitPercent) return true;
  // Integrations
  if (yaml.integrationGA !== existing.integrationGA) return true;
  if (yaml.integrationFB !== existing.integrationFB) return true;
  if (yaml.integrationAdroll !== existing.integrationAdroll) return true;
  if (yaml.integrationGTM !== existing.integrationGTM) return true;
  // Other
  if (yaml.folderId !== existing.folderId) return true;
  if (yaml.archived !== existing.archived) return true;
  if (yaml.skipQS !== existing.skipQS) return true;
  return false;
}

export async function computeDiff(
  config: YamlConfig,
  client: ShortioClient
): Promise<LinkDiff> {
  const domains = getUniqueDomains(config);

  const existingLinks: ShortioLink[] = [];
  for (const domain of domains) {
    core.info(`Fetching existing links for domain: ${domain}`);
    const links = await client.getLinks(domain);
    existingLinks.push(...links);
    core.info(`Found ${links.length} existing links for ${domain}`);
  }

  const existingByKey = new Map<string, ShortioLink>();
  for (const link of existingLinks) {
    const key = getLinkKey(link.domain, link.path);
    existingByKey.set(key, link);
  }

  const yamlByKey = new Map<string, YamlLink>();
  for (const link of getLinksArray(config)) {
    const key = getLinkKey(link.domain, link.slug);
    yamlByKey.set(key, link);
  }

  const toCreate: YamlLink[] = [];
  const toUpdate: Array<{ yaml: YamlLink; existing: ShortioLink }> = [];
  const toDelete: ShortioLink[] = [];

  for (const [key, yaml] of yamlByKey) {
    const existing = existingByKey.get(key);
    if (!existing) {
      toCreate.push(yaml);
    } else if (needsUpdate(yaml, existing)) {
      toUpdate.push({ yaml, existing });
    }
  }

  for (const [key, existing] of existingByKey) {
    if (!yamlByKey.has(key)) {
      // Only delete links that were previously managed by this action
      if (existing.tags?.includes(MANAGED_TAG)) {
        toDelete.push(existing);
      }
    }
  }

  return { toCreate, toUpdate, toDelete };
}

export async function executeSync(
  diff: LinkDiff,
  client: ShortioClient,
  dryRun: boolean
): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  if (diff.toCreate.length > 0) {
    core.info(`Creating ${diff.toCreate.length} links...`);
    for (const link of diff.toCreate) {
      const key = getLinkKey(link.domain, link.slug);
      if (dryRun) {
        core.info(`[DRY RUN] Would create: ${key} -> ${link.url}`);
        result.created++;
      } else {
        try {
          const params = getLinkParams(link);
          const tags = params.tags ? [...params.tags, MANAGED_TAG] : [MANAGED_TAG];
          await client.createLink({
            ...params,
            originalURL: link.url,
            domain: link.domain,
            path: link.slug,
            tags,
          });
          core.info(`Created: ${key}`);
          result.created++;
        } catch (error) {
          const msg = `Failed to create ${key}: ${error instanceof Error ? error.message : error}`;
          core.error(msg);
          result.errors.push(msg);
        }
      }
    }
  }

  if (diff.toUpdate.length > 0) {
    core.info(`Updating ${diff.toUpdate.length} links...`);
    for (const { yaml, existing } of diff.toUpdate) {
      const key = getLinkKey(yaml.domain, yaml.slug);
      if (dryRun) {
        core.info(`[DRY RUN] Would update: ${key}`);
        if (yaml.url !== existing.originalURL) {
          core.info(`  URL: ${existing.originalURL} -> ${yaml.url}`);
        }
        if ((yaml.title || '') !== (existing.title || '')) {
          core.info(`  Title: ${existing.title || '(none)'} -> ${yaml.title || '(none)'}`);
        }
        if (!arraysEqual(yaml.tags, existing.tags)) {
          core.info(`  Tags: [${existing.tags?.join(', ') || ''}] -> [${yaml.tags?.join(', ') || ''}]`);
        }
        result.updated++;
      } else {
        try {
          const params = getLinkParams(yaml);
          const baseTags = params.tags ?? [];
          const tags = baseTags.includes(MANAGED_TAG) ? baseTags : [...baseTags, MANAGED_TAG];
          await client.updateLink(existing.id, {
            ...params,
            originalURL: yaml.url,
            tags,
          });
          core.info(`Updated: ${key}`);
          result.updated++;
        } catch (error) {
          const msg = `Failed to update ${key}: ${error instanceof Error ? error.message : error}`;
          core.error(msg);
          result.errors.push(msg);
        }
      }
    }
  }

  if (diff.toDelete.length > 0) {
    core.info(`Deleting ${diff.toDelete.length} links...`);
    for (const link of diff.toDelete) {
      const key = getLinkKey(link.domain, link.path);
      if (dryRun) {
        core.info(`[DRY RUN] Would delete: ${key}`);
        result.deleted++;
      } else {
        try {
          await client.deleteLink(link.id);
          core.info(`Deleted: ${key}`);
          result.deleted++;
        } catch (error) {
          const msg = `Failed to delete ${key}: ${error instanceof Error ? error.message : error}`;
          core.error(msg);
          result.errors.push(msg);
        }
      }
    }
  }

  return result;
}

export function formatSummary(result: SyncResult, dryRun: boolean): string {
  const prefix = dryRun ? '[DRY RUN] ' : '';
  const lines: string[] = [
    `${prefix}Sync completed:`,
    `  Created: ${result.created}`,
    `  Updated: ${result.updated}`,
    `  Deleted: ${result.deleted}`,
  ];

  if (result.errors.length > 0) {
    lines.push(`  Errors: ${result.errors.length}`);
  }

  return lines.join('\n');
}
