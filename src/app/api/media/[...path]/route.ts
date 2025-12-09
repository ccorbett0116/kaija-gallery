// src/app/api/media/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const getMediaDir = () => {
    return process.env.MEDIA_PATH || path.join(process.cwd(), 'data', 'media');
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params;
        const filePath = path.join(getMediaDir(), ...pathSegments);

        // Security: ensure the path is within media directory
        const mediaDir = getMediaDir();
        const resolvedPath = path.resolve(filePath);
        const resolvedMediaDir = path.resolve(mediaDir);

        if (!resolvedPath.startsWith(resolvedMediaDir)) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return new NextResponse('Not Found', { status: 404 });
        }

        // Get file stats
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;

        // Determine content type
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mov': 'video/quicktime',
        };

        const contentType = contentTypes[ext] || 'application/octet-stream';

        // Check if this is a video and if range is requested
        const isVideo = contentType.startsWith('video/');
        const range = request.headers.get('range');

        if (isVideo && range) {
            // Handle range request for video streaming
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            const fileStream = fs.createReadStream(filePath, { start, end });
            const buffer = await streamToBuffer(fileStream);

            return new NextResponse(new Uint8Array(buffer), {
                status: 206, // Partial Content
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize.toString(),
                    'Content-Type': contentType,
                },
            });
        } else {
            // Serve full file (images or non-range video requests)
            const fileBuffer = fs.readFileSync(filePath);

            return new NextResponse(new Uint8Array(fileBuffer), {
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': fileSize.toString(),
                    'Accept-Ranges': isVideo ? 'bytes' : 'none',
                    'Cache-Control': 'public, max-age=31536000, immutable',
                },
            });
        }
    } catch (error) {
        console.error('Error serving media:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// Helper to convert stream to buffer
async function streamToBuffer(stream: fs.ReadStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: string | Buffer) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}
