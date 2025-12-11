// src/app/dates/edit/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { updateDateEntry } from '@/lib/dates';
import type { FieldType } from '@/lib/dates';

export async function updateDateAction(formData: FormData) {
    const originalTitle = formData.get('originalTitle') as string;
    const originalDate = formData.get('originalDate') as string;
    const title = formData.get('title') as string;
    const date = formData.get('date') as string;

    if (!originalTitle || !originalDate || !title || !date) {
        throw new Error('Missing required fields');
    }

    // Collect fields
    const fieldNames = formData.getAll('fieldName');
    const fieldTypes = formData.getAll('fieldType');
    const fieldValues = formData.getAll('fieldValue');

    const fields = fieldNames.map((name, i) => ({
        name: String(name),
        value: String(fieldValues[i]),
        type: String(fieldTypes[i]) as FieldType,
    }));

    // Collect media IDs
    const mediaIds = formData.getAll('mediaIds').map((id) => Number(id));

    updateDateEntry(originalTitle, originalDate, title, date, fields, mediaIds);

    redirect('/');
}
