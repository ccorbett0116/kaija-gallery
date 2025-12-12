// src/app/api/upload-chunk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, readFile, unlink, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import db from '@/lib/db';
import { initializeCleanupScheduler } from '@/lib/cleanup-scheduler';

const getChunkDir = () => {
    // If MEDIA_PATH is set, put chunks alongside media
    // Otherwise use default location
    const mediaPath = process.env.MEDIA_PATH || path.join(process.cwd(), 'data', 'media');
    const dataDir = path.dirname(mediaPath); // Get parent directory
    return path.join(dataDir, 'chunks');
};

const MEDIA_DIR = process.env.MEDIA_PATH || path.join(process.cwd(), 'data', 'media');

// Initialize cleanup scheduler when this module loads
initializeCleanupScheduler();

// GET: Check which chunks have been uploaded for a given uploadId
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const uploadId = searchParams.get('uploadId');

        if (!uploadId) {
            return NextResponse.json({ error: 'Missing uploadId' }, { status: 400 });
        }

        const CHUNK_DIR = getChunkDir();
        const uploadChunkDir = path.join(CHUNK_DIR, uploadId);

        if (!existsSync(uploadChunkDir)) {
            return NextResponse.json({ uploadedChunks: [] });
        }

        const files = await readdir(uploadChunkDir);
        const uploadedChunks = files
            .filter(f => f.startsWith('chunk-'))
            .map(f => parseInt(f.replace('chunk-', '')))
            .filter(n => !isNaN(n));

        return NextResponse.json({ uploadedChunks });
    } catch (error) {
        console.error('Chunk check error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Check failed' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const chunk = formData.get('chunk') as Blob;
        const chunkIndex = parseInt(formData.get('chunkIndex') as string);
        const totalChunks = parseInt(formData.get('totalChunks') as string);
        const filename = formData.get('filename') as string;
        const uploadId = formData.get('uploadId') as string; // Unique ID for this upload session
        const mediaType = formData.get('mediaType') as string; // 'image' or 'video'
        const lastModified = formData.get('lastModified') as string | null; // optional client lastModified

        if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !filename || !uploadId || !mediaType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (mediaType !== 'image' && mediaType !== 'video') {
            return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 });
        }

        // Ensure chunk directory exists
        const CHUNK_DIR = getChunkDir();
        const uploadChunkDir = path.join(CHUNK_DIR, uploadId);
        await mkdir(uploadChunkDir, { recursive: true });

        // Save chunk
        const chunkPath = path.join(uploadChunkDir, `chunk-${chunkIndex}`);
        const buffer = Buffer.from(await chunk.arrayBuffer());
        await writeFile(chunkPath, buffer);

        // Check if all chunks received
        const files = await readdir(uploadChunkDir);
        const receivedChunks = files.filter(f => f.startsWith('chunk-')).length;

        if (receivedChunks === totalChunks) {
            // All chunks received, assemble the file
            await assembleFile(uploadId, filename, totalChunks, mediaType as 'image' | 'video', lastModified);

            return NextResponse.json({
                success: true,
                complete: true,
                message: 'Upload complete'
            });
        }

        return NextResponse.json({
            success: true,
            complete: false,
            chunksReceived: receivedChunks,
            totalChunks
        });

    } catch (error) {
        console.error('Chunk upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Upload failed' },
            { status: 500 }
        );
    }
}

async function assembleFile(
    uploadId: string,
    filename: string,
    totalChunks: number,
    mediaType: 'image' | 'video',
    lastModified: string | null
) {
    const CHUNK_DIR = getChunkDir();
    const uploadChunkDir = path.join(CHUNK_DIR, uploadId);

    // Create unique filename with timestamp
    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${path.parse(sanitized).name}-${timestamp}${path.extname(sanitized)}`;

    // Ensure media directory exists
    await mkdir(path.join(MEDIA_DIR, 'originals'), { recursive: true });

    const finalPath = path.join(MEDIA_DIR, 'originals', uniqueFilename);
    const relativePath = path.relative(MEDIA_DIR, finalPath);

    // Assemble chunks in order
    const chunks: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(uploadChunkDir, `chunk-${i}`);
        const chunkData = await readFile(chunkPath);
        chunks.push(chunkData);
    }

    // Write assembled file
    const finalBuffer = Buffer.concat(chunks);
    await writeFile(finalPath, finalBuffer);

    // Clean up chunks
    for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(uploadChunkDir, `chunk-${i}`);
        await unlink(chunkPath);
    }
    await rmdir(uploadChunkDir).catch(() => {}); // Remove directory

    const clientLastModified =
        lastModified && !Number.isNaN(Number(lastModified))
            ? new Date(Number(lastModified)).toISOString()
            : null;

    if (mediaType === 'image') {
        // Process image: generate thumbnail and display version
        const { processImageFromPath, extractImageCaptureDate } = await import('@/lib/media');
        const captureDate = (await extractImageCaptureDate(finalBuffer, filename)) || clientLastModified;

        const processed = await processImageFromPath(finalPath, uniqueFilename);

        // Insert into database with completed status
        const stmt = db.prepare(`
            INSERT INTO media (
                title, date, file_path_original, file_path_thumb, file_path_display,
                media_type, sort_order, uploaded_at, transcoding_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            null, // title
            captureDate || null, // date (capture date if available)
            processed.originalPath,
            processed.thumbPath,
            processed.displayPath,
            'image',
            0,
            new Date().toISOString(),
            'completed'
        );

    } else {
        // Video: Insert into database with pending transcoding status
        const { extractVideoCaptureDate } = await import('@/lib/media');
        const captureDate = (await extractVideoCaptureDate(finalPath, filename)) || clientLastModified;

        const stmt = db.prepare(`
            INSERT INTO media (
                title, date, file_path_original, file_path_thumb, file_path_display,
                media_type, sort_order, uploaded_at, transcoding_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            null, // title
            captureDate || null, // date (capture date if available)
            relativePath,
            null, // thumb - will be generated during transcoding
            null, // display - will be generated during transcoding
            'video',
            0,
            new Date().toISOString(),
            'pending'
        );

        const mediaId = Number(result.lastInsertRowid);


        // Trigger transcoding in background (don't await)
        console.log('Triggering background transcoding...');
        (async () => {
            try {
                const { processNextPendingVideo } = await import('@/lib/transcode');
                console.log('Calling processNextPendingVideo()...');
                const result = await processNextPendingVideo();
                console.log('Transcoding result:', result);
            } catch (err) {
                console.error('Transcoding trigger error:', err);
            }
        })();
    }
}
