import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { mediaId, date } = await request.json();

        if (!mediaId || !date) {
            return NextResponse.json({ error: 'mediaId and date are required' }, { status: 400 });
        }

        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) {
            return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
        }

        const isoDate = parsed.toISOString();

        const stmt = db.prepare(`
            UPDATE media
            SET date = ?
            WHERE media_id = ?
        `);
        const result = stmt.run(isoDate, mediaId);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Media not found' }, { status: 404 });
        }

        return NextResponse.json({ date: isoDate });
    } catch (error) {
        console.error('Update media date error:', error);
        return NextResponse.json({ error: 'Failed to update media date' }, { status: 500 });
    }
}
