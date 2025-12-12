// src/app/api/media/all/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import type { MediaEntry } from '@/lib/media';

export async function GET() {
    const stmt = db.prepare(`
        SELECT media_id, title, date, file_path_original, file_path_thumb,
               file_path_display, media_type, sort_order, rotation, uploaded_at, transcoding_status
        FROM media
        WHERE transcoding_status = 'completed'
        ORDER BY uploaded_at DESC
    `);

    const media = stmt.all() as MediaEntry[];

    return NextResponse.json(media);
}
