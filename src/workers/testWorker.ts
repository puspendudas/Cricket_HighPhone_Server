// testWorker.ts - Simple test worker to debug worker thread issues

import { isMainThread, parentPort } from 'worker_threads';

// Debug function for worker thread
function log(message: string, ...args: any[]) {
  console.log(`[TestWorker] ${message}`, ...args);
}

log('Test worker file loaded');

class TestWorker {
  private isReady = false;

  constructor() {
    log('Starting test worker constructor...');
    this.initializeWorker();
  }

  private initializeWorker(): void {
    try {
      log('Setting up message handlers...');
      this.setupMessageHandlers();
      this.isReady = true;
      log('Test worker initialized successfully');
    } catch (error) {
      log(`Failed to initialize test worker: ${(error as Error).message}`);
    }
  }

  private setupMessageHandlers(): void {
    log('Setting up message handlers...');
    
    if (!isMainThread && parentPort) {
      parentPort.on('message', (message) => {
        log(`Received message in worker: ${JSON.stringify(message)}`);
        this.handleMessage(message);
      });
      log('Message handlers setup complete');
    } else {
      log('ERROR: Not in worker thread or parentPort is null!');
    }
  }

  private handleMessage(message: any): void {
    const { type, id } = message;
    
    log(`Handling message type: ${type} with id: ${id}`);
    
    switch (type) {
      case 'PING':
        log(`Responding to PING message with id: ${id}`);
        this.sendResponse(id, { 
          success: true, 
          message: 'Test worker is ready' 
        });
        log(`PING response sent for id: ${id}`);
        break;
        
      default:
        log(`Unknown message type: ${type}`);
        this.sendResponse(id, { 
          success: false, 
          error: 'Unknown message type' 
        });
    }
  }

  private sendResponse(messageId: string, response: any): void {
    if (!isMainThread && parentPort) {
      const fullResponse = { id: messageId, ...response };
      log(`Sending response: ${JSON.stringify(fullResponse)}`);
      parentPort.postMessage(fullResponse);
    } else {
      log('Cannot send response - not in worker thread or no parentPort');
    }
  }
}

// Only create worker instance if we're in a worker thread
if (!isMainThread) {
  log('Creating test worker instance...');
  new TestWorker();
} else {
  log('Running in main thread - not creating worker instance');
}

log('Test worker file execution complete');