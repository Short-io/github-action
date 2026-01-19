import * as fs from 'fs';
import { parse } from 'yaml';
import type { YamlConfig, YamlLinkValue } from './types.js';
import { getLinksArray } from './types.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function parseConfig(configPath: string): YamlConfig {
  if (!fs.existsSync(configPath)) {
    throw new ConfigError(`Config file not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const parsed = parse(content);

  validateConfig(parsed);

  return parsed as YamlConfig;
}

function validateConfig(config: unknown): asserts config is YamlConfig {
  if (!config || typeof config !== 'object') {
    throw new ConfigError('Config must be an object');
  }

  const obj = config as Record<string, unknown>;

  if (!obj.links || typeof obj.links !== 'object' || Array.isArray(obj.links)) {
    throw new ConfigError('Config must have a "links" map (use slug as key)');
  }

  const linksMap = obj.links as Record<string, unknown>;
  const seen = new Set<string>();

  for (const [slug, link] of Object.entries(linksMap)) {
    if (!slug || slug.trim() === '') {
      throw new ConfigError('Link slug (key) must be a non-empty string');
    }
    validateLink(link, slug);

    const validatedLink = link as YamlLinkValue;
    const key = `${validatedLink.domain}/${slug}`;
    if (seen.has(key)) {
      throw new ConfigError(`Duplicate link: ${key}`);
    }
    seen.add(key);
  }
}

function validateLink(link: unknown, slug: string): asserts link is YamlLinkValue {
  if (!link || typeof link !== 'object') {
    throw new ConfigError(`Link "${slug}" must be an object`);
  }

  const obj = link as Record<string, unknown>;

  if (typeof obj.url !== 'string' || obj.url.trim() === '') {
    throw new ConfigError(`Link "${slug}" must have a non-empty "url" string`);
  }

  if (typeof obj.domain !== 'string' || obj.domain.trim() === '') {
    throw new ConfigError(`Link "${slug}" must have a non-empty "domain" string`);
  }

  try {
    new URL(obj.url);
  } catch {
    throw new ConfigError(`Link "${slug}" has invalid URL: ${obj.url}`);
  }

  if (obj.title !== undefined && typeof obj.title !== 'string') {
    throw new ConfigError(`Link "${slug}" "title" must be a string`);
  }

  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags)) {
      throw new ConfigError(`Link "${slug}" "tags" must be an array`);
    }
    for (const tag of obj.tags) {
      if (typeof tag !== 'string') {
        throw new ConfigError(`Link "${slug}" tags must all be strings`);
      }
    }
  }
}

export function getUniqueDomains(config: YamlConfig): string[] {
  const domains = new Set<string>();
  for (const link of Object.values(config.links)) {
    domains.add(link.domain);
  }
  return Array.from(domains);
}
