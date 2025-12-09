// src/lib/cleanup-scheduler.ts
import { cleanupAbandonedChunks } from './cleanup';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let isInitialized = false;
let cleanupInterval: NodeJS.Timeout | null = null;

export function initializeCleanupScheduler() {
    if (isInitialized) {
        return;
    }

    isInitialized = true;

    // Run cleanup immediately on startup
    console.log('Running initial chunk cleanup...');
    cleanupAbandonedChunks().catch(err => {
        console.error('Initial cleanup failed:', err);
    });

    // Set up periodic cleanup every 6 hours
    cleanupInterval = setInterval(() => {
        console.log('Running scheduled chunk cleanup...');
        cleanupAbandonedChunks().catch(err => {
            console.error('Scheduled cleanup failed:', err);
        });
    }, CLEANUP_INTERVAL_MS);

    console.log('Chunk cleanup scheduler initialized (runs every 6 hours)');
}

// Cleanup on shutdown (optional, for graceful shutdown)
if (typeof process !== 'undefined') {
    process.on('SIGTERM', () => {
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
        }
    });
}
