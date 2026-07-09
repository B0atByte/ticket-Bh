import { describe, it, expect } from 'vitest';
import { logger } from './logger.js';

describe('logger', () => {
  it('exports a winston-shaped logger', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('does not throw when invoked', () => {
    expect(() => logger.info('test info')).not.toThrow();
    expect(() => logger.warn('test warn')).not.toThrow();
    expect(() => logger.error('test error', new Error('x'))).not.toThrow();
  });
});
