// src/app/api/search-fields/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchFields } from '@/lib/dates';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    console.log('[API] /api/search-fields - query:', query);

    if (!query.trim()) {
        console.log('[API] /api/search-fields - empty query, returning []');
        return NextResponse.json([]);
    }

    const results = searchFields(query);
    console.log('[API] /api/search-fields - found', results.length, 'results');
    return NextResponse.json(results);
}
