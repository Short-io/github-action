export interface YamlLinkValue {
  url: string;
  title?: string;
  tags?: string[];
}

export interface YamlLink {
  slug: string;
  url: string;
  domain: string;
  title?: string;
  tags?: string[];
}

export interface YamlDocument {
  domain: string;
  links: Record<string, YamlLinkValue>;
}

export interface YamlConfig {
  documents: YamlDocument[];
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

export const MANAGED_TAG = 'github-action-managed';

export type LinkKey = string;

export function getLinkKey(domain: string, slug: string): LinkKey {
  return `${domain}/${slug}`;
}

export function getLinksArray(config: YamlConfig): YamlLink[] {
  const links: YamlLink[] = [];
  for (const doc of config.documents) {
    for (const [slug, value] of Object.entries(doc.links)) {
      links.push({
        slug,
        url: value.url,
        domain: doc.domain,
        title: value.title,
        tags: value.tags,
      });
    }
  }
  return links;
}
