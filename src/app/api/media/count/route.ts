// src/app/api/media/count/route.ts
import { NextResponse } from 'next/server';
import { getTotalMediaCount } from '@/lib/media';

export async function GET() {
    try {
        const count = getTotalMediaCount();
        return NextResponse.json({ count });
    } catch (error) {
        console.error('Failed to get media count:', error);
        // Gracefully degrade instead of failing the build/runtime if the DB is temporarily locked
        return NextResponse.json({ count: 0 }, { status: 200 });
    }
}
