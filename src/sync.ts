import * as core from '@actions/core';
import type { ShortioClient } from './shortio-client.js';
import type {
  YamlConfig,
  YamlLink,
  ShortioLink,
  LinkDiff,
  SyncResult,
} from './types.js';
import { getLinkKey, getLinksArray, MANAGED_TAG } from './types.js';
import { getUniqueDomains } from './config.js';

function arraysEqual(a?: string[], b?: string[]): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

function needsUpdate(yaml: YamlLink, existing: ShortioLink): boolean {
  if (yaml.url !== existing.originalURL) return true;
  if ((yaml.title || '') !== (existing.title || '')) return true;
  if (!arraysEqual(yaml.tags, existing.tags)) return true;
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
          const tags = link.tags ? [...link.tags, MANAGED_TAG] : [MANAGED_TAG];
          await client.createLink({
            originalURL: link.url,
            domain: link.domain,
            path: link.slug,
            title: link.title,
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
          const baseTags = yaml.tags ?? [];
          const tags = baseTags.includes(MANAGED_TAG) ? baseTags : [...baseTags, MANAGED_TAG];
          await client.updateLink(existing.id, {
            originalURL: yaml.url,
            title: yaml.title ?? '',
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
