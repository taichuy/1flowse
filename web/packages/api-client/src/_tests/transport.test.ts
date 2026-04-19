import { afterEach, describe, expect, test, vi } from 'vitest';

import { apiFetch } from '../transport';

describe('apiFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('apiFetch sends credentials and propagates x-csrf-token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ok: true }, meta: null }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );

    const payload = await apiFetch<{ ok: boolean }>({
      path: '/api/console/session',
      method: 'GET',
      csrfToken: 'csrf-123',
      baseUrl: 'http://127.0.0.1:7800'
    });

    expect(payload).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:7800/api/console/session',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'x-csrf-token': 'csrf-123'
        })
      })
    );
  });

  test('apiFetch throws ApiClientError for non-2xx responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'not_authenticated',
          message: 'not authenticated'
        }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    await expect(
      apiFetch({
        path: '/api/console/session',
        baseUrl: 'http://127.0.0.1:7800'
      })
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiClientError',
        status: 401,
        code: 'not_authenticated',
        message: 'not authenticated',
        body: {
          code: 'not_authenticated',
          message: 'not authenticated'
        }
      })
    );
  });

  test('apiFetch supports FormData bodies without forcing JSON content-type', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true }, meta: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    const formData = new FormData();
    formData.set('file', new Blob(['hello']), 'hello.1flowbasepkg');

    await apiFetch<{ ok: boolean }>({
      path: '/api/console/plugins/install-upload',
      method: 'POST',
      rawBody: formData,
      contentType: null,
      baseUrl: 'http://127.0.0.1:7800'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:7800/api/console/plugins/install-upload',
      expect.objectContaining({
        body: formData,
        headers: {}
      })
    );
  });
});
