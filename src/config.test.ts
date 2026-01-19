import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseConfig, getUniqueDomains, ConfigError } from './config.js';

const TEST_DIR = path.join(process.cwd(), '.test-config');
const TEST_FILE = path.join(TEST_DIR, 'test-config.yaml');

function writeTestConfig(content: string): void {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.writeFileSync(TEST_FILE, content);
}

describe('parseConfig', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('parses valid config with map structure', () => {
    writeTestConfig(`
links:
  my-link:
    url: https://example.com
    domain: short.io
  another-link:
    url: https://test.com
    domain: short.io
    title: Test Link
    tags:
      - tag1
      - tag2
`);
    const config = parseConfig(TEST_FILE);
    expect(Object.keys(config.links)).toHaveLength(2);
    expect(config.links['my-link']).toEqual({
      url: 'https://example.com',
      domain: 'short.io',
    });
    expect(config.links['another-link']).toEqual({
      url: 'https://test.com',
      domain: 'short.io',
      title: 'Test Link',
      tags: ['tag1', 'tag2'],
    });
  });

  it('throws ConfigError for missing file', () => {
    expect(() => parseConfig('/nonexistent/path.yaml')).toThrow(ConfigError);
    expect(() => parseConfig('/nonexistent/path.yaml')).toThrow('Config file not found');
  });

  it('throws ConfigError for non-object config', () => {
    writeTestConfig('just a string');
    expect(() => parseConfig(TEST_FILE)).toThrow(ConfigError);
    expect(() => parseConfig(TEST_FILE)).toThrow('Config must be an object');
  });

  it('throws ConfigError when links is an array (old format)', () => {
    writeTestConfig(`
links:
  - slug: my-link
    url: https://example.com
    domain: short.io
`);
    expect(() => parseConfig(TEST_FILE)).toThrow(ConfigError);
    expect(() => parseConfig(TEST_FILE)).toThrow('Config must have a "links" map');
  });

  it('throws ConfigError for missing links', () => {
    writeTestConfig('other_key: value');
    expect(() => parseConfig(TEST_FILE)).toThrow(ConfigError);
    expect(() => parseConfig(TEST_FILE)).toThrow('Config must have a "links" map');
  });

  it('throws ConfigError for missing url', () => {
    writeTestConfig(`
links:
  my-link:
    domain: short.io
`);
    expect(() => parseConfig(TEST_FILE)).toThrow(ConfigError);
    expect(() => parseConfig(TEST_FILE)).toThrow('Link "my-link" must have a non-empty "url" string');
  });

  it('throws ConfigError for missing domain', () => {
    writeTestConfig(`
links:
  my-link:
    url: https://example.com
`);
    expect(() => parseConfig(TEST_FILE)).toThrow(ConfigError);
    expect(() => parseConfig(TEST_FILE)).toThrow('Link "my-link" must have a non-empty "domain" string');
  });

  it('throws ConfigError for invalid URL', () => {
    writeTestConfig(`
links:
  my-link:
    url: not-a-valid-url
    domain: short.io
`);
    expect(() => parseConfig(TEST_FILE)).toThrow(ConfigError);
    expect(() => parseConfig(TEST_FILE)).toThrow('Link "my-link" has invalid URL');
  });

  it('throws ConfigError for non-string title', () => {
    writeTestConfig(`
links:
  my-link:
    url: https://example.com
    domain: short.io
    title: 123
`);
    expect(() => parseConfig(TEST_FILE)).toThrow(ConfigError);
    expect(() => parseConfig(TEST_FILE)).toThrow('Link "my-link" "title" must be a string');
  });

  it('throws ConfigError for non-array tags', () => {
    writeTestConfig(`
links:
  my-link:
    url: https://example.com
    domain: short.io
    tags: not-an-array
`);
    expect(() => parseConfig(TEST_FILE)).toThrow(ConfigError);
    expect(() => parseConfig(TEST_FILE)).toThrow('Link "my-link" "tags" must be an array');
  });

  it('throws ConfigError for non-string tag values', () => {
    writeTestConfig(`
links:
  my-link:
    url: https://example.com
    domain: short.io
    tags:
      - valid
      - 123
`);
    expect(() => parseConfig(TEST_FILE)).toThrow(ConfigError);
    expect(() => parseConfig(TEST_FILE)).toThrow('Link "my-link" tags must all be strings');
  });

  it('throws error for duplicate YAML keys (enforced by YAML parser)', () => {
    writeTestConfig(`
links:
  my-link:
    url: https://example.com
    domain: short.io
  my-link:
    url: https://test.com
    domain: short.io
`);
    // YAML parser throws error for duplicate map keys
    expect(() => parseConfig(TEST_FILE)).toThrow('Map keys must be unique');
  });
});

describe('getUniqueDomains', () => {
  it('returns unique domains', () => {
    const config = {
      links: {
        'link1': { url: 'https://example.com', domain: 'domain1.com' },
        'link2': { url: 'https://test.com', domain: 'domain2.com' },
        'link3': { url: 'https://another.com', domain: 'domain1.com' },
      },
    };
    const domains = getUniqueDomains(config);
    expect(domains).toHaveLength(2);
    expect(domains).toContain('domain1.com');
    expect(domains).toContain('domain2.com');
  });

  it('returns empty array for empty links', () => {
    const config = { links: {} };
    const domains = getUniqueDomains(config);
    expect(domains).toEqual([]);
  });
});
