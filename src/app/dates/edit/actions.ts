// src/app/dates/edit/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { updateDateEntry } from '@/lib/dates';
import type { FieldType } from '@/lib/dates';

const MIN_YEAR = 2025;
const MAX_YEAR = 2125;

function normalizeDate(dateStr: string) {
    const trimmed = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD.');
    }

    const [yearStr, monthStr, dayStr] = trimmed.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (
        Number.isNaN(utcDate.getTime()) ||
        utcDate.getUTCFullYear() !== year ||
        utcDate.getUTCMonth() !== month - 1 ||
        utcDate.getUTCDate() !== day
    ) {
        throw new Error('Invalid date.');
    }

    if (year < MIN_YEAR || year > MAX_YEAR) {
        throw new Error(`Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`);
    }

    return utcDate.toISOString().slice(0, 10);
}

export async function updateDateAction(formData: FormData) {
    const originalTitle = formData.get('originalTitle') as string;
    const originalDate = formData.get('originalDate') as string;
    const title = formData.get('title') as string;
    const date = formData.get('date') as string;

    if (!originalTitle || !originalDate || !title || !date) {
        throw new Error('Missing required fields');
    }

    const normalizedDate = normalizeDate(date);

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

    updateDateEntry(originalTitle, originalDate, title, normalizedDate, fields, mediaIds);

    redirect('/');
}
