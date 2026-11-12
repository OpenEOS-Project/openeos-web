import { expect, test } from '@playwright/test';

import { sessionSocketOptions } from '@/lib/session-socket';

test.describe('session socket options', () => {
  test('send the session cookie on every transport', () => {
    const options = sessionSocketOptions(() => null);
    expect(options.withCredentials).toBe(true);
    expect(options.path).toBe('/socket.io');
  });

  test('hand over the current token on each (re)connect, none without one', () => {
    let token: string | null = null;
    const options = sessionSocketOptions(() => token);
    const auth = options.auth as (cb: (data: object) => void) => void;
    const seen: object[] = [];
    auth((data) => seen.push(data));
    token = 'abc';
    auth((data) => seen.push(data));
    expect(seen).toEqual([{ token: undefined }, { token: 'abc' }]);
  });
});
