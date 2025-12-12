// src/app/api/media/by-ids/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import type { MediaEntry } from '@/lib/media';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ media: [] });
        }

        // Create placeholders for SQL IN clause
        const placeholders = ids.map(() => '?').join(',');

        const stmt = db.prepare(`
            SELECT media_id, title, date, file_path_original, file_path_thumb,
                   file_path_display, media_type, sort_order, rotation, uploaded_at, transcoding_status
            FROM media
            WHERE media_id IN (${placeholders})
        `);

        const media = stmt.all(...ids) as MediaEntry[];

        // Sort the media to match the order in the ids array
        const mediaMap = new Map(media.map(m => [m.media_id, m]));
        const orderedMedia = ids
            .map(id => mediaMap.get(id))
            .filter((m): m is MediaEntry => m !== undefined);

        return NextResponse.json({ media: orderedMedia });
    } catch (error) {
        console.error('Error fetching media by IDs:', error);
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }
}
