import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  handleShutdownSignal,
  handleStartupError,
  handleUncaughtException,
  handleUnhandledRejection
} from '../src/index.js';

describe('MCP process handlers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockProcessExit() {
    return vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
  }

  it('prints startup failures and exits with code 1', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = mockProcessExit();

    expect(() => handleStartupError(new Error('startup failed'))).toThrow('process.exit:1');

    expect(consoleError).toHaveBeenCalledWith('❌ MCP Server startup failed:');
    expect(consoleError).toHaveBeenCalledWith('   ', 'startup failed');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('prints uncaught exceptions and exits with code 1', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = mockProcessExit();
    const error = new Error('uncaught');

    expect(() => handleUncaughtException(error)).toThrow('process.exit:1');

    expect(consoleError).toHaveBeenCalledWith('Uncaught Exception:', error);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('prints unhandled rejections and exits with code 1', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = mockProcessExit();
    const promise = Promise.resolve();

    expect(() => handleUnhandledRejection('bad promise', promise)).toThrow('process.exit:1');

    expect(consoleError).toHaveBeenCalledWith('Unhandled Rejection at:', promise, 'reason:', 'bad promise');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it.each(['SIGINT', 'SIGTERM'] as const)('prints graceful shutdown for %s and exits with code 0', (signal) => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = mockProcessExit();

    expect(() => handleShutdownSignal(signal)).toThrow('process.exit:0');

    expect(consoleLog).toHaveBeenCalledWith(`Received ${signal}, shutting down gracefully...`);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('wires registered process listeners to the exported handlers', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = mockProcessExit();

    const uncaught = process.listeners('uncaughtException').at(-1) as (error: Error) => void;
    const unhandled = process.listeners('unhandledRejection').at(-1) as (reason: unknown, promise: Promise<unknown>) => void;
    const sigint = process.listeners('SIGINT').at(-1) as () => void;
    const sigterm = process.listeners('SIGTERM').at(-1) as () => void;

    expect(() => uncaught(new Error('registered uncaught'))).toThrow('process.exit:1');
    expect(consoleError).toHaveBeenCalledWith('Uncaught Exception:', expect.any(Error));

    const promise = Promise.resolve();
    expect(() => unhandled('registered rejection', promise)).toThrow('process.exit:1');
    expect(consoleError).toHaveBeenCalledWith('Unhandled Rejection at:', promise, 'reason:', 'registered rejection');

    expect(() => sigint()).toThrow('process.exit:0');
    expect(() => sigterm()).toThrow('process.exit:0');
    expect(consoleLog).toHaveBeenCalledWith('Received SIGINT, shutting down gracefully...');
    expect(consoleLog).toHaveBeenCalledWith('Received SIGTERM, shutting down gracefully...');
    expect(exit).toHaveBeenCalledTimes(4);
  });
});
