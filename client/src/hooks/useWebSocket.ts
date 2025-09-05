import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔗 WebSocket connected');
        setIsConnected(true);
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          
          // Handle different message types
          switch (message.type) {
            case 'connection':
              console.log('✅ WebSocket connection confirmed');
              break;
              
            case 'expense_update':
              console.log('💰 Expense update received:', message.data);
              // Invalidate relevant queries to refresh data
              queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
              queryClient.invalidateQueries({ queryKey: ['/api/analytics/stats'] });
              
              toast({
                title: "Expense Updated",
                description: "Your expenses have been updated in real-time.",
              });
              break;
              
            case 'insights_update':
              console.log('🧠 Insights update received:', message.data);
              queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
              
              toast({
                title: "New Insights Available",
                description: "Fresh AI insights have been generated for your expenses.",
              });
              break;
              
            case 'analytics_update':
              console.log('📊 Analytics update received:', message.data);
              queryClient.invalidateQueries({ queryKey: ['/api/analytics/stats'] });
              break;
              
            case 'pong':
              console.log('🏓 WebSocket ping-pong successful');
              break;
              
            default:
              console.log('📨 Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect WebSocket...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  };

  const sendPing = () => {
    sendMessage({ type: 'ping', timestamp: Date.now() });
  };

  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  // Ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (isConnected) {
      const pingInterval = setInterval(sendPing, 30000);
      return () => clearInterval(pingInterval);
    }
  }, [isConnected]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    sendPing,
    connect,
    disconnect
  };
}