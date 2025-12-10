// src/app/api/media-virtual/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMediaByRange, getTotalMediaCount } from '@/lib/media';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');

    try {
        const total = getTotalMediaCount();
        const media = getMediaByRange(offset, limit);

        return NextResponse.json({
            media,
            total,
        });
    } catch (error) {
        console.error('Error fetching media:', error);
        return NextResponse.json(
            { error: 'Failed to fetch media' },
            { status: 500 }
        );
    }
}
