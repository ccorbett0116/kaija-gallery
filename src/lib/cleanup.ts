// src/lib/cleanup.ts
import { readdir, stat, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const getChunkDir = () => {
    // If MEDIA_PATH is set, put chunks alongside media
    // Otherwise use default location
    const mediaPath = process.env.MEDIA_PATH || path.join(process.cwd(), 'data', 'media');
    const dataDir = path.dirname(mediaPath); // Get parent directory
    return path.join(dataDir, 'chunks');
};

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function cleanupAbandonedChunks(): Promise<{
    deleted: number;
    errors: string[];
}> {
    const deleted: string[] = [];
    const errors: string[] = [];
    const CHUNK_DIR = getChunkDir();

    try {
        // Check if chunks directory exists
        if (!existsSync(CHUNK_DIR)) {
            console.log('Chunks directory does not exist, nothing to clean up');
            return { deleted: 0, errors: [] };
        }

        const entries = await readdir(CHUNK_DIR);
        const now = Date.now();

        for (const entry of entries) {
            const uploadDir = path.join(CHUNK_DIR, entry);

            try {
                const stats = await stat(uploadDir);

                // Only process directories
                if (!stats.isDirectory()) continue;

                // Check if directory is older than 24 hours
                const ageMs = now - stats.mtimeMs;

                if (ageMs > MAX_AGE_MS) {
                    await rm(uploadDir, { recursive: true, force: true });
                    deleted.push(entry);
                    console.log(`Deleted abandoned chunk folder: ${entry} (${Math.round(ageMs / (60 * 60 * 1000))} hours old)`);
                }
            } catch (err) {
                const errorMsg = `Failed to process ${entry}: ${err instanceof Error ? err.message : String(err)}`;
                errors.push(errorMsg);
                console.error(errorMsg);
            }
        }

        if (deleted.length > 0) {
            console.log(`Cleanup complete: ${deleted.length} abandoned chunk folder(s) deleted`);
        } else {
            console.log('Cleanup complete: no abandoned chunks found');
        }

        return { deleted: deleted.length, errors };
    } catch (err) {
        const errorMsg = `Chunk cleanup failed: ${err instanceof Error ? err.message : String(err)}`;
        console.error(errorMsg);
        return { deleted: 0, errors: [errorMsg] };
    }
}
