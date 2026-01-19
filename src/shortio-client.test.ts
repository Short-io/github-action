import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShortioClient, ShortioApiError } from './shortio-client.js';

vi.mock('@short.io/client-node', () => ({
  setApiKey: vi.fn(),
  getApiDomains: vi.fn(),
  getApiLinks: vi.fn(),
  postLinks: vi.fn(),
  postLinksByLinkId: vi.fn(),
  deleteLinksByLinkId: vi.fn(),
}));

import {
  setApiKey,
  getApiDomains,
  getApiLinks,
  postLinks,
  postLinksByLinkId,
  deleteLinksByLinkId,
} from '@short.io/client-node';

const mockSetApiKey = vi.mocked(setApiKey);
const mockGetApiDomains = vi.mocked(getApiDomains);
const mockGetApiLinks = vi.mocked(getApiLinks);
const mockPostLinks = vi.mocked(postLinks);
const mockPostLinksByLinkId = vi.mocked(postLinksByLinkId);
const mockDeleteLinksByLinkId = vi.mocked(deleteLinksByLinkId);

describe('ShortioClient', () => {
  let client: ShortioClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ShortioClient('test-api-key');
  });

  it('sets API key on construction', () => {
    expect(mockSetApiKey).toHaveBeenCalledWith('test-api-key');
  });

  describe('getDomains', () => {
    it('fetches domains and caches them', async () => {
      const domains = [
        { id: 1, hostname: 'short.io', unicodeHostname: 'short.io', state: 'configured' as const, createdAt: '', updatedAt: '', hasFavicon: false, hideReferer: false, linkType: 'random' as const, cloaking: false, hideVisitorIp: false, enableAI: false, httpsLevel: 'none' as const, httpsLinks: false, clientStorage: {}, caseSensitive: false, incrementCounter: '', robots: 'allow' as const, exportEnabled: false, isFavorite: false },
        { id: 2, hostname: 'example.link', unicodeHostname: 'example.link', state: 'configured' as const, createdAt: '', updatedAt: '', hasFavicon: false, hideReferer: false, linkType: 'random' as const, cloaking: false, hideVisitorIp: false, enableAI: false, httpsLevel: 'none' as const, httpsLinks: false, clientStorage: {}, caseSensitive: false, incrementCounter: '', robots: 'allow' as const, exportEnabled: false, isFavorite: false },
      ];
      mockGetApiDomains.mockResolvedValueOnce({ data: domains });

      const result = await client.getDomains();

      expect(result).toEqual([
        { id: 1, hostname: 'short.io' },
        { id: 2, hostname: 'example.link' },
      ]);
      expect(mockGetApiDomains).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDomainId', () => {
    it('returns cached domain id', async () => {
      mockGetApiDomains.mockResolvedValueOnce({
        data: [{ id: 123, hostname: 'short.io', unicodeHostname: 'short.io', state: 'configured' as const, createdAt: '', updatedAt: '', hasFavicon: false, hideReferer: false, linkType: 'random' as const, cloaking: false, hideVisitorIp: false, enableAI: false, httpsLevel: 'none' as const, httpsLinks: false, clientStorage: {}, caseSensitive: false, incrementCounter: '', robots: 'allow' as const, exportEnabled: false, isFavorite: false }],
      });

      const id = await client.getDomainId('short.io');
      expect(id).toBe(123);

      // Second call should use cache
      const id2 = await client.getDomainId('short.io');
      expect(id2).toBe(123);
      expect(mockGetApiDomains).toHaveBeenCalledTimes(1);
    });

    it('throws error for unknown domain', async () => {
      mockGetApiDomains.mockResolvedValueOnce({
        data: [{ id: 1, hostname: 'other.io', unicodeHostname: 'other.io', state: 'configured' as const, createdAt: '', updatedAt: '', hasFavicon: false, hideReferer: false, linkType: 'random' as const, cloaking: false, hideVisitorIp: false, enableAI: false, httpsLevel: 'none' as const, httpsLinks: false, clientStorage: {}, caseSensitive: false, incrementCounter: '', robots: 'allow' as const, exportEnabled: false, isFavorite: false }],
      });

      await expect(client.getDomainId('unknown.io')).rejects.toThrow('Domain not found');
    });
  });

  describe('getLinks', () => {
    it('fetches links for domain', async () => {
      mockGetApiDomains.mockResolvedValueOnce({
        data: [{ id: 1, hostname: 'short.io', unicodeHostname: 'short.io', state: 'configured' as const, createdAt: '', updatedAt: '', hasFavicon: false, hideReferer: false, linkType: 'random' as const, cloaking: false, hideVisitorIp: false, enableAI: false, httpsLevel: 'none' as const, httpsLinks: false, clientStorage: {}, caseSensitive: false, incrementCounter: '', robots: 'allow' as const, exportEnabled: false, isFavorite: false }],
      });
      mockGetApiLinks.mockResolvedValueOnce({
        data: {
          count: 1,
          links: [
            { idString: 'link1', id: 'link1', originalURL: 'https://example.com', path: 'test', title: 'Test', tags: ['tag1'], shortURL: '', secureShortURL: '' },
          ],
        },
      });

      const links = await client.getLinks('short.io');

      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        id: 'link1',
        originalURL: 'https://example.com',
        path: 'test',
        domain: 'short.io',
        domainId: 1,
        title: 'Test',
        tags: ['tag1'],
      });
    });

    it('handles pagination', async () => {
      mockGetApiDomains.mockResolvedValueOnce({
        data: [{ id: 1, hostname: 'short.io', unicodeHostname: 'short.io', state: 'configured' as const, createdAt: '', updatedAt: '', hasFavicon: false, hideReferer: false, linkType: 'random' as const, cloaking: false, hideVisitorIp: false, enableAI: false, httpsLevel: 'none' as const, httpsLinks: false, clientStorage: {}, caseSensitive: false, incrementCounter: '', robots: 'allow' as const, exportEnabled: false, isFavorite: false }],
      });
      mockGetApiLinks
        .mockResolvedValueOnce({
          data: {
            count: 151,
            links: Array(150).fill(null).map((_, i) => ({
              idString: `link${i}`,
              id: `link${i}`,
              originalURL: `https://example${i}.com`,
              path: `path${i}`,
              shortURL: '',
              secureShortURL: '',
            })),
            nextPageToken: 'token123',
          },
        })
        .mockResolvedValueOnce({
          data: {
            count: 151,
            links: [
              { idString: 'link150', id: 'link150', originalURL: 'https://example150.com', path: 'path150', shortURL: '', secureShortURL: '' },
            ],
          },
        });

      const links = await client.getLinks('short.io');
      expect(links).toHaveLength(151);
    });
  });

  describe('createLink', () => {
    it('creates a link', async () => {
      const createdLink = {
        idString: 'new-link',
        id: 'new-link',
        originalURL: 'https://example.com',
        path: 'my-path',
        shortURL: '',
        secureShortURL: '',
        DomainId: 1,
      };
      mockPostLinks.mockResolvedValueOnce({ data: createdLink });

      const result = await client.createLink({
        originalURL: 'https://example.com',
        domain: 'short.io',
        path: 'my-path',
        title: 'My Title',
        tags: ['tag1'],
      });

      expect(result.id).toBe('new-link');
      expect(mockPostLinks).toHaveBeenCalledWith({
        body: {
          originalURL: 'https://example.com',
          domain: 'short.io',
          path: 'my-path',
          title: 'My Title',
          tags: ['tag1'],
        },
      });
    });
  });

  describe('updateLink', () => {
    it('updates a link', async () => {
      mockPostLinksByLinkId.mockResolvedValueOnce({
        data: {
          idString: '1',
          id: '1',
          originalURL: 'https://new-url.com',
          path: 'test',
          title: 'New Title',
          tags: ['new-tag'],
          shortURL: '',
          secureShortURL: '',
        },
      });

      await client.updateLink('1', {
        originalURL: 'https://new-url.com',
        title: 'New Title',
        tags: ['new-tag'],
      });

      expect(mockPostLinksByLinkId).toHaveBeenCalledWith({
        path: { linkId: '1' },
        body: {
          originalURL: 'https://new-url.com',
          title: 'New Title',
          tags: ['new-tag'],
        },
      });
    });

    it('sends empty values to clear title/tags', async () => {
      mockPostLinksByLinkId.mockResolvedValueOnce({
        data: {
          idString: '1',
          id: '1',
          originalURL: 'https://example.com',
          path: 'test',
          title: '',
          tags: [],
          shortURL: '',
          secureShortURL: '',
        },
      });

      await client.updateLink('1', {
        originalURL: 'https://example.com',
        title: '',
        tags: [],
      });

      expect(mockPostLinksByLinkId).toHaveBeenCalledWith({
        path: { linkId: '1' },
        body: {
          originalURL: 'https://example.com',
          title: '',
          tags: [],
        },
      });
    });
  });

  describe('deleteLink', () => {
    it('deletes a link', async () => {
      mockDeleteLinksByLinkId.mockResolvedValueOnce({ data: { success: true } });

      await client.deleteLink('1');

      expect(mockDeleteLinksByLinkId).toHaveBeenCalledWith({
        path: { link_id: '1' },
      });
    });
  });

  describe('error handling', () => {
    it('throws ShortioApiError on API error', async () => {
      mockGetApiDomains.mockResolvedValueOnce({
        error: { error: 'Unauthorized' },
      });

      await expect(client.getDomains()).rejects.toThrow(ShortioApiError);
    });

    it('throws ShortioApiError on createLink error', async () => {
      mockPostLinks.mockResolvedValueOnce({
        error: { message: 'Link already exists', statusCode: 409 },
      });

      await expect(client.createLink({
        originalURL: 'https://example.com',
        domain: 'short.io',
        path: 'existing',
      })).rejects.toThrow('Failed to create link: Link already exists');
    });
  });
});
