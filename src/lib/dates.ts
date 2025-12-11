// src/lib/dates.ts
import db from './db';
import type { MediaEntry } from './media';

export type DateEntry = {
    title: string;
    date: string; // ISO
    created_at: string;
    updated_at: string;
    first_media_thumb?: string | null;
    first_media_type?: 'image' | 'video' | null;
};

export type FieldType = 'text' | 'time' | 'date' | 'datetime-local' | 'number' | 'address';

export type FieldDefinition = {
    field_id: number;
    field_name: string;
    field_type: FieldType;
};

export type DateFieldValue = {
    field_id: number;
    field_name: string;
    field_type: FieldType;
    value: string;
};

// Fetch recent dates for index page
export function listDates(limit = 50): DateEntry[] {
    const stmt = db.prepare(`
    SELECT
      de.title,
      de.date,
      de.created_at,
      de.updated_at,
      m.file_path_thumb as first_media_thumb,
      m.media_type as first_media_type
    FROM date_entries de
    LEFT JOIN (
      SELECT dm.title, dm.date, dm.media_id
      FROM date_media dm
      WHERE dm.display_order = 0
    ) first_media ON de.title = first_media.title AND de.date = first_media.date
    LEFT JOIN media m ON first_media.media_id = m.media_id
    ORDER BY de.date DESC, de.title ASC
    LIMIT ?
  `);
    return stmt.all(limit) as DateEntry[];
}

// Fetch a single date entry with all its custom fields and media
export type DateEntryWithFields = DateEntry & {
    fields: DateFieldValue[];
    media: MediaEntry[];
};

export function getDateEntry(title: string, date: string): DateEntryWithFields | null {
    const dateStmt = db.prepare(`
    SELECT title, date, created_at, updated_at
    FROM date_entries
    WHERE title = ? AND date = ?
  `);

    const dateEntry = dateStmt.get(title, date) as DateEntry | undefined;

    if (!dateEntry) return null;

    const fieldsStmt = db.prepare(`
    SELECT
      dfv.field_id,
      dfv.field_name,
      dfv.field_type,
      dfv.value
    FROM date_field_values dfv
    WHERE dfv.title = ? AND dfv.date = ?
    ORDER BY dfv.field_name ASC
  `);

    const fields = fieldsStmt.all(title, date) as DateFieldValue[];

    const mediaStmt = db.prepare(`
    SELECT
      m.media_id,
      m.title,
      m.date,
      m.file_path_original,
      m.file_path_thumb,
      m.file_path_display,
      m.media_type,
      m.sort_order,
      m.uploaded_at,
      m.transcoding_status
    FROM date_media dm
    JOIN media m ON m.media_id = dm.media_id
    WHERE dm.title = ? AND dm.date = ?
    ORDER BY dm.display_order ASC, m.uploaded_at DESC
  `);

    const media = mediaStmt.all(title, date) as MediaEntry[];

    return {
        ...dateEntry,
        fields,
        media
    };
}

// Search field names for the "Add Field" UI (simple LIKE for now)
export function searchFields(query: string): FieldDefinition[] {
    const stmt = db.prepare(`
    SELECT field_id, field_name, field_type
    FROM fields
    WHERE field_name LIKE ?
    ORDER BY field_name ASC
    LIMIT 20
  `);
    return stmt.all(`%${query}%`) as FieldDefinition[];
}

// Get all fields with usage count
export type FieldWithUsage = FieldDefinition & {
    usage_count: number;
};

export function getAllFields(query?: string): FieldWithUsage[] {
    const sql = query
        ? `
        SELECT
            f.field_id,
            f.field_name,
            f.field_type,
            COUNT(DISTINCT dfv.title || ':' || dfv.date) as usage_count
        FROM fields f
        LEFT JOIN date_field_values dfv ON f.field_id = dfv.field_id
        WHERE f.field_name LIKE ?
        GROUP BY f.field_id
        ORDER BY f.field_name ASC
        `
        : `
        SELECT
            f.field_id,
            f.field_name,
            f.field_type,
            COUNT(DISTINCT dfv.title || ':' || dfv.date) as usage_count
        FROM fields f
        LEFT JOIN date_field_values dfv ON f.field_id = dfv.field_id
        GROUP BY f.field_id
        ORDER BY f.field_name ASC
        `;

    const stmt = db.prepare(sql);
    const result = query ? stmt.all(`%${query}%`) : stmt.all();
    return result as FieldWithUsage[];
}

// Delete a field definition (removes from autocomplete but keeps date data)
export function deleteField(fieldId: number): { success: boolean; error?: string } {
    // Delete the field definition - date_field_values will retain field_name and field_type
    const deleteStmt = db.prepare(`
        DELETE FROM fields WHERE field_id = ?
    `);
    deleteStmt.run(fieldId);

    return { success: true };
}

// Insert a date + custom fields, creating missing field names in registry
export type NewFieldInput = { name: string; value: string; type: FieldType };

export function createDateEntry(
    title: string,
    date: string,
    fields: NewFieldInput[],
    mediaIds: number[] = []
) {
    const now = new Date().toISOString();

    const insertDate = db.prepare(`
    INSERT INTO date_entries (title, date, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

    const selectField = db.prepare(`
    SELECT field_id, field_type FROM fields WHERE field_name = ?
  `);

    const insertField = db.prepare(`
    INSERT INTO fields (field_name, field_type) VALUES (?, ?)
  `);

    const updateFieldType = db.prepare(`
    UPDATE fields SET field_type = ? WHERE field_id = ?
  `);

    const insertValue = db.prepare(`
    INSERT INTO date_field_values (title, date, field_id, field_name, field_type, value)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    const insertDateMedia = db.prepare(`
    INSERT INTO date_media (title, date, media_id, added_at, display_order)
    VALUES (?, ?, ?, ?, ?)
  `);

    const tx = db.transaction(() => {
        insertDate.run(title, date, now, now);

        for (const f of fields) {
            const name = f.name.trim();
            const value = f.value.trim();
            const type = f.type || 'text';
            if (!name || !value) continue;

            let row = selectField.get(name) as { field_id: number; field_type: string } | undefined;
            let fieldId: number;

            if (!row) {
                // Create new field with type
                const info = insertField.run(name, type);
                fieldId = Number(info.lastInsertRowid);
            } else {
                fieldId = row.field_id;
                // Update field type if it changed (user may have changed the type)
                if (row.field_type !== type) {
                    updateFieldType.run(type, fieldId);
                }
            }

            insertValue.run(title, date, fieldId, name, type, value);
        }

        // Associate media with this date (preserving order)
        for (let i = 0; i < mediaIds.length; i++) {
            insertDateMedia.run(title, date, mediaIds[i], now, i);
        }
    });

    tx();
}

// Delete a date entry (cascades to fields and media via foreign keys)
export function deleteDate(title: string, date: string) {
    const deleteStmt = db.prepare(`
    DELETE FROM date_entries
    WHERE title = ? AND date = ?
  `);
    deleteStmt.run(title, date);
}

// Update a date entry (deletes and recreates field values and media associations)
export function updateDateEntry(
    originalTitle: string,
    originalDate: string,
    newTitle: string,
    newDate: string,
    fields: NewFieldInput[],
    mediaIds: number[] = []
) {
    const now = new Date().toISOString();

    const updateDate = db.prepare(`
    UPDATE date_entries
    SET title = ?, date = ?, updated_at = ?
    WHERE title = ? AND date = ?
  `);

    const deleteFieldValues = db.prepare(`
    DELETE FROM date_field_values
    WHERE title = ? AND date = ?
  `);

    const deleteMediaAssociations = db.prepare(`
    DELETE FROM date_media
    WHERE title = ? AND date = ?
  `);

    const selectField = db.prepare(`
    SELECT field_id, field_type FROM fields WHERE field_name = ?
  `);

    const insertField = db.prepare(`
    INSERT INTO fields (field_name, field_type) VALUES (?, ?)
  `);

    const updateFieldType = db.prepare(`
    UPDATE fields SET field_type = ? WHERE field_id = ?
  `);

    const insertValue = db.prepare(`
    INSERT INTO date_field_values (title, date, field_id, field_name, field_type, value)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    const insertDateMedia = db.prepare(`
    INSERT INTO date_media (title, date, media_id, added_at, display_order)
    VALUES (?, ?, ?, ?, ?)
  `);

    const tx = db.transaction(() => {
        // Delete existing field values and media associations
        deleteFieldValues.run(originalTitle, originalDate);
        deleteMediaAssociations.run(originalTitle, originalDate);

        // Update the date entry
        updateDate.run(newTitle, newDate, now, originalTitle, originalDate);

        // Re-insert field values
        for (const f of fields) {
            const name = f.name.trim();
            const value = f.value.trim();
            const type = f.type || 'text';
            if (!name || !value) continue;

            let row = selectField.get(name) as { field_id: number; field_type: string } | undefined;
            let fieldId: number;

            if (!row) {
                const info = insertField.run(name, type);
                fieldId = Number(info.lastInsertRowid);
            } else {
                fieldId = row.field_id;
                if (row.field_type !== type) {
                    updateFieldType.run(type, fieldId);
                }
            }

            insertValue.run(newTitle, newDate, fieldId, name, type, value);
        }

        // Re-insert media associations
        for (let i = 0; i < mediaIds.length; i++) {
            insertDateMedia.run(newTitle, newDate, mediaIds[i], now, i);
        }
    });

    tx();
}
