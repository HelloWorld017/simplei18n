import { createJiti } from 'jiti';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as v from 'valibot';

const TargetConfigSchema = v.object({
  include: v.pipe(v.array(v.string()), v.nonEmpty()),
  scope: v.optional(v.string()),
  outDir: v.string()
});

export const ConfigSchema = v.pipe(
  v.object({
    target: v.pipe(
      v.union([TargetConfigSchema, v.pipe(v.array(TargetConfigSchema), v.nonEmpty())]),
      v.transform(input => Array.isArray(input) ? input : [input])
    ),
    defaultLocale: v.string(),
    locales: v.pipe(v.array(v.string()), v.nonEmpty())
  }),
  v.check((config) => config.locales.includes(config.defaultLocale), 'locale must include "defaultLocale"')
);

export type TargetConfig = v.InferOutput<typeof TargetConfigSchema>;
export type Config = v.InferInput<typeof ConfigSchema>;
export type NormalizedConfig = v.InferOutput<typeof ConfigSchema>;

const CONFIG_FILES = [
  'simplei18n.config.ts',
  'simplei18n.config.mts',
  'simplei18n.config.js',
  'simplei18n.config.mjs'
];

const findConfig = async (cwd: string): Promise<string> => {
  for (const fileName of CONFIG_FILES) {
    const filePath = path.join(cwd, fileName);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {}
  }

  throw new Error(`Cannot find simplei18n config. Expected one of: ${CONFIG_FILES.join(', ')}`);
};

export const loadConfig = async (cwd: string, configFile?: string): Promise<NormalizedConfig> => {
  const configPath = configFile ?? await findConfig(cwd);
  const jiti = createJiti(configPath, { interopDefault: true });
  const loaded = await jiti.import(configPath, { default: true });

  const result = v.safeParse(ConfigSchema, loaded);
  if (!result.success) {
    const error = result.issues.map(issue => {
      const path = issue.path?.length ? issue.path?.join('.') : 'config';
      return `${path}: ${issue.message}`;
    }).join('\n');

    throw new Error(`Invalid simplei18n config:\n${error}`);
  }

  return result.output;
};
