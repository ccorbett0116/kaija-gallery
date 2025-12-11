// src/app/api/dates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDateEntry } from '@/lib/dates';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const date = searchParams.get('date');

    if (!title || !date) {
        return NextResponse.json({ error: 'Missing title or date' }, { status: 400 });
    }

    const dateEntry = getDateEntry(decodeURIComponent(title), decodeURIComponent(date));

    if (!dateEntry) {
        return NextResponse.json({ error: 'Date not found' }, { status: 404 });
    }

    return NextResponse.json(dateEntry);
}
