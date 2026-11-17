import type { ManagerOptions, SocketOptions } from 'socket.io-client';

/**
 * Socket.IO options for live updates of a signed-in user (printers,
 * tables, menu import).
 *
 * The access token lives only in memory and is gone after a reload, until
 * the next refresh. The API therefore also accepts the httpOnly session
 * cookie on the handshake; `withCredentials` makes the browser send it on
 * the polling transport too (the WebSocket upgrade carries it anyway).
 * `auth` is a function so every reconnect hands over the current token.
 */
export function sessionSocketOptions(
  getToken: () => string | null,
): Partial<ManagerOptions & SocketOptions> {
  return {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: (cb) => cb({ token: getToken() ?? undefined }),
    reconnectionDelayMax: 10_000,
  };
}
