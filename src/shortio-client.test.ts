import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShortioClient, ShortioApiError } from './shortio-client.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ShortioClient', () => {
  let client: ShortioClient;

  beforeEach(() => {
    client = new ShortioClient('test-api-key');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getDomains', () => {
    it('fetches domains and caches them', async () => {
      const domains = [
        { id: 1, hostname: 'short.io' },
        { id: 2, hostname: 'example.link' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(domains),
      });

      const result = await client.getDomains();

      expect(result).toEqual(domains);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.short.io/api/domains',
        expect.objectContaining({
          headers: {
            'Authorization': 'test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );
    });
  });

  describe('getDomainId', () => {
    it('returns cached domain id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 123, hostname: 'short.io' }]),
      });

      const id = await client.getDomainId('short.io');
      expect(id).toBe(123);

      // Second call should use cache
      const id2 = await client.getDomainId('short.io');
      expect(id2).toBe(123);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws error for unknown domain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 1, hostname: 'other.io' }]),
      });

      await expect(client.getDomainId('unknown.io')).rejects.toThrow('Domain not found');
    });
  });

  describe('getLinks', () => {
    it('fetches links for domain', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: 1, hostname: 'short.io' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            links: [
              { id: 'link1', originalURL: 'https://example.com', path: 'test', title: 'Test', tags: ['tag1'] },
            ],
          }),
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
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: 1, hostname: 'short.io' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            links: Array(150).fill(null).map((_, i) => ({
              id: `link${i}`,
              originalURL: `https://example${i}.com`,
              path: `path${i}`,
            })),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            links: [
              { id: 'link150', originalURL: 'https://example150.com', path: 'path150' },
            ],
          }),
        });

      const links = await client.getLinks('short.io');
      expect(links).toHaveLength(151);
    });
  });

  describe('createLink', () => {
    it('creates a link', async () => {
      const createdLink = {
        id: 'new-link',
        originalURL: 'https://example.com',
        path: 'my-path',
        domain: 'short.io',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdLink),
      });

      const result = await client.createLink({
        originalURL: 'https://example.com',
        domain: 'short.io',
        path: 'my-path',
        title: 'My Title',
        tags: ['tag1'],
      });

      expect(result).toEqual(createdLink);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.short.io/links',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            originalURL: 'https://example.com',
            domain: 'short.io',
            path: 'my-path',
            title: 'My Title',
            tags: ['tag1'],
          }),
        })
      );
    });
  });

  describe('updateLink', () => {
    it('updates a link', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1' }),
      });

      await client.updateLink('1', {
        originalURL: 'https://new-url.com',
        title: 'New Title',
        tags: ['new-tag'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.short.io/links/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            originalURL: 'https://new-url.com',
            title: 'New Title',
            tags: ['new-tag'],
          }),
        })
      );
    });

    it('sends empty values to clear title/tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1' }),
      });

      await client.updateLink('1', {
        originalURL: 'https://example.com',
        title: '',
        tags: [],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.title).toBe('');
      expect(callBody.tags).toEqual([]);
    });
  });

  describe('deleteLink', () => {
    it('deletes a link', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.deleteLink('1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.short.io/links/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('error handling', () => {
    it('throws ShortioApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      try {
        await client.getDomains();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ShortioApiError);
        expect((error as ShortioApiError).statusCode).toBe(404);
      }
    });

    it('handles text error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Not JSON')),
        text: () => Promise.resolve('Internal error'),
      });

      await expect(client.getDomains()).rejects.toThrow(ShortioApiError);
    });
  });
});
