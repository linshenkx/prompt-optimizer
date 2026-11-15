// Test harness only. Install before loading application code or dependencies.
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

function createBoundary(root, readRoots = []) {
  const realpath = fs.realpathSync.bind(fs);
  const exists = fs.existsSync.bind(fs);
  const base = realpath(root);
  const sources = readRoots.map(directory => realpath(directory));
  const within = (directory, target) => {
    const relative = path.relative(directory, target);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  };
  const absolute = input => path.resolve(input instanceof URL ? fileURLToPath(input) : String(input));
  const canonical = input => {
    let current = absolute(input);
    const missing = [];
    while (!exists(current)) {
      const parent = path.dirname(current);
      if (parent === current) throw new Error('Isolation: no existing ancestor');
      missing.unshift(path.basename(current));
      current = parent;
    }
    return path.join(realpath(current), ...missing);
  };
  function writable(input) {
    const target = canonical(input);
    if (!within(base, target)) throw new Error('Isolation: write outside fixture refused');
    return target;
  }
  function readable(input) {
    const target = canonical(input);
    if (!within(base, target)) {
      if (/^\.env(?:\.|$)/i.test(path.basename(target)) || !sources.some(directory => within(directory, target))) {
        throw new Error('Isolation: read outside fixture/source refused');
      }
    }
    return target;
  }
  return { root: base, writable, readable, within };
}

function installFilesystemGuards(boundary, audit) {
  const descriptorPaths = new Map();
  const check = (mode, value) => {
    // Descriptor access must originate from an allowed open, never an arbitrary fd.
    if (typeof value === 'number') {
      if (!descriptorPaths.has(value)) throw new Error('Isolation: unknown file descriptor');
      value = descriptorPaths.get(value);
    }
    try { boundary[mode](value); }
    catch (error) { audit.violations.push({ operation: `fs.${mode}`, message: error.message }); throw error; }
    audit[mode]++;
  };
  const writes = ['writeFile', 'appendFile', 'mkdir', 'mkdtemp', 'rm', 'rmdir', 'unlink', 'truncate', 'chmod', 'chown', 'utimes'];
  const reads = ['readFile', 'readdir', 'stat', 'lstat', 'access', 'readlink', 'realpath', 'exists'];
  for (const api of [fs, fs.promises]) {
    for (const [mode, names] of [['writable', writes], ['readable', reads]]) {
      for (const name of names) {
        for (const method of api === fs ? [name, `${name}Sync`] : [name]) {
          if (typeof api[method] !== 'function') continue;
          const native = api[method].native;
          const original = api[method].bind(api);
          const guarded = function (target, ...args) { check(mode, target); return original(target, ...args); };
          // Some dependencies use fs.realpath.native.
          if (native) guarded.native = (target, ...args) => { check(mode, target); return native(target, ...args); };
          api[method] = guarded;
        }
      }
    }
    for (const name of ['rename', 'copyFile', 'cp', 'link', 'symlink']) {
      for (const method of api === fs ? [name, `${name}Sync`] : [name]) {
        if (typeof api[method] !== 'function') continue;
        const original = api[method].bind(api);
        api[method] = (from, to, ...args) => {
          check(name === 'rename' ? 'writable' : 'readable', from);
          check('writable', to);
          return original(from, to, ...args);
        };
      }
    }
  }
  const openSync = fs.openSync.bind(fs);
  fs.openSync = (target, flags, ...args) => {
    check(typeof flags === 'number' ? (flags === fs.constants.O_RDONLY ? 'readable' : 'writable') : (/^[r]$/.test(flags) ? 'readable' : 'writable'), target);
    const descriptor = openSync(target, flags, ...args);
    descriptorPaths.set(descriptor, target);
    return descriptor;
  };
  const open = fs.open.bind(fs);
  fs.open = (target, flags, ...args) => {
    check(typeof flags === 'number' ? (flags === fs.constants.O_RDONLY ? 'readable' : 'writable') : (/^[r]$/.test(flags) ? 'readable' : 'writable'), target);
    const callback = args.pop();
    return open(target, flags, ...args, (error, descriptor) => {
      if (!error) descriptorPaths.set(descriptor, target);
      callback(error, descriptor);
    });
  };
  const openPromise = fs.promises.open.bind(fs.promises);
  fs.promises.open = (target, flags = 'r', ...args) => {
    check(flags === 'r' ? 'readable' : 'writable', target);
    return openPromise(target, flags, ...args);
  };
  for (const [name, mode] of [['createReadStream', 'readable'], ['createWriteStream', 'writable']]) {
    const original = fs[name].bind(fs);
    fs[name] = (target, ...args) => { check(mode, target); return original(target, ...args); };
  }
}

module.exports = { createBoundary, installFilesystemGuards };
