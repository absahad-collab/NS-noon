export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxw2gmdQAuOutLH44BKsnmN8Cy3kgRaXP3_zFhsZtD1J_iosmFP6sVAYwzE1sz5q1zcfg/exec';

export interface CallApiResponse<T = any> {
  ok: boolean;
  result?: T;
  error?: string;
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export async function callApi<T = any>(fn: string, args: unknown[] = []): Promise<CallApiResponse<T>> {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_DEPLOYMENT_ID')) {
    return {
      ok: false,
      error: 'APPS_SCRIPT_URL is not configured yet. Paste your deployed /exec URL in src/api/appsScript.ts.',
    };
  }
  let response: Response;
  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn, args }),
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : 'Network error');
  }
  if (!response.ok) {
    throw new NetworkError(`HTTP ${response.status}`);
  }
  let json: CallApiResponse<T>;
  try {
    json = (await response.json()) as CallApiResponse<T>;
  } catch {
    throw new NetworkError('Invalid JSON response from server.');
  }
  return json;
}

export function gs<T = any>(
  fn: string,
  args: unknown[],
  ok?: (res: T) => void,
  fail?: (errMsg: string, isNetwork: boolean) => void
): void {
  callApi<T>(fn, args)
    .then((res) => {
      if (res && res.ok) {
        ok?.(res.result as T);
      } else {
        fail?.((res && res.error) || 'Request failed.', false);
      }
    })
    .catch((err) => {
      const isNet = err instanceof NetworkError;
      fail?.((err && err.message) || 'Network problem.', isNet);
    });
}
