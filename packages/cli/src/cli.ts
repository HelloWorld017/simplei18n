#!/usr/bin/env node
import { generate } from './index';

const printUsage = () => {
  process.stderr.write('Usage: simplei18n generate [--remove-dangling]\n');
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);

  if (command !== 'generate') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const unknownArgs = args.filter(arg => arg !== '--remove-dangling');
  if (unknownArgs.length > 0) {
    process.stderr.write(`Unknown argument: ${unknownArgs.join(', ')}\n`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  await generate({ removeDangling: args.includes('--remove-dangling') });
};

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
