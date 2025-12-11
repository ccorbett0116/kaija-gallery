// src/app/dates/new/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createDateEntry, type NewFieldInput, type FieldType } from '@/lib/dates';

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

    return utcDate.toISOString().slice(0, 10); // normalized YYYY-MM-DD
}

export async function createDateAction(formData: FormData) {
    const title = formData.get('title') as string;
    const rawDate = formData.get('date') as string;

    if (!title?.trim() || !rawDate?.trim()) {
        throw new Error('Title and date are required');
    }

    const normalizedDate = normalizeDate(rawDate);

    // Collect custom fields from the form
    const fieldNames = formData.getAll('fieldName') as string[];
    const fieldTypes = formData.getAll('fieldType') as string[];
    const fieldValues = formData.getAll('fieldValue') as string[];

    const fields: NewFieldInput[] = [];
    for (let i = 0; i < fieldNames.length; i++) {
        const name = fieldNames[i]?.trim();
        const value = fieldValues[i]?.trim();
        const type = (fieldTypes[i] as FieldType) || 'text';
        if (name && value) {
            fields.push({ name, value, type });
        }
    }

    // Collect selected media IDs
    const mediaIds = formData.getAll('mediaIds').map((id) => Number(id));

    // Create the date entry in the database
    createDateEntry(title.trim(), normalizedDate, fields, mediaIds);

    // Redirect to the home page after successful creation
    redirect('/');
}
