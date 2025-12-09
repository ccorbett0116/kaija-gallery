// src/lib/events.ts
import { EventEmitter } from 'events';

// Global event emitter for server-side events
class TranscodeEventEmitter extends EventEmitter {}

// Use globalThis to ensure singleton across module reloads in dev
const globalForEvents = globalThis as unknown as {
    transcodeEvents: TranscodeEventEmitter | undefined;
};

export const transcodeEvents = globalForEvents.transcodeEvents ?? new TranscodeEventEmitter();

if (!globalForEvents.transcodeEvents) {
    globalForEvents.transcodeEvents = transcodeEvents;
    // Increase max listeners to handle multiple SSE connections
    transcodeEvents.setMaxListeners(20);

    // Debug logging
    transcodeEvents.on('status-change', (data) => {
        console.log('[EventEmitter] status-change event received:', data);
    });

    console.log('[Events] Global EventEmitter initialized');
}
