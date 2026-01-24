'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDeviceStore } from '@/stores/device-store';

export interface BroadcastMessage {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title?: string;
  duration?: number;
  senderId?: string;
  senderName?: string;
  timestamp: string;
}

interface UseDeviceSocketOptions {
  onBroadcast?: (message: BroadcastMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useDeviceSocket(options: UseDeviceSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { deviceToken, organizationId, status } = useDeviceStore();

  const connect = useCallback(() => {
    if (!deviceToken || status !== 'verified') return;

    // Get base URL without /api suffix for WebSocket connection
    let wsUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    // Remove /api or /api/ suffix if present
    wsUrl = wsUrl.replace(/\/api\/?$/, '');

    console.log('Connecting to WebSocket:', wsUrl);

    socketRef.current = io(wsUrl, {
      auth: {
        deviceToken,
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      options.onConnect?.();
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      options.onDisconnect?.();
    });

    socketRef.current.on('broadcastMessage', (message: BroadcastMessage) => {
      options.onBroadcast?.(message);
    });

    socketRef.current.on('connected', (data: { deviceId?: string }) => {
      console.log('Socket connected:', data);
    });

    socketRef.current.on('error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
  }, [deviceToken, status, options]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [deviceToken, status]); // Reconnect when token or status changes

  return {
    isConnected,
    socket: socketRef.current,
    connect,
    disconnect,
  };
}
