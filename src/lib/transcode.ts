// src/lib/transcode.ts
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import {
    getPendingVideos,
    updateTranscodingStatus,
    updateVideoAfterTranscoding,
} from './media';
import { transcodeEvents } from './events';

const getMediaDir = () => {
    return process.env.MEDIA_PATH || path.join(process.cwd(), 'data', 'media');
};

export async function processNextPendingVideo(): Promise<{
    success: boolean;
    message: string;
    mediaId?: number;
}> {
    const pending = getPendingVideos();

    if (pending.length === 0) {
        return { success: true, message: 'No pending videos' };
    }

    const video = pending[0];
    const baseDir = getMediaDir();

    try {
        // Mark as processing
        updateTranscodingStatus(video.media_id, 'processing');
        console.log(`[Transcode] Emitting status-change: mediaId=${video.media_id}, status=processing`);
        transcodeEvents.emit('status-change', { mediaId: video.media_id, status: 'processing' });

        const originalPath = path.join(baseDir, video.file_path_original);
        const ext = path.extname(video.file_path_original);
        const basename = path.basename(video.file_path_original, ext);

        // Transcode to H.264 MP4
        const webFilename = `${basename}.mp4`;
        const webPath = path.join(baseDir, 'web-videos', webFilename);
        const relativeWebPath = path.relative(baseDir, webPath);

        await new Promise<void>((resolve, reject) => {
            ffmpeg(originalPath)
                .videoCodec('libx264')
                .outputOptions([
                    '-preset medium',
                    '-crf 23',
                    '-movflags +faststart',
                ])
                .output(webPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });

        // Generate poster frame thumbnail
        const thumbFilename = `${basename}-thumb.jpg`;
        const thumbPath = path.join(baseDir, 'thumbnails', thumbFilename);
        const relativeThumbPath = path.relative(baseDir, thumbPath);

        await new Promise<void>((resolve, reject) => {
            ffmpeg(webPath)
                .screenshots({
                    timestamps: ['00:00:01'],
                    filename: thumbFilename,
                    folder: path.join(baseDir, 'thumbnails'),
                    size: '400x?',
                })
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });

        // Update database with new paths and mark as completed
        updateVideoAfterTranscoding(video.media_id, relativeWebPath, relativeThumbPath);
        console.log(`[Transcode] Emitting status-change: mediaId=${video.media_id}, status=completed`);
        transcodeEvents.emit('status-change', { mediaId: video.media_id, status: 'completed' });

        return {
            success: true,
            message: `Successfully transcoded video ${video.media_id}`,
            mediaId: video.media_id,
        };
    } catch (error) {
        console.error('Transcoding error:', error);
        updateTranscodingStatus(video.media_id, 'failed');
        transcodeEvents.emit('status-change', { mediaId: video.media_id, status: 'failed' });

        return {
            success: false,
            message: error instanceof Error ? error.message : 'Transcoding failed',
            mediaId: video.media_id,
        };
    }
}

// Process all pending videos in queue
export async function processAllPendingVideos() {
    let processed = 0;
    while (true) {
        const result = await processNextPendingVideo();
        if (result.message === 'No pending videos') {
            break;
        }
        if (result.success) {
            processed++;
        }
    }
    return processed;
}
