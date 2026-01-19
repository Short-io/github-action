export interface YamlLinkValue {
  url: string;
  domain: string;
  title?: string;
  tags?: string[];
}

export interface YamlLink extends YamlLinkValue {
  slug: string;
}

export interface YamlConfig {
  links: Record<string, YamlLinkValue>;
}

export interface ShortioLink {
  id: string;
  originalURL: string;
  path: string;
  domain: string;
  domainId: number;
  title?: string;
  tags?: string[];
}

export interface ShortioCreateLink {
  originalURL: string;
  domain: string;
  path: string;
  title?: string;
  tags?: string[];
}

export interface ShortioUpdateLink {
  originalURL?: string;
  path?: string;
  title?: string;
  tags?: string[];
}

export interface ShortioDomain {
  id: number;
  hostname: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface LinkDiff {
  toCreate: YamlLink[];
  toUpdate: Array<{ yaml: YamlLink; existing: ShortioLink }>;
  toDelete: ShortioLink[];
}

export type LinkKey = string;

export function getLinkKey(domain: string, slug: string): LinkKey {
  return `${domain}/${slug}`;
}

export function getLinksArray(config: YamlConfig): YamlLink[] {
  return Object.entries(config.links).map(([slug, value]) => ({
    slug,
    ...value,
  }));
}
