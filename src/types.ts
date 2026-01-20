export interface YamlLinkValue {
  url: string;
  title?: string;
  tags?: string[];
  // Redirect settings
  cloaking?: boolean;
  redirectType?: 301 | 302 | 307 | 308;
  // Expiration
  expiresAt?: number | string;
  expiredURL?: string;
  // Password protection
  password?: string;
  passwordContact?: boolean;
  // UTM parameters
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  // Platform-specific URLs
  androidURL?: string;
  iphoneURL?: string;
  // Limits
  clicksLimit?: number;
  // A/B testing
  splitURL?: string;
  splitPercent?: number;
  // Integrations
  integrationGA?: string;
  integrationFB?: string;
  integrationAdroll?: string;
  integrationGTM?: string;
  // Other
  folderId?: string;
  archived?: boolean;
  skipQS?: boolean;
}

export interface YamlLink extends YamlLinkValue {
  slug: string;
  domain: string;
}

export interface YamlDocument {
  domain: string;
  links: Record<string, YamlLinkValue>;
}

export interface YamlConfig {
  documents: YamlDocument[];
}

/** Common optional link parameters supported by Short.io */
export interface ShortioLinkParams {
  title?: string;
  tags?: string[];
  cloaking?: boolean;
  redirectType?: 301 | 302 | 307 | 308;
  expiresAt?: number | string;
  expiredURL?: string;
  password?: string;
  passwordContact?: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  androidURL?: string;
  iphoneURL?: string;
  clicksLimit?: number;
  splitURL?: string;
  splitPercent?: number;
  integrationGA?: string;
  integrationFB?: string;
  integrationAdroll?: string;
  integrationGTM?: string;
  folderId?: string;
  archived?: boolean;
  skipQS?: boolean;
}

export interface ShortioLink extends ShortioLinkParams {
  id: string;
  originalURL: string;
  path: string;
  domain: string;
  domainId: number;
}

export interface ShortioCreateLink extends ShortioLinkParams {
  originalURL: string;
  domain: string;
  path: string;
}

export interface ShortioUpdateLink extends ShortioLinkParams {
  originalURL?: string;
  path?: string;
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
        ...value,
        slug,
        domain: doc.domain,
      });
    }
  }
  return links;
}
