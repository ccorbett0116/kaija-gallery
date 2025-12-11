// src/app/api/search-fields/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchFields } from '@/lib/dates';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
        return NextResponse.json([]);
    }

    const results = searchFields(query);
    return NextResponse.json(results);
}
