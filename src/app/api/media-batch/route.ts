// src/app/api/media-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import type { MediaEntry } from '@/lib/media';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const stmt = db.prepare(`
        SELECT media_id, title, date, file_path_original, file_path_thumb,
               file_path_display, media_type, sort_order, uploaded_at, transcoding_status
        FROM media
        WHERE transcoding_status = 'completed'
        ORDER BY uploaded_at DESC
        LIMIT ? OFFSET ?
    `);

    const media = stmt.all(limit, offset) as MediaEntry[];

    return NextResponse.json({ media });
}
