# Short.io Link Sync Action

A GitHub Action that syncs short links from a `shortio.yaml` file in your repository to [Short.io](https://short.io).

## Features

- **Full sync** - Creates, updates, and deletes links to match your YAML config
- **Multiple domains** - Support for multiple Short.io domains in a single repository
- **Dry-run mode** - Preview changes before applying them
- **Git-driven** - Manage your short links with version control

## Usage

### 1. Create your Short.io API key

1. Go to [Short.io Integrations](https://app.short.io/settings/integrations/api-key)
2. Create a new API key with read/write permissions
3. Add it to your repository secrets as `SHORTIO_API_KEY`

### 2. Create `shortio.yaml` in your repository

```yaml
# shortio.yaml
domain: "short.example.com"

links:
  docs:
    url: "https://documentation.example.com/v2"
    title: "Documentation"
    tags:
      - docs
      - public

  api:
    url: "https://api.example.com"
    title: "API Reference"
```

For multiple domains, use YAML document streams (separated by `---`):

```yaml
# shortio.yaml
domain: "short.example.com"

links:
  docs:
    url: "https://documentation.example.com/v2"
  api:
    url: "https://api.example.com"

---

domain: "links.company.io"

links:
  blog:
    url: "https://blog.example.com"
    title: "Company Blog"
```

### 3. Create the workflow

```yaml
# .github/workflows/sync-links.yml
name: Sync Short Links

on:
  push:
    branches: [main]
    paths:
      - 'shortio.yaml'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shortio/link-sync-action@v1
        with:
          api_key: ${{ secrets.SHORTIO_API_KEY }}
```

## Configuration

### Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api_key` | Short.io API key | Yes | - |
| `config_path` | Path to shortio.yaml file | No | `shortio.yaml` |
| `dry_run` | Preview changes without applying | No | `false` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `created` | Number of links created |
| `updated` | Number of links updated |
| `deleted` | Number of links deleted |
| `summary` | Summary of all changes |

### YAML Schema

The config file supports YAML streams (multiple documents separated by `---`). Each document represents a domain and its links.

**Document fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | string | Yes | Short.io domain for all links in this document |
| `links` | map | Yes | Map of slug → link configuration |

**Link fields** (within `links` map):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| *(key)* | string | Yes | The slug/short path (e.g., `docs` → short.example.com/docs) |
| `url` | string | Yes | Destination URL |
| `title` | string | No | Link title for organization |
| `tags` | string[] | No | Tags for categorization |
| `cloaking` | boolean | No | Enable URL cloaking (masks destination URL) |
| `redirectType` | 301/302/307/308 | No | HTTP redirect status code |
| `expiresAt` | number/string | No | Link expiration (timestamp ms or ISO date) |
| `expiredURL` | string | No | Redirect destination after link expires |
| `password` | string | No | Password protect the link |
| `passwordContact` | boolean | No | Show contact option for password requests |
| `utmSource` | string | No | UTM source parameter |
| `utmMedium` | string | No | UTM medium parameter |
| `utmCampaign` | string | No | UTM campaign parameter |
| `utmTerm` | string | No | UTM term parameter |
| `utmContent` | string | No | UTM content parameter |
| `androidURL` | string | No | Android-specific destination URL |
| `iphoneURL` | string | No | iOS-specific destination URL |
| `clicksLimit` | number | No | Disable link after N clicks |
| `splitURL` | string | No | A/B test destination URL |
| `splitPercent` | 1-100 | No | Percentage of traffic to splitURL |
| `integrationGA` | string | No | Google Analytics integration ID |
| `integrationFB` | string | No | Facebook Pixel integration ID |
| `integrationAdroll` | string | No | AdRoll integration ID |
| `integrationGTM` | string | No | Google Tag Manager integration ID |
| `folderId` | string | No | Short.io folder ID for organization |
| `archived` | boolean | No | Archive the link |
| `skipQS` | boolean | No | Skip query string forwarding |

### Special Path Patterns

Short.io supports special path patterns for advanced routing:

| Pattern | Description | Example |
|---------|-------------|---------|
| `""` (empty) | Root domain redirect | `short.io` → `https://example.com` |
| `*` | Catch-all for 404s | `short.io/anything` → `https://example.com/not-found` |
| `path/*` | Path prefix with capture | `short.io/docs/intro` → `https://example.com/docs/intro` |

In path prefix patterns, use `$1` in the destination URL to insert the captured path segment.

```yaml
domain: "short.example.com"

links:
  # Root redirect - visitors to short.example.com go to main site
  "":
    url: "https://www.example.com"
    title: "Root redirect"

  # 404 catch-all - any unmatched path redirects to help page
  "*":
    url: "https://www.example.com/help"
    title: "404 fallback"

  # Path prefix - short.example.com/docs/anything → docs.example.com/anything
  "docs/*":
    url: "https://docs.example.com/$1"
    title: "Docs passthrough"

  # Another example - short.example.com/gh/repo/path → github.com/myorg/repo/path
  "gh/*":
    url: "https://github.com/myorg/$1"
    title: "GitHub shortcut"
```

## Examples

### Dry-run mode

Preview what changes would be made without actually applying them:

```yaml
- uses: shortio/link-sync-action@v1
  with:
    api_key: ${{ secrets.SHORTIO_API_KEY }}
    dry_run: 'true'
```

### Custom config path

Use a different config file location:

```yaml
- uses: shortio/link-sync-action@v1
  with:
    api_key: ${{ secrets.SHORTIO_API_KEY }}
    config_path: 'config/links.yaml'
```

### Using outputs

Access the sync results in subsequent steps:

```yaml
- uses: shortio/link-sync-action@v1
  id: sync
  with:
    api_key: ${{ secrets.SHORTIO_API_KEY }}

- run: |
    echo "Created: ${{ steps.sync.outputs.created }}"
    echo "Updated: ${{ steps.sync.outputs.updated }}"
    echo "Deleted: ${{ steps.sync.outputs.deleted }}"
```

### Advanced link options

Example using various Short.io link features:

```yaml
domain: "short.example.com"

links:
  # Campaign link with UTM tracking
  summer-sale:
    url: "https://shop.example.com/sale"
    title: "Summer Sale 2024"
    tags: [marketing, campaign]
    utmSource: "shortlink"
    utmMedium: "social"
    utmCampaign: "summer2024"

  # Time-limited promotional link
  flash-deal:
    url: "https://shop.example.com/flash"
    expiresAt: "2024-12-31T23:59:59Z"
    expiredURL: "https://shop.example.com/deals-ended"
    clicksLimit: 1000

  # Password-protected internal link
  internal-docs:
    url: "https://internal.example.com/docs"
    password: "secret123"
    cloaking: true

  # Mobile-optimized link with app deep links
  download:
    url: "https://example.com/download"
    androidURL: "https://play.google.com/store/apps/details?id=com.example"
    iphoneURL: "https://apps.apple.com/app/example/id123456"

  # A/B test link
  landing:
    url: "https://example.com/landing-a"
    splitURL: "https://example.com/landing-b"
    splitPercent: 50
```

## Sync Behavior

The action performs a **declarative sync** between your YAML config and Short.io:

1. **Create** - Links in YAML but not in Short.io are created
2. **Update** - Links where URL, title, or tags differ are updated
3. **Delete** - Links removed from YAML are deleted (only if previously managed by this action)

Links created by the action are tagged with `github-action-managed`. This ensures that manually created links in Short.io are never deleted—only links that were originally created through this action will be removed when deleted from the YAML config.

Links are identified by the combination of `domain` and `slug`. Changing a slug will result in the old link being deleted and a new one created.

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Build
npm run build

# Run tests
npm test
```

## License

MIT
