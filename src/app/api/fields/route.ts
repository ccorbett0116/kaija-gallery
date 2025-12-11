// src/app/api/fields/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllFields } from '@/lib/dates';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || undefined;

    console.log('[API] /api/fields - query:', query || '(all fields)');

    const fields = getAllFields(query);
    console.log('[API] /api/fields - found', fields.length, 'fields');
    return NextResponse.json(fields);
}
