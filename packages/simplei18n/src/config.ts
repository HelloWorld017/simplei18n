import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import * as v from 'valibot';

const LocaleSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z]{2,2}(?:_[A-Z]{2,2})?$/, 'locale key must be key like en_US, ko, ...'),
);

const IdentifierSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z_$][\w$]*$/, 'name must be a valid TypeScript identifier'),
);

const TargetConfigSchema = v.object({
  name: IdentifierSchema,
  include: v.pipe(v.array(v.string()), v.nonEmpty()),
  scope: v.optional(v.string()),
  outDir: v.string(),
  eager: v.pipe(
    v.optional(v.union([v.boolean(), v.array(LocaleSchema)]), false),
    v.transform(input => (Array.isArray(input) ? new Set(input) : input)),
  ),
});

const TargetConfigSingleSchema = v.pipe(
  v.omit(TargetConfigSchema, ['name']),
  v.transform(input => ({ name: 'default', ...input })),
);

export const ConfigSchema = v.pipe(
  v.object({
    target: v.pipe(
      v.union([TargetConfigSingleSchema, v.pipe(v.array(TargetConfigSchema), v.nonEmpty())]),
      v.transform(input => (Array.isArray(input) ? input : [input])),
    ),
    defaultLocale: LocaleSchema,
    locales: v.pipe(v.array(LocaleSchema), v.nonEmpty()),
    wrapLength: v.optional(v.nullable(v.number())),
    mergeTo: v.optional(v.string()),
  }),
  v.check(
    config => config.locales.includes(config.defaultLocale),
    'locale must include "defaultLocale"',
  ),
  v.check(
    config => new Set(config.target.map(target => target.name)).size === config.target.length,
    'target names must be unique',
  ),
  v.check(
    config =>
      config.target.every(
        target =>
          !Array.isArray(target.eager) ||
          target.eager.every(locale => config.locales.includes(locale)),
      ),
    'target eager locales must be included in locales',
  ),
);

export type TargetConfig = v.InferOutput<typeof TargetConfigSchema>;
export type Config = v.InferInput<typeof ConfigSchema>;
export type NormalizedConfig = v.InferOutput<typeof ConfigSchema>;

const CONFIG_FILES = [
  'simplei18n.config.ts',
  'simplei18n.config.mts',
  'simplei18n.config.js',
  'simplei18n.config.mjs',
];

const findConfig = async (cwd: string): Promise<string> => {
  for (const fileName of CONFIG_FILES) {
    const filePath = join(cwd, fileName);
    try {
      await access(filePath);
      return filePath;
    } catch {}
  }

  throw new Error(`Cannot find simplei18n config. Expected one of: ${CONFIG_FILES.join(', ')}`);
};

export const loadConfig = async (cwd: string, configFile?: string): Promise<NormalizedConfig> => {
  const configPath = configFile ?? (await findConfig(cwd));
  const jiti = createJiti(configPath, { interopDefault: true });
  const loaded = await jiti.import(configPath, { default: true });

  const result = v.safeParse(ConfigSchema, loaded);
  if (!result.success) {
    const error = result.issues
      .map(issue => {
        const path = issue.path?.length ? issue.path.map(String).join('.') : 'config';
        return `${path}: ${issue.message}`;
      })
      .join('\n');

    throw new Error(`Invalid simplei18n config:\n${error}`);
  }

  return result.output;
};
