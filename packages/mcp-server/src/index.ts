import { parseProductOptions } from './cli.js';

export async function main(args = process.argv.slice(2)) {
  const { profiles, productUrl } = parseProductOptions(args);
  // Keep SDK stdout and diagnostics free of model configuration and provider errors.
  console.log = console.info = console.debug = console.warn = console.error = () => {};
  const { startProductStdio } = await import('./product.js');
  return startProductStdio(profiles, productUrl);
}
