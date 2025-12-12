import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { mediaId, delta } = await request.json();
        if (!mediaId || typeof delta !== 'number') {
            return NextResponse.json({ error: 'mediaId and delta are required' }, { status: 400 });
        }

        const stmt = db.prepare(`
            UPDATE media
            SET rotation = ((rotation + @delta) % 360 + 360) % 360
            WHERE media_id = @mediaId
        `);
        stmt.run({ mediaId, delta });

        const row = db.prepare(`SELECT rotation FROM media WHERE media_id = ?`).get(mediaId) as { rotation: number } | undefined;
        if (!row) {
            return NextResponse.json({ error: 'Media not found' }, { status: 404 });
        }

        return NextResponse.json({ rotation: row.rotation });
    } catch (error) {
        console.error('Rotate media error:', error);
        return NextResponse.json({ error: 'Failed to rotate media' }, { status: 500 });
    }
}
