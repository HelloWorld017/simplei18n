#! /usr/bin/env node

import fs from 'node:fs/promises';
import sade from 'sade';
import path from 'node:path';
import packageInfo from '../package.json';
import {loadConfig, NormalizedConfig, TargetConfig} from './config';
import {extract} from './extractor';
import {renderI18n, renderIndex, renderTypes} from './renderer';

type CommonFlags = {
  config: string,
};

type GenerateOptions = {
  removeDangling?: boolean;
  wrapLength?: number | null;
};

type GenerateFlags = CommonFlags & {
  'remove-dangling': boolean,
  'wrap-length': number,
};

export const generateTarget = async (
  workDir: string,
  target: TargetConfig,
  config: NormalizedConfig,
  options: GenerateOptions,
) => {
  const source = await extract(workDir, target);
  const outDir = path.resolve(workDir, target.outDir);
  const localeDir = path.join(outDir, '_locales');
  await fs.mkdir(localeDir, { recursive: true });

  for (const locale of config.locales) {
    const localePath = path.join(localeDir, `${locale}.i18n.yaml`);
    const existing = await fs.readFile(localePath, 'utf8').catch(() => undefined);
    const merged = renderI18n(source, existing, {
      removeDangling: options.removeDangling,
      wrapLength: options.wrapLength,
    });

    await fs.writeFile(localePath, merged);
  }

  await fs.writeFile(path.join(outDir, 'i18n.d.ts'), renderTypes(source, config.locales, config.defaultLocale));
  await fs.writeFile(path.join(outDir, 'index.ts'), renderIndex(config.locales, config.defaultLocale));

  process.stdout.write(`Generated ${path.relative(workDir, outDir)}\n`);
};

export const generate = async (workDir: string, config: NormalizedConfig, options: GenerateOptions = {}): Promise<void> => {
  for (const target of config.target) {
    await generateTarget(workDir, target, config, options);
  }
};

export const cli = async (cwd?: string, argv?: string[]) => {
  const workDir = cwd ?? process.cwd();
  const args = (argv ?? process.argv);

  const prog = sade('simplei18n');

  prog
    .version(packageInfo.version)
    .option('-c, --config', 'Path to config file');

  prog
    .command('generate')
    .describe('Generate locale files')
    .option('-D, --remove-dangling', 'Removes dangling translation keys in existing locale files.', false)
    .option('-w, --wrap-length', 'Changes default wrap length', 80)
    .action(async (opts: GenerateFlags) => {
      const config = await loadConfig(workDir, opts.config);
      await generate(workDir, config, {
        removeDangling: opts['remove-dangling'],
        wrapLength: opts['wrap-length'],
      });
    });

  prog.parse(args);
};
