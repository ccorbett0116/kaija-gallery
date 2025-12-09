// src/app/api/transcode/route.ts
import { NextResponse } from 'next/server';
import { processNextPendingVideo } from '@/lib/transcode';

// This endpoint processes one pending video
// Can be called by a cron job, polling, or manually
export async function POST() {
    try {
        const result = await processNextPendingVideo();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Transcode API error:', error);
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to transcode',
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Allow GET for easy testing
    return POST();
}
