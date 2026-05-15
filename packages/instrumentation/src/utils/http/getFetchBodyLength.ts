/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

const TEXT_ENCODER = new TextEncoder();

export async function getFetchBodyLength(
  ...args: Parameters<typeof fetch>
): Promise<number | undefined> {
  if (args[0] instanceof URL || typeof args[0] === 'string') {
    const init = args[1];

    if (!init?.body) {
      return undefined;
    }

    if (init.body instanceof ReadableStream) {
      const { body, length } = await measureStreamNonDestructively(init.body);
      init.body = body;
      return length;
    }

    return getBodyLength(init.body);
  }

  const req = args[0];

  // request.body is not yet Baseline (not supported in Mozilla).
  // This guard is necessary to avoid errors in unsupported browsers
  // eslint-disable-next-line baseline-js/use-baseline
  if (!req?.body) {
    return undefined;
  }

  const body = await req.clone().text();

  return getByteLength(body);
}

async function measureStreamNonDestructively(
  body: ReadableStream,
): Promise<{ body: ReadableStream; length: number | undefined }> {
  if (!body.getReader) {
    return { body, length: undefined };
  }
  const chunks: Uint8Array[] = [];
  const reader = body.getReader();
  let next = await reader.read();

  while (!next.done) {
    chunks.push(next.value);
    next = await reader.read();
  }

  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const newBody = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  return { body: newBody, length };
}

function getBodyLength(
  body: Exclude<BodyInit, ReadableStream>,
): number | undefined {
  if (typeof body === 'string') {
    return getByteLength(body);
  }

  if (body instanceof Blob) {
    return body.size;
  }

  if (body instanceof FormData) {
    let size = 0;
    for (const [key, value] of body.entries()) {
      size += key.length;
      size += value instanceof Blob ? value.size : (value as string).length;
    }
    return size;
  }

  if (body instanceof URLSearchParams) {
    return getByteLength(body.toString());
  }

  if ('byteLength' in body && typeof body.byteLength === 'number') {
    return body.byteLength;
  }

  return undefined;
}

function getByteLength(s: string): number {
  return TEXT_ENCODER.encode(s).byteLength;
}
