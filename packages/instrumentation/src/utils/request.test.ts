/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  getFetchBodyLength,
  getXHRBodyLength,
  normalizeHttpRequestMethod,
} from './request.ts';

const ENCODER = new TextEncoder();
function textToReadableStream(msg: string) {
  return new ReadableStream({
    start: (controller) => {
      controller.enqueue(ENCODER.encode(msg));
      controller.close();
    },
    cancel: (controller) => {
      controller.close();
    },
  });
}

describe('getXHRBodyLength', () => {
  it('should compute body length for Document payload', () => {
    // webworkers don't have DOMParser
    if (typeof DOMParser === 'undefined') {
      expect(true).toBeTruthy();
      return;
    }
    const doc = new DOMParser().parseFromString(
      '<html><head><head/><body><p>hello world</p></body>',
      'text/html',
    );

    const length = getXHRBodyLength(doc);
    expect(length).toBeDefined();
    expect(length).toBeGreaterThan(0);
  });

  it('should compute body length for Blob payload', () => {
    const blob = new Blob(['hello world'], {
      type: 'text/plain',
    });

    expect(getXHRBodyLength(blob)).toEqual(11);
  });

  it('should compute body length for ArrayBuffer/ArrayBufferView payload', () => {
    const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;

    expect(getXHRBodyLength(arrayBuffer)).toEqual(3);
    expect(getXHRBodyLength(new ArrayBuffer(8))).toEqual(8);
    expect(getXHRBodyLength(new ArrayBuffer(8).slice(0, 2))).toEqual(2);
    expect(getXHRBodyLength(new ArrayBuffer(0))).toEqual(0);
  });

  it('should compute body length for FormData payload', () => {
    const formData = new FormData();
    formData.append('key1', 'true');
    formData.append('key2', 'hello world');

    expect(getXHRBodyLength(formData)).toEqual(23);
    expect(getXHRBodyLength(new FormData())).toEqual(0);
  });

  it('should compute body length for FormData payload with a file', () => {
    const formData = new FormData();
    const f = new File(
      ['hello world hello world hello world'],
      'test_file.txt',
    );
    formData.append('file', f);

    // length should be:
    // 4 for the key of the file in the form data
    // 35 for the file contents
    expect(getXHRBodyLength(formData)).toEqual(39);
  });

  it('should compute body length for URLSearchParams payload', () => {
    const search = new URLSearchParams({
      key1: 'true',
      key2: 'hello world',
    });

    expect(getXHRBodyLength(search)).toEqual(26);
    expect(getXHRBodyLength(new URLSearchParams())).toEqual(0);
  });

  it('should compute body length for string payload', () => {
    const jsonString = JSON.stringify({
      key1: 'true',
      key2: 'hello world',
    });
    expect(getXHRBodyLength(jsonString)).toEqual(36);
    expect(getXHRBodyLength('hello world')).toEqual(11);
    expect(getXHRBodyLength('π')).toEqual(2); // one character, 2 bytes
    expect(getXHRBodyLength('🔥🔪😭')).toEqual(12); // each emoji is 4 bytes
    expect(getXHRBodyLength('مرحبا بالعالم')).toEqual(25); // hello world in Arabic is 25 bytes
    expect(getXHRBodyLength('')).toEqual(0);
  });
});

describe('getFetchBodyLength', () => {
  it('should read the body of the second param when the first param is string', async () => {
    const jsonString = JSON.stringify({
      key1: 'true',
      key2: 'hello world',
    });
    const length = await getFetchBodyLength('https://example.com', {
      body: jsonString,
    });
    expect(length).toEqual(36);
  });

  it('should handle undefined body', async () => {
    const length = await getFetchBodyLength('https://example.com', {});
    expect(length).toBeUndefined();
  });

  it('should handle unicode body', async () => {
    const length = await getFetchBodyLength('https://example.com', {
      body: 'π🔥🔪😭',
    });
    expect(length).toEqual(14); // pi is 2 bytes, each emoji is 4
  });

  it('should (non-destructively) read the body stream of the second param when the first param is string', async () => {
    const jsonString = JSON.stringify({
      key1: 'true',
      key2: 'hello world',
    });
    const requestParams = { body: textToReadableStream(jsonString) };
    const lengthPromise = getFetchBodyLength(
      'https://example.com',
      requestParams,
    );

    // if we try to await lengthPromise here, we get a timeout

    let lengthResolved = false;
    lengthPromise.finally(() => (lengthResolved = true));

    // length doesn't get read yet
    expect(lengthResolved).toBe(false);

    // the body is still readable
    expect(requestParams.body.locked).toBe(false);

    // AND the body is still correct
    const { value } = await requestParams.body.getReader().read();
    const decoder = new TextDecoder();
    expect(decoder.decode(value)).toStrictEqual(jsonString);

    // AND now length got read, and we got the correct length
    const length = await lengthPromise;
    expect(lengthResolved).toBe(true);
    expect(length).toBe(36);
  });

  it('should (non-destructively) read the unicode body stream of the second param when the first param is string', async () => {
    const bodyString = 'π🔥🔪😭';
    const requestParams = { body: textToReadableStream(bodyString) };
    const lengthPromise = getFetchBodyLength(
      'https://example.com',
      requestParams,
    );

    // if we try to await lengthPromise here, we get a timeout

    let lengthResolved = false;
    lengthPromise.finally(() => (lengthResolved = true));

    // length doesn't get read yet
    expect(lengthResolved).toBe(false);

    // the body is still readable
    expect(requestParams.body.locked).toBe(false);

    // AND the body is still correct
    const { value } = await requestParams.body.getReader().read();
    const decoder = new TextDecoder();
    expect(decoder.decode(value)).toStrictEqual(bodyString);

    // AND now length got read, and we got the correct length
    const length = await lengthPromise;
    expect(lengthResolved).toBe(true);
    expect(length).toBe(14);
  });

  it('should handle readablestream objects without a pipeThrough method', async () => {
    const jsonString = JSON.stringify({
      key1: 'true',
      key2: 'hello world',
    });
    const stream = textToReadableStream(jsonString);

    // @ts-expect-error intentionally remove the .tee() method to mimic older environments where this method isn't available
    stream.pipeThrough = undefined;

    const requestParams = { body: stream };
    const length = await getFetchBodyLength(
      'https://example.com',
      requestParams,
    );

    // we got the correct length
    expect(length).toBeUndefined();

    // AND the body is still readable
    expect(requestParams.body.locked).toBe(false);

    // AND the body is still correct
    const { value } = await requestParams.body.getReader().read();
    const decoder = new TextDecoder();
    expect(decoder.decode(value)).toStrictEqual(jsonString);
  });

  it('should read the body of the first param when receiving a request', async () => {
    const bodyContent = JSON.stringify({
      key1: 'true',
      key2: 'hello world',
    });
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: {
        foo: 'bar',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: bodyContent,
    });

    const length = await getFetchBodyLength(req);

    // we got the correct length
    expect(length).toBe(36);

    // AND the body is still readable and correct
    const body = await req.text();
    expect(body).toStrictEqual(bodyContent);
  });

  it('should read the body of the first param when receiving a request with urlparams body', async () => {
    const body = new URLSearchParams();
    body.append('hello', 'world');

    const req = new Request('https://example.com', {
      method: 'POST',
      headers: {
        foo: 'bar',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    });

    const length = await getFetchBodyLength(req);

    // we got the correct length
    expect(length).toBe(11);

    // AND the body is still readable and correct
    const requestBody = await req.text();
    expect(requestBody).toStrictEqual('hello=world');
  });
});

describe('normalizeHttpRequestMethod', () => {
  it('should return the method in uppercase', () => {
    expect(normalizeHttpRequestMethod('get')).toEqual('GET');
    expect(normalizeHttpRequestMethod('post')).toEqual('POST');
  });

  it('should return _OTHER if method is not known', () => {
    expect(normalizeHttpRequestMethod('foo')).toEqual('_OTHER');
  });
});
