import { describe, it, expect } from 'vitest';

import {
  ImageParserError,
  FormatDetectionError,
  CodecError,
  WorkerError,
  FetchError,
  TimeoutError,
  AbortError,
  ProbeError,
} from '../../src/errors/errors';
import { ErrorCodes } from '../../src/errors/codes';

describe('ImageParserError', () => {
  it('constructor sets code, message, and cause', () => {
    const cause = new Error('root cause');
    const error = new ImageParserError('DECODE_FAILED', 'decode went wrong', cause);

    expect(error.code).toBe('DECODE_FAILED');
    expect(error.message).toBe('decode went wrong');
    expect(error.cause).toBe(cause);
  });

  it('is an instance of Error', () => {
    const error = new ImageParserError('INVALID_INPUT', 'bad input');

    expect(error).toBeInstanceOf(Error);
  });

  it('has name "ImageParserError"', () => {
    const error = new ImageParserError('INVALID_INPUT', 'bad input');

    expect(error.name).toBe('ImageParserError');
  });

  it('toJSON() returns code, message, and stack', () => {
    const error = new ImageParserError('FETCH_FAILED', 'network error');
    const json = error.toJSON();

    expect(json).toEqual({
      code: 'FETCH_FAILED',
      message: 'network error',
      stack: expect.any(String),
    });
  });

  it('toJSON() includes stack when available', () => {
    const error = new ImageParserError('RENDER_FAILED', 'canvas crash');
    const json = error.toJSON();

    expect(json.stack).toBeDefined();
    expect(typeof json.stack).toBe('string');
    expect(json.stack!.length).toBeGreaterThan(0);
  });

  it('preserves the cause through the error chain', () => {
    const rootCause = new TypeError('null reference');
    const wrappedError = new ImageParserError('DECODE_FAILED', 'decode failed', rootCause);

    expect(wrappedError.cause).toBe(rootCause);
    expect(wrappedError.cause).toBeInstanceOf(TypeError);
  });

  it('cause is undefined when not provided', () => {
    const error = new ImageParserError('INVALID_INPUT', 'missing data');

    expect(error.cause).toBeUndefined();
  });
});

describe('FormatDetectionError', () => {
  it('is an instance of ImageParserError', () => {
    const error = new FormatDetectionError('FORMAT_DETECTION_FAILED', 'unknown format');

    expect(error).toBeInstanceOf(ImageParserError);
  });

  it('is an instance of Error', () => {
    const error = new FormatDetectionError('FORMAT_DETECTION_FAILED', 'unknown format');

    expect(error).toBeInstanceOf(Error);
  });

  it('has name "FormatDetectionError"', () => {
    const error = new FormatDetectionError('FORMAT_DETECTION_FAILED', 'unknown format');

    expect(error.name).toBe('FormatDetectionError');
  });
});

describe('CodecError', () => {
  it('instanceof chain works', () => {
    const error = new CodecError('DECODE_FAILED', 'codec blew up');

    expect(error).toBeInstanceOf(CodecError);
    expect(error).toBeInstanceOf(ImageParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CodecError');
    expect(error.code).toBe('DECODE_FAILED');
    expect(error.message).toBe('codec blew up');
  });
});

describe('WorkerError', () => {
  it('instanceof chain works', () => {
    const error = new WorkerError('WORKER_CRASHED', 'worker died');

    expect(error).toBeInstanceOf(WorkerError);
    expect(error).toBeInstanceOf(ImageParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('WorkerError');
    expect(error.code).toBe('WORKER_CRASHED');
    expect(error.message).toBe('worker died');
  });
});

describe('FetchError', () => {
  it('instanceof chain works', () => {
    const error = new FetchError('FETCH_FAILED', 'network timeout');

    expect(error).toBeInstanceOf(FetchError);
    expect(error).toBeInstanceOf(ImageParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('FetchError');
    expect(error.code).toBe('FETCH_FAILED');
    expect(error.message).toBe('network timeout');
  });
});

describe('TimeoutError', () => {
  it('instanceof chain works', () => {
    const error = new TimeoutError('WORKER_TIMEOUT', 'took too long');

    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toBeInstanceOf(ImageParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TimeoutError');
    expect(error.code).toBe('WORKER_TIMEOUT');
    expect(error.message).toBe('took too long');
  });
});

describe('AbortError', () => {
  it('has default message "Operation aborted" and code "ABORTED"', () => {
    const error = new AbortError();

    expect(error.message).toBe('Operation aborted');
    expect(error.code).toBe('ABORTED');
  });

  it('accepts a custom message while keeping code "ABORTED"', () => {
    const error = new AbortError('user cancelled upload');

    expect(error.message).toBe('user cancelled upload');
    expect(error.code).toBe('ABORTED');
  });

  it('instanceof chain works', () => {
    const error = new AbortError();

    expect(error).toBeInstanceOf(AbortError);
    expect(error).toBeInstanceOf(ImageParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AbortError');
  });
});

describe('ProbeError', () => {
  it('instanceof chain works', () => {
    const error = new ProbeError('PROBE_FAILED', 'capability check failed');

    expect(error).toBeInstanceOf(ProbeError);
    expect(error).toBeInstanceOf(ImageParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ProbeError');
    expect(error.code).toBe('PROBE_FAILED');
    expect(error.message).toBe('capability check failed');
  });
});

describe('ErrorCodes', () => {
  it('all codes are unique strings', () => {
    const values = Object.values(ErrorCodes);
    const uniqueValues = new Set(values);

    expect(uniqueValues.size).toBe(values.length);

    for (const value of values) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('contains FORMAT_DETECTION_FAILED', () => {
    expect(ErrorCodes.FORMAT_DETECTION_FAILED).toBe('FORMAT_DETECTION_FAILED');
  });

  it('contains UNSUPPORTED_FORMAT', () => {
    expect(ErrorCodes.UNSUPPORTED_FORMAT).toBe('UNSUPPORTED_FORMAT');
  });

  it('contains DECODE_FAILED', () => {
    expect(ErrorCodes.DECODE_FAILED).toBe('DECODE_FAILED');
  });

  it('contains FETCH_FAILED', () => {
    expect(ErrorCodes.FETCH_FAILED).toBe('FETCH_FAILED');
  });

  it('contains ABORTED', () => {
    expect(ErrorCodes.ABORTED).toBe('ABORTED');
  });

  it('contains FILE_TOO_LARGE', () => {
    expect(ErrorCodes.FILE_TOO_LARGE).toBe('FILE_TOO_LARGE');
  });

  it('contains INVALID_INPUT', () => {
    expect(ErrorCodes.INVALID_INPUT).toBe('INVALID_INPUT');
  });

  it('contains WORKER_CRASHED', () => {
    expect(ErrorCodes.WORKER_CRASHED).toBe('WORKER_CRASHED');
  });

  it('contains WORKER_TIMEOUT', () => {
    expect(ErrorCodes.WORKER_TIMEOUT).toBe('WORKER_TIMEOUT');
  });

  it('contains WORKER_POOL_EXHAUSTED', () => {
    expect(ErrorCodes.WORKER_POOL_EXHAUSTED).toBe('WORKER_POOL_EXHAUSTED');
  });

  it('contains CODEC_INIT_FAILED', () => {
    expect(ErrorCodes.CODEC_INIT_FAILED).toBe('CODEC_INIT_FAILED');
  });

  it('contains CODEC_NOT_FOUND', () => {
    expect(ErrorCodes.CODEC_NOT_FOUND).toBe('CODEC_NOT_FOUND');
  });

  it('contains HEIC_DECODE_FAILED', () => {
    expect(ErrorCodes.HEIC_DECODE_FAILED).toBe('HEIC_DECODE_FAILED');
  });

  it('contains AVIF_DECODE_FAILED', () => {
    expect(ErrorCodes.AVIF_DECODE_FAILED).toBe('AVIF_DECODE_FAILED');
  });

  it('contains FETCH_TIMEOUT', () => {
    expect(ErrorCodes.FETCH_TIMEOUT).toBe('FETCH_TIMEOUT');
  });

  it('contains INCOMPLETE_BUFFER', () => {
    expect(ErrorCodes.INCOMPLETE_BUFFER).toBe('INCOMPLETE_BUFFER');
  });

  it('contains PROBE_TIMEOUT', () => {
    expect(ErrorCodes.PROBE_TIMEOUT).toBe('PROBE_TIMEOUT');
  });

  it('contains PROBE_FAILED', () => {
    expect(ErrorCodes.PROBE_FAILED).toBe('PROBE_FAILED');
  });

  it('contains NATIVE_DECODE_FAILED', () => {
    expect(ErrorCodes.NATIVE_DECODE_FAILED).toBe('NATIVE_DECODE_FAILED');
  });

  it('contains RENDER_FAILED', () => {
    expect(ErrorCodes.RENDER_FAILED).toBe('RENDER_FAILED');
  });

  it('contains SSR_NOT_SUPPORTED', () => {
    expect(ErrorCodes.SSR_NOT_SUPPORTED).toBe('SSR_NOT_SUPPORTED');
  });
});

describe('error cause preservation', () => {
  it('cause is preserved on subclass errors', () => {
    const original = new RangeError('out of bounds');
    const codec = new CodecError('DECODE_FAILED', 'decode failed', original);

    expect(codec.cause).toBe(original);
    expect(codec.cause).toBeInstanceOf(RangeError);
  });

  it('non-Error cause values are preserved', () => {
    const error = new WorkerError('WORKER_CRASHED', 'worker died', 'string cause');

    expect(error.cause).toBe('string cause');
  });

  it('nested cause chain is preserved', () => {
    const root = new Error('disk full');
    const mid = new CodecError('DECODE_FAILED', 'write failed', root);
    const top = new FetchError('FETCH_FAILED', 'save failed', mid);

    expect(top.cause).toBe(mid);
    expect((top.cause as CodecError).cause).toBe(root);
  });
});

describe('toJSON serialization', () => {
  it('includes stack when available on subclass errors', () => {
    const error = new FormatDetectionError('FORMAT_DETECTION_FAILED', 'bad magic bytes');
    const json = error.toJSON();

    expect(json.code).toBe('FORMAT_DETECTION_FAILED');
    expect(json.message).toBe('bad magic bytes');
    expect(json.stack).toBeDefined();
    expect(typeof json.stack).toBe('string');
  });

  it('does not include cause in JSON output', () => {
    const cause = new Error('root');
    const error = new ImageParserError('DECODE_FAILED', 'failed', cause);
    const json = error.toJSON();

    expect(json).toEqual({
      code: 'DECODE_FAILED',
      message: 'failed',
      stack: expect.any(String),
    });
    expect((json as Record<string, unknown>)['cause']).toBeUndefined();
  });
});
