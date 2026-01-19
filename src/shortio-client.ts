import {
  setApiKey,
  getApiDomains,
  getApiLinks,
  postLinks,
  postLinksByLinkId,
  deleteLinksByLinkId,
} from '@short.io/client-node';
import type { ShortioLink, ShortioCreateLink, ShortioUpdateLink, ShortioDomain } from './types.js';

export class ShortioApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ShortioApiError';
  }
}

export class ShortioClient {
  private domainCache: Map<string, number> = new Map();

  constructor(apiKey: string) {
    setApiKey(apiKey);
  }

  async getDomains(): Promise<ShortioDomain[]> {
    const result = await getApiDomains();
    if (result.error) {
      throw new ShortioApiError('Failed to fetch domains', undefined, result.error);
    }
    const domains = result.data ?? [];
    for (const domain of domains) {
      this.domainCache.set(domain.hostname, domain.id);
    }
    return domains.map(d => ({ id: d.id, hostname: d.hostname }));
  }

  async getDomainId(hostname: string): Promise<number> {
    if (this.domainCache.has(hostname)) {
      return this.domainCache.get(hostname)!;
    }
    await this.getDomains();
    const id = this.domainCache.get(hostname);
    if (!id) {
      throw new ShortioApiError(`Domain not found: ${hostname}`);
    }
    return id;
  }

  async getLinks(domain: string): Promise<ShortioLink[]> {
    const domainId = await this.getDomainId(domain);
    const allLinks: ShortioLink[] = [];
    let pageToken: string | undefined;

    do {
      const result = await getApiLinks({
        query: {
          domain_id: domainId,
          limit: 150,
          ...(pageToken ? { pageToken } : {}),
        },
      });

      if (result.error) {
        throw new ShortioApiError(`Failed to fetch links for domain ${domain}`, undefined, result.error);
      }

      const data = result.data;
      if (data?.links) {
        for (const link of data.links) {
          allLinks.push({
            id: link.idString,
            originalURL: link.originalURL,
            path: link.path,
            domain,
            domainId,
            title: link.title,
            tags: link.tags,
          });
        }
      }

      pageToken = data?.nextPageToken;
    } while (pageToken);

    return allLinks;
  }

  async createLink(params: ShortioCreateLink): Promise<ShortioLink> {
    const result = await postLinks({
      body: {
        originalURL: params.originalURL,
        domain: params.domain,
        path: params.path,
        title: params.title,
        tags: params.tags,
      },
    });

    if (result.error) {
      const errorMsg = 'message' in result.error ? result.error.message : 'Unknown error';
      throw new ShortioApiError(`Failed to create link: ${errorMsg}`, undefined, result.error);
    }

    const data = result.data!;
    return {
      id: data.idString,
      originalURL: data.originalURL,
      path: data.path,
      domain: params.domain,
      domainId: data.DomainId ?? 0,
      title: data.title,
      tags: data.tags,
    };
  }

  async updateLink(linkId: string, params: ShortioUpdateLink): Promise<ShortioLink> {
    const result = await postLinksByLinkId({
      path: { linkId },
      body: {
        originalURL: params.originalURL,
        title: params.title,
        tags: params.tags,
      },
    });

    if (result.error) {
      const errorMsg = 'message' in result.error ? result.error.message : 'Unknown error';
      throw new ShortioApiError(`Failed to update link: ${errorMsg}`, undefined, result.error);
    }

    const data = result.data!;
    return {
      id: data.idString,
      originalURL: data.originalURL,
      path: data.path,
      domain: '',
      domainId: data.DomainId ?? 0,
      title: data.title,
      tags: data.tags,
    };
  }

  async deleteLink(linkId: string): Promise<void> {
    const result = await deleteLinksByLinkId({
      path: { link_id: linkId },
    });

    if (result.error) {
      throw new ShortioApiError(`Failed to delete link: ${linkId}`, undefined, result.error);
    }
  }
}
