// src/app/api/media/count/route.ts
import { NextResponse } from 'next/server';
import { getTotalMediaCount } from '@/lib/media';

export async function GET() {
    const count = getTotalMediaCount();
    return NextResponse.json({ count });
}
