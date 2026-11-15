import { defineConfig } from 'tsup';

export default defineConfig({
  // node:sqlite cannot be imported without its protocol (there is no sqlite package).
  removeNodeProtocol: false,
});
