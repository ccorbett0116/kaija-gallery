// src/app/api/fields/[fieldId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { deleteField } from '@/lib/dates';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ fieldId: string }> }
) {
    const { fieldId: fieldIdStr } = await params;
    const fieldId = parseInt(fieldIdStr, 10);

    if (isNaN(fieldId)) {
        return NextResponse.json({ error: 'Invalid field ID' }, { status: 400 });
    }

    console.log('[API] DELETE /api/fields - field_id:', fieldId);

    const result = deleteField(fieldId);

    if (!result.success) {
        console.log('[API] DELETE /api/fields - ERROR:', result.error);
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    console.log('[API] DELETE /api/fields - success (removed from autocomplete, data preserved)');
    return NextResponse.json({ success: true });
}
