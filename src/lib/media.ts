// src/lib/media.ts
import db from './db';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

// ffmpeg will use system-installed binary
// On Pi: installed via `apt install ffmpeg`
// On Windows dev: install from https://ffmpeg.org/download.html and add to PATH

export type MediaEntry = {
    media_id: number;
    title: string | null;
    date: string | null;
    file_path_original: string;
    file_path_thumb: string | null;
    file_path_display: string | null;
    media_type: 'image' | 'video';
    sort_order: number;
    uploaded_at: string;
    transcoding_status: 'pending' | 'processing' | 'completed' | 'failed';
};

// Base media directory
const getMediaDir = () => {
    return process.env.MEDIA_PATH || path.join(process.cwd(), 'data', 'media');
};

// Ensure all media subdirectories exist
export function ensureMediaDirs() {
    const baseDir = getMediaDir();
    const dirs = ['originals', 'display', 'thumbnails', 'web-videos'];

    for (const dir of dirs) {
        const fullPath = path.join(baseDir, dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }
}

// List all media (optionally filter by date)
export function listMedia(title?: string, date?: string): MediaEntry[] {
    let query = `
        SELECT media_id, title, date, file_path_original, file_path_thumb,
               file_path_display, media_type, sort_order, uploaded_at, transcoding_status
        FROM media
    `;
    const params: any[] = [];

    if (title && date) {
        query += ' WHERE title = ? AND date = ?';
        params.push(title, date);
    } else if (title === null && date === null) {
        // Only unlinked media
        query += ' WHERE title IS NULL AND date IS NULL';
    }

    query += ' ORDER BY uploaded_at DESC';

    const stmt = db.prepare(query);
    return stmt.all(...params) as MediaEntry[];
}

// Process image from existing file path (for chunked uploads)
export async function processImageFromPath(
    originalPath: string,
    filename: string
): Promise<{ originalPath: string; displayPath: string; thumbPath: string }> {
    ensureMediaDirs();
    const baseDir = getMediaDir();

    const ext = path.extname(filename).toLowerCase();
    const basename = path.basename(filename, ext);
    const timestamp = Date.now();

    // Read the already-saved original file
    const buffer = fs.readFileSync(originalPath);
    const relativeOriginal = path.relative(baseDir, originalPath);

    // Generate display version:
    // - If original is JPEG/JPG/PNG → serve original directly (no conversion)
    // - Otherwise (HEIC, WebP, etc) → convert to JPEG 98% quality
    let displayPath: string;
    let relativeDisplay: string;
    const isJpegOrPng = ['.jpg', '.jpeg', '.png'].includes(ext);

    if (isJpegOrPng) {
        // Use original directly for display
        displayPath = originalPath;
        relativeDisplay = relativeOriginal;
    } else {
        // Convert to high-quality JPEG
        const displayFilename = `${basename}-${timestamp}.jpg`;
        displayPath = path.join(baseDir, 'display', displayFilename);
        await sharp(buffer)
            .jpeg({ quality: 98 })
            .toFile(displayPath);
        relativeDisplay = path.relative(baseDir, displayPath);
    }

    // Generate WebP thumbnail (400px width, maintain aspect ratio)
    const thumbFilename = `${basename}-${timestamp}-thumb.webp`;
    const thumbPath = path.join(baseDir, 'thumbnails', thumbFilename);
    await sharp(buffer)
        .resize(400, null, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbPath);
    const relativeThumb = path.relative(baseDir, thumbPath);

    return {
        originalPath: relativeOriginal,
        displayPath: relativeDisplay,
        thumbPath: relativeThumb,
    };
}

// Process uploaded image: save original, generate display version, generate thumbnail
export async function processImage(
    file: File,
    filename: string
): Promise<{ original: string; display: string; thumbnail: string }> {
    ensureMediaDirs();
    const baseDir = getMediaDir();

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(filename).toLowerCase();
    const basename = path.basename(filename, ext);
    const timestamp = Date.now();

    // Save original
    const originalFilename = `${basename}-${timestamp}${ext}`;
    const originalPath = path.join(baseDir, 'originals', originalFilename);
    fs.writeFileSync(originalPath, buffer);

    // Generate display version:
    // - If original is JPEG/JPG/PNG → serve original directly (no conversion)
    // - Otherwise (HEIC, WebP, etc) → convert to JPEG 98% quality
    let displayPath: string;
    const isJpegOrPng = ['.jpg', '.jpeg', '.png'].includes(ext);

    if (isJpegOrPng) {
        // Use original directly for display
        displayPath = originalPath;
    } else {
        // Convert to high-quality JPEG
        const displayFilename = `${basename}-${timestamp}.jpg`;
        displayPath = path.join(baseDir, 'display', displayFilename);
        await sharp(buffer)
            .jpeg({ quality: 98 })
            .toFile(displayPath);
    }

    // Generate WebP thumbnail (400px width, maintain aspect ratio)
    const thumbFilename = `${basename}-${timestamp}-thumb.webp`;
    const thumbPath = path.join(baseDir, 'thumbnails', thumbFilename);
    await sharp(buffer)
        .resize(400, null, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbPath);

    return {
        original: path.relative(baseDir, originalPath),
        display: path.relative(baseDir, displayPath),
        thumbnail: path.relative(baseDir, thumbPath),
    };
}

// Process uploaded video: save original, transcode to H.264, generate poster frame
export async function processVideo(
    file: File,
    filename: string
): Promise<{ original: string; display: string; thumbnail: string }> {
    ensureMediaDirs();
    const baseDir = getMediaDir();

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    const timestamp = Date.now();

    // Save original
    const originalFilename = `${basename}-${timestamp}${ext}`;
    const originalPath = path.join(baseDir, 'originals', originalFilename);
    fs.writeFileSync(originalPath, buffer);

    // Transcode to H.264 MP4
    const webFilename = `${basename}-${timestamp}.mp4`;
    const webPath = path.join(baseDir, 'web-videos', webFilename);

    await new Promise<void>((resolve, reject) => {
        ffmpeg(originalPath)
            .videoCodec('libx264')
            .outputOptions([
                '-preset medium',
                '-crf 23',
                '-movflags +faststart'
            ])
            .output(webPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });

    // Generate poster frame (thumbnail)
    const thumbFilename = `${basename}-${timestamp}-thumb.jpg`;
    const thumbPath = path.join(baseDir, 'thumbnails', thumbFilename);

    await new Promise<void>((resolve, reject) => {
        ffmpeg(webPath)
            .screenshots({
                timestamps: ['00:00:01'],
                filename: thumbFilename,
                folder: path.join(baseDir, 'thumbnails'),
                size: '400x?'
            })
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });

    return {
        original: path.relative(baseDir, originalPath),
        display: path.relative(baseDir, webPath),
        thumbnail: path.relative(baseDir, thumbPath),
    };
}

// Create media entry in database
export function createMediaEntry(
    originalPath: string,
    displayPath: string,
    thumbPath: string,
    mediaType: 'image' | 'video',
    title?: string,
    date?: string
): number {
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO media (
            title, date, file_path_original, file_path_display,
            file_path_thumb, media_type, sort_order, uploaded_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `);

    const result = stmt.run(
        title || null,
        date || null,
        originalPath,
        displayPath,
        thumbPath,
        mediaType,
        now
    );

    return Number(result.lastInsertRowid);
}

// Get media by ID
export function getMediaById(mediaId: number): MediaEntry | undefined {
    const stmt = db.prepare(`
        SELECT media_id, title, date, file_path_original, file_path_thumb,
               file_path_display, media_type, sort_order, uploaded_at, transcoding_status
        FROM media
        WHERE media_id = ?
    `);

    return stmt.get(mediaId) as MediaEntry | undefined;
}

// Get pending videos for transcoding
export function getPendingVideos(): MediaEntry[] {
    const stmt = db.prepare(`
        SELECT media_id, title, date, file_path_original, file_path_thumb,
               file_path_display, media_type, sort_order, uploaded_at, transcoding_status
        FROM media
        WHERE media_type = 'video' AND transcoding_status = 'pending'
        ORDER BY uploaded_at ASC
        LIMIT 1
    `);

    return stmt.all() as MediaEntry[];
}

// Update transcoding status
export function updateTranscodingStatus(
    mediaId: number,
    status: 'pending' | 'processing' | 'completed' | 'failed'
) {
    const stmt = db.prepare(`
        UPDATE media
        SET transcoding_status = ?
        WHERE media_id = ?
    `);

    stmt.run(status, mediaId);
}

// Update video paths after transcoding
export function updateVideoAfterTranscoding(
    mediaId: number,
    displayPath: string,
    thumbPath: string
) {
    const stmt = db.prepare(`
        UPDATE media
        SET file_path_display = ?,
            file_path_thumb = ?,
            transcoding_status = 'completed'
        WHERE media_id = ?
    `);

    stmt.run(displayPath, thumbPath, mediaId);
}

// Link media to a date
export function linkMediaToDate(mediaId: number, title: string, date: string) {
    const stmt = db.prepare(`
        UPDATE media
        SET title = ?, date = ?
        WHERE media_id = ?
    `);

    stmt.run(title, date, mediaId);
}

// Unlink media from date
export function unlinkMediaFromDate(mediaId: number) {
    const stmt = db.prepare(`
        UPDATE media
        SET title = NULL, date = NULL
        WHERE media_id = ?
    `);

    stmt.run(mediaId);
}

// Delete media entry and all associated files
export function deleteMedia(mediaId: number) {
    const baseDir = getMediaDir();

    // Get the media entry to know which files to delete
    const media = getMediaById(mediaId);
    if (!media) {
        throw new Error('Media not found');
    }

    // Delete all files
    const filesToDelete = [
        media.file_path_original,
        media.file_path_display,
        media.file_path_thumb,
    ].filter(Boolean); // Filter out null values

    for (const relativePath of filesToDelete) {
        const fullPath = path.join(baseDir, relativePath as string);

        // Only delete if file exists and is not used by display (when display = original)
        if (fs.existsSync(fullPath)) {
            // Check if this is the original being used as display
            const isDuplicatePath = filesToDelete.filter(p => p === relativePath).length > 1;

            if (!isDuplicatePath) {
                fs.unlinkSync(fullPath);
            } else {
                // Only delete once if original = display
                const firstIndex = filesToDelete.indexOf(relativePath);
                if (filesToDelete.indexOf(relativePath) === firstIndex) {
                    fs.unlinkSync(fullPath);
                }
            }
        }
    }

    // Delete from database
    const stmt = db.prepare(`
        DELETE FROM media
        WHERE media_id = ?
    `);

    stmt.run(mediaId);
}
