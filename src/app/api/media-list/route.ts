// src/app/api/media-list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { listMediaBidirectional } from '@/lib/media';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50');
    const olderThan = searchParams.get('olderThan') || undefined;
    const newerThan = searchParams.get('newerThan') || undefined;
    const jumpToDate = searchParams.get('jumpToDate') || undefined;
    const jumpToBottom = searchParams.get('jumpToBottom') === 'true';

    try {
        const result = listMediaBidirectional({
            limit,
            olderThan,
            newerThan,
            jumpToDate,
            jumpToBottom,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching media:', error);
        return NextResponse.json(
            { error: 'Failed to fetch media' },
            { status: 500 }
        );
    }
}
