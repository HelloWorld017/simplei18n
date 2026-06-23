#! /usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';
import sade from 'sade';
import { stringify } from 'yaml';
import packageInfo from '../package.json';
import { loadConfig, resolveConfigPath } from './config';
import { createExtractCache, extract, invalidateExtractCache } from './extractor';
import { renderI18n, renderIndex, renderMergedIndex, renderTypes } from './renderer';
import type { NormalizedConfig, TargetConfig } from './config';
import type { ExtractCache } from './extractor';
import type { FSWatcher } from 'chokidar';

type CommonFlags = {
  config: string;
};

type GenerateOptions = {
  removeDangling?: boolean;
  extractCache?: ExtractCache;
};

type GenerateFlags = CommonFlags & {
  'remove-dangling': boolean;
  'watch': boolean;
};

export const generateTarget = async (
  workDir: string,
  target: TargetConfig,
  config: NormalizedConfig,
  options: GenerateOptions,
) => {
  const source = await extract(workDir, target, { cache: options.extractCache });
  const outDir = path.resolve(workDir, target.outDir);
  const localeDir = path.join(outDir, '_locales');
  await fs.mkdir(localeDir, { recursive: true });

  const localeSources: string[] = [];
  const locales = config.locales
    .slice()
    .sort()
    .filter(locale => locale !== config.defaultLocale);

  const defaultLocalePath = path.join(localeDir, `${config.defaultLocale}.i18n.yaml`);
  const defaultLocaleSource = stringify(source);
  await fs.writeFile(defaultLocalePath, defaultLocaleSource);
  localeSources.push(defaultLocaleSource);

  for (const locale of locales) {
    const localePath = path.join(localeDir, `${locale}.i18n.yaml`);
    const existing = await fs.readFile(localePath, 'utf8').catch(() => undefined);
    const merged = renderI18n(source, existing, {
      removeDangling: options.removeDangling,
      wrapLength: config.wrapLength,
    });

    await fs.writeFile(localePath, merged);
    localeSources.push(merged);
  }

  await fs.writeFile(
    path.join(outDir, 'i18n.d.ts'),
    renderTypes(localeSources, config.locales, config.defaultLocale),
  );
  await fs.writeFile(
    path.join(outDir, 'index.ts'),
    renderIndex(config.locales, config.defaultLocale, target),
  );

  process.stdout.write(`Generated ${path.relative(workDir, outDir)}\n`);
};

export const generate = async (
  workDir: string,
  config: NormalizedConfig,
  options: GenerateOptions = {},
): Promise<void> => {
  for (const target of config.target) {
    await generateTarget(workDir, target, config, options);
  }

  if (config.mergeTo) {
    const outputPath = path.resolve(workDir, config.mergeTo);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      renderMergedIndex(config.target, config.locales, config.defaultLocale, outputPath, workDir),
    );
    process.stdout.write(`Generated ${path.relative(workDir, outputPath)}\n`);
  }
};

const formatError = (error: unknown) =>
  error instanceof Error ? (error.stack ?? error.message) : String(error);

const watchGenerate = async (
  workDir: string,
  config: NormalizedConfig,
  options: GenerateOptions,
): Promise<void> => {
  const extractCache = createExtractCache();
  let watcher: FSWatcher | null = null;

  const resetWatcher = async () => {
    await watcher?.close();
    const watchTargets = config.target.flatMap(target =>
      target.include.map(include => path.resolve(workDir, include)),
    );

    const ignoreTargets = config.target.map(target => path.resolve(workDir, target.outDir, '**'));

    watcher = chokidar.watch(watchTargets, { ignoreInitial: true, ignored: ignoreTargets });
    watcher.on('all', (_eventName, changedPath) => {
      const absolutePath = path.isAbsolute(changedPath)
        ? changedPath
        : path.resolve(workDir, changedPath);

      invalidateExtractCache(extractCache, absolutePath);
      scheduleGenerate();
    });

    watcher.on('error', error => {
      process.stderr.write(`${formatError(error)}\n`);
    });
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  let generatePromise: Promise<void> = Promise.resolve();
  const scheduleGenerate = () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      generatePromise = generatePromise
        .then(() => generate(workDir, config, { ...options, extractCache }))
        .catch(error => void process.stderr.write(`${formatError(error)}\n`));
    });
  };

  const stop = async () => {
    await watcher?.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());

  await resetWatcher();
  scheduleGenerate();
  process.stdout.write('Watching for simplei18n changes\n');
};

export const cli = async (cwd?: string, argv?: string[]) => {
  const workDir = cwd ?? process.cwd();
  const args = argv ?? process.argv;

  const prog = sade('simplei18n');

  prog.version(packageInfo.version).option('-c, --config', 'Path to config file');

  prog
    .command('generate')
    .describe('Generate locale files')
    .option(
      '-D, --remove-dangling',
      'Removes dangling translation keys in existing locale files.',
      false,
    )
    .option('-w, --watch', 'Watch source files and regenerate on change.', false)
    .action(async (opts: GenerateFlags) => {
      const options = {
        removeDangling: opts['remove-dangling'],
      };

      const config = await loadConfig(workDir, opts.config);
      await (opts.watch ? watchGenerate : generate)(workDir, config, options);
    });

  prog.parse(args);
};
