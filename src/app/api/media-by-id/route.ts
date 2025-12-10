// src/app/api/media-by-id/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMediaById } from '@/lib/media';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mediaId = parseInt(searchParams.get('id') || '0');

    if (!mediaId) {
        return NextResponse.json(
            { error: 'Missing media ID' },
            { status: 400 }
        );
    }

    try {
        const media = getMediaById(mediaId);

        if (!media) {
            return NextResponse.json(
                { error: 'Media not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ media });
    } catch (error) {
        console.error('Error fetching media by ID:', error);
        return NextResponse.json(
            { error: 'Failed to fetch media' },
            { status: 500 }
        );
    }
}
