import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('🔗 New WebSocket connection established');
    clients.add(ws);

    // Send welcome message
    const welcomeMessage: WebSocketMessage = {
      type: 'connection',
      data: { message: 'Connected to ExpenseAI real-time updates' },
      timestamp: Date.now()
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(welcomeMessage));
    }

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        console.log('📨 Received WebSocket message:', message.type);
        
        // Echo message back or handle specific message types
        if (message.type === 'ping') {
          const pongMessage: WebSocketMessage = {
            type: 'pong',
            timestamp: Date.now()
          };
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(pongMessage));
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Function to broadcast to all connected clients
  const broadcast = (message: WebSocketMessage) => {
    const messageStr = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  };

  // Function to notify expense updates
  const notifyExpenseUpdate = (expense: any, action: 'create' | 'update' | 'delete') => {
    const message: WebSocketMessage = {
      type: 'expense_update',
      data: { expense, action },
      timestamp: Date.now()
    };
    broadcast(message);
  };

  // Function to notify insights updates
  const notifyInsightsUpdate = (insights: any[]) => {
    const message: WebSocketMessage = {
      type: 'insights_update',
      data: { insights },
      timestamp: Date.now()
    };
    broadcast(message);
  };

  // Function to notify analytics updates
  const notifyAnalyticsUpdate = (analytics: any) => {
    const message: WebSocketMessage = {
      type: 'analytics_update',
      data: { analytics },
      timestamp: Date.now()
    };
    broadcast(message);
  };

  return {
    broadcast,
    notifyExpenseUpdate,
    notifyInsightsUpdate,
    notifyAnalyticsUpdate,
    getConnectedClientsCount: () => clients.size
  };
}