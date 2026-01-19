import * as core from '@actions/core';
import * as path from 'path';
import { parseConfig, ConfigError } from './config.js';
import { ShortioClient, ShortioApiError } from './shortio-client.js';
import { computeDiff, executeSync, formatSummary } from './sync.js';

async function run(): Promise<void> {
  try {
    const apiKey = core.getInput('api_key', { required: true });
    const configPath = core.getInput('config_path') || 'shortio.yaml';
    const dryRun = core.getInput('dry_run') === 'true';

    const resolvedPath = path.resolve(process.cwd(), configPath);
    core.info(`Reading config from: ${resolvedPath}`);

    if (dryRun) {
      core.info('Running in dry-run mode - no changes will be made');
    }

    const config = parseConfig(resolvedPath);
    core.info(`Found ${Object.keys(config.links).length} links in config`);

    const client = new ShortioClient(apiKey);

    core.info('Computing diff between config and Short.io...');
    const diff = await computeDiff(config, client);

    core.info(`Changes to make:`);
    core.info(`  To create: ${diff.toCreate.length}`);
    core.info(`  To update: ${diff.toUpdate.length}`);
    core.info(`  To delete: ${diff.toDelete.length}`);

    if (diff.toCreate.length === 0 && diff.toUpdate.length === 0 && diff.toDelete.length === 0) {
      core.info('No changes needed - everything is in sync');
      core.setOutput('created', 0);
      core.setOutput('updated', 0);
      core.setOutput('deleted', 0);
      core.setOutput('summary', 'No changes needed');
      return;
    }

    const result = await executeSync(diff, client, dryRun);

    core.setOutput('created', result.created);
    core.setOutput('updated', result.updated);
    core.setOutput('deleted', result.deleted);

    const summary = formatSummary(result, dryRun);
    core.setOutput('summary', summary);
    core.info(summary);

    if (result.errors.length > 0) {
      core.setFailed(`Sync completed with ${result.errors.length} errors`);
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      core.setFailed(`Configuration error: ${error.message}`);
    } else if (error instanceof ShortioApiError) {
      core.setFailed(`Short.io API error: ${error.message}`);
      if (error.response) {
        core.error(`Response: ${JSON.stringify(error.response)}`);
      }
    } else if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
