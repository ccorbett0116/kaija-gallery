// src/app/api/cleanup-chunks/route.ts
import { NextResponse } from 'next/server';
import { cleanupAbandonedChunks } from '@/lib/cleanup';

export async function POST() {
    try {
        const result = await cleanupAbandonedChunks();

        return NextResponse.json({
            success: true,
            deleted: result.deleted,
            errors: result.errors,
            message: result.deleted > 0
                ? `Cleaned up ${result.deleted} abandoned chunk folder(s)`
                : 'No abandoned chunks found'
        });
    } catch (error) {
        console.error('Manual cleanup failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Cleanup failed'
            },
            { status: 500 }
        );
    }
}
