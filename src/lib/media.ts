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
    rotation: number;
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

// List media for bi-directional infinite scroll
const ORDER_KEY = 'COALESCE(date, uploaded_at)';

export function listMediaBidirectional(options: {
    limit?: number;
    olderThan?: string; // Load items older than this timestamp (capture-or-upload)
    newerThan?: string; // Load items newer than this timestamp (capture-or-upload)
    jumpToDate?: string; // Jump to specific date (capture-or-upload)
    jumpToBottom?: boolean; // Jump to oldest items
}): { media: MediaEntry[]; hasMoreOlder: boolean; hasMoreNewer: boolean } {
    const limit = options.limit || 50;

    let query = `
        SELECT media_id, title, date, file_path_original, file_path_thumb,
               file_path_display, media_type, sort_order, rotation, uploaded_at, transcoding_status
        FROM media
    `;
    const params: any[] = [];

    if (options.newerThan) {
        // Loading newer items (scrolling up) - get items after this timestamp
        query += ` WHERE ${ORDER_KEY} > ?`;
        params.push(options.newerThan);
        query += ` ORDER BY ${ORDER_KEY} ASC, uploaded_at ASC LIMIT ?`; // ASC to get closest items first, tie-break by upload
        params.push(limit);

        const stmt = db.prepare(query);
        const media = stmt.all(...params) as MediaEntry[];

        // Reverse to maintain DESC order in UI
        media.reverse();

        // Check if there are more newer items
        const newestStmt = db.prepare(`SELECT MAX(${ORDER_KEY}) as max FROM media`);
        const { max: newestTimestamp } = newestStmt.get() as { max: string };
        const hasMoreNewer = media.length > 0 && media[0].uploaded_at < newestTimestamp;

        // Check if there are older items
        const oldestInResult = media[media.length - 1]?.uploaded_at;
        const hasMoreOlder = oldestInResult ? checkHasOlderItems(oldestInResult) : false;

        return { media, hasMoreNewer, hasMoreOlder };
    } else if (options.olderThan) {
        // Loading older items (scrolling down) - get items before this timestamp
        query += ` WHERE ${ORDER_KEY} < ?`;
        params.push(options.olderThan);
        query += ` ORDER BY ${ORDER_KEY} DESC, uploaded_at DESC LIMIT ?`;
        params.push(limit);

        const stmt = db.prepare(query);
        const media = stmt.all(...params) as MediaEntry[];

        // Check if there are more older items
        const oldestInResult = media[media.length - 1]?.uploaded_at;
        const hasMoreOlder = oldestInResult ? checkHasOlderItems(oldestInResult) : false;

        // Check if there are newer items
        const newestInResult = media[0]?.uploaded_at;
        const hasMoreNewer = newestInResult ? checkHasNewerItems(newestInResult) : false;

        return { media, hasMoreNewer, hasMoreOlder };
    } else if (options.jumpToBottom) {
        // Jump to bottom - get oldest items
        query += ` ORDER BY ${ORDER_KEY} ASC, uploaded_at ASC LIMIT ?`; // ASC to get oldest first
        params.push(limit);

        const stmt = db.prepare(query);
        const media = stmt.all(...params) as MediaEntry[];

        // Reverse to maintain DESC order in UI
        media.reverse();

        const oldestInResult = media[media.length - 1]?.uploaded_at;
        const newestInResult = media[0]?.uploaded_at;
        const hasMoreOlder = false; // At the bottom, can't go older
        const hasMoreNewer = newestInResult ? checkHasNewerItems(newestInResult) : false;

        return { media, hasMoreNewer, hasMoreOlder };
    } else if (options.jumpToDate) {
        // Jump to specific date
        query += ` WHERE ${ORDER_KEY} <= ?`;
        params.push(options.jumpToDate);
        query += ` ORDER BY ${ORDER_KEY} DESC, uploaded_at DESC LIMIT ?`;
        params.push(limit);

        const stmt = db.prepare(query);
        const media = stmt.all(...params) as MediaEntry[];

        // Check both directions
        const oldestInResult = media[media.length - 1]?.uploaded_at;
        const newestInResult = media[0]?.uploaded_at;
        const hasMoreOlder = oldestInResult ? checkHasOlderItems(oldestInResult) : false;
        const hasMoreNewer = newestInResult ? checkHasNewerItems(newestInResult) : false;

        return { media, hasMoreNewer, hasMoreOlder };
    } else {
        // Initial load - get most recent items
        query += ` ORDER BY ${ORDER_KEY} DESC, uploaded_at DESC LIMIT ?`;
        params.push(limit);

        const stmt = db.prepare(query);
        const media = stmt.all(...params) as MediaEntry[];

        const oldestInResult = media[media.length - 1]?.uploaded_at;
        const hasMoreOlder = oldestInResult ? checkHasOlderItems(oldestInResult) : false;
        const hasMoreNewer = false; // Initial load starts at newest, can't go newer

        return { media, hasMoreNewer, hasMoreOlder };
    }
}

// Helper: Check if there are older items than given timestamp
function checkHasOlderItems(timestamp: string): boolean {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM media WHERE ${ORDER_KEY} < ?`);
    const { count } = stmt.get(timestamp) as { count: number };
    return count > 0;
}

// Helper: Check if there are newer items than given timestamp
function checkHasNewerItems(timestamp: string): boolean {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM media WHERE ${ORDER_KEY} > ?`);
    const { count } = stmt.get(timestamp) as { count: number };
    return count > 0;
}

// Get total media count
export function getTotalMediaCount(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM media');
    const { count } = stmt.get() as { count: number };
    return count;
}

// Get media items by index range (for virtual scrolling)
export function getMediaByRange(offset: number, limit: number): MediaEntry[] {
    const stmt = db.prepare(`
        SELECT media_id, title, date, file_path_original, file_path_thumb,
               file_path_display, media_type, sort_order, rotation, uploaded_at, transcoding_status
        FROM media
        ORDER BY ${ORDER_KEY} DESC, uploaded_at DESC
        LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as MediaEntry[];
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
): Promise<{ original: string; display: string; thumbnail: string; captureDate: string | null }> {
    ensureMediaDirs();
    const baseDir = getMediaDir();

    const buffer = Buffer.from(await file.arrayBuffer());
    const lastModifiedIso =
        typeof (file as any)?.lastModified === 'number'
            ? new Date((file as any).lastModified).toISOString()
            : null;
    const captureDate = (await extractImageCaptureDate(buffer, filename)) || lastModifiedIso;
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
        captureDate,
    };
}

// Process uploaded video: save original, transcode to H.264, generate poster frame
export async function processVideo(
    file: File,
    filename: string
): Promise<{ original: string; display: string; thumbnail: string; captureDate: string | null }> {
    ensureMediaDirs();
    const baseDir = getMediaDir();

    const buffer = Buffer.from(await file.arrayBuffer());
    const lastModifiedIso =
        typeof (file as any)?.lastModified === 'number'
            ? new Date((file as any).lastModified).toISOString()
            : null;
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

    const captureDate = (await extractVideoCaptureDate(originalPath, filename)) || lastModifiedIso;

    return {
        original: path.relative(baseDir, originalPath),
        display: path.relative(baseDir, webPath),
        thumbnail: path.relative(baseDir, thumbPath),
        captureDate,
    };
}

// Create media entry in database
export function createMediaEntry(
    originalPath: string,
    displayPath: string,
    thumbPath: string,
    mediaType: 'image' | 'video',
    title?: string,
    date?: string,
    rotation: number = 0
): number {
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO media (
            title, date, file_path_original, file_path_display,
            file_path_thumb, media_type, sort_order, rotation, uploaded_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const result = stmt.run(
        title || null,
        date || null,
        originalPath,
        displayPath,
        thumbPath,
        mediaType,
        rotation,
        now
    );

    return Number(result.lastInsertRowid);
}

// Extract capture date from an image buffer. Avoid filename heuristics; fall back to upload date.
export async function extractImageCaptureDate(buffer: Buffer, filename: string): Promise<string | null> {
    // Try exifr if available
    try {
        // Lazy-load to avoid hard dependency if not installed
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const exifr = require('exifr');
        const parsed = await exifr.parse(buffer, {
            pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTime'],
        });
        const val =
            parsed?.DateTimeOriginal ||
            parsed?.CreateDate ||
            parsed?.ModifyDate ||
            parsed?.DateTime;
        if (val instanceof Date && !Number.isNaN(val.getTime())) {
            return val.toISOString();
        }
        if (typeof val === 'string') {
            const parsedDate = new Date(val);
            if (!Number.isNaN(parsedDate.getTime())) {
                return parsedDate.toISOString();
            }
        }
    } catch (err) {
        // If exifr is missing or fails, fall through to filename-based heuristic
    }

    return null;
}

// Extract capture date from a video file on disk using ffprobe metadata
export async function extractVideoCaptureDate(fullPath: string, filename: string): Promise<string | null> {
    try {
        const metadata: any = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(fullPath, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        const tags =
            metadata?.format?.tags ||
            metadata?.streams?.find((s: any) => s.tags)?.tags ||
            {};

        const candidates: (string | undefined)[] = [
            tags.creation_time,
            tags['com.apple.quicktime.creationdate'],
            tags['date'],
        ];

        for (const value of candidates) {
            if (!value) continue;
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString();
            }
        }

        return null;
    } catch {
        return null;
    }
}

// Get media by ID
export function getMediaById(mediaId: number): MediaEntry | undefined {
    const stmt = db.prepare(`
        SELECT media_id, title, date, file_path_original, file_path_thumb,
               file_path_display, media_type, sort_order, rotation, uploaded_at, transcoding_status
        FROM media
        WHERE media_id = ?
    `);

    return stmt.get(mediaId) as MediaEntry | undefined;
}

// Get pending videos for transcoding
export function getPendingVideos(): MediaEntry[] {
    const stmt = db.prepare(`
        SELECT media_id, title, date, file_path_original, file_path_thumb,
               file_path_display, media_type, sort_order, rotation, uploaded_at, transcoding_status
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
