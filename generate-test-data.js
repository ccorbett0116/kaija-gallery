// generate-test-data.js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'gallery.sqlite'));

console.log('Purging tables and generating schema-aligned test data...');

// Purge everything in a safe order with FKs off to avoid constraint issues
db.exec(`PRAGMA foreign_keys = OFF;`);
db.exec(`
    DELETE FROM date_media;
    DELETE FROM date_field_values;
    DELETE FROM media;
    DELETE FROM date_entries;
    DELETE FROM fields;
    DELETE FROM sqlite_sequence WHERE name IN ('fields','date_entries','date_field_values','media','date_media');
`);
db.exec(`PRAGMA foreign_keys = ON;`);

const nowIso = new Date().toISOString();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 180); // roughly 6 months back

const fieldDefs = [
    { name: 'Location', type: 'text' },
    { name: 'Mood', type: 'text' },
    { name: 'Weather', type: 'text' },
    { name: 'Camera', type: 'text' },
    { name: 'People Count', type: 'number' },
    { name: 'Start Time', type: 'time' },
];

const eventNames = [
    'Beach Day',
    'Mountain Hike',
    'City Lights',
    'Coffee Morning',
    'Weekend Market',
    'Garden Walk',
    'Rainy Afternoon',
    'Birthday Bash',
    'Road Trip',
    'Cooking Night',
    'Studio Session',
    'Family Picnic',
    'Sunset Stroll',
    'Game Night',
    'Music Fest',
];

const insertField = db.prepare(`
    INSERT INTO fields (field_name, field_type)
    VALUES (?, ?)
`);
const insertDateEntry = db.prepare(`
    INSERT INTO date_entries (title, date, created_at, updated_at)
    VALUES (?, ?, ?, ?)
`);
const insertFieldValue = db.prepare(`
    INSERT INTO date_field_values (title, date, field_id, field_name, field_type, value)
    VALUES (?, ?, ?, ?, ?, ?)
`);
const insertMedia = db.prepare(`
    INSERT INTO media (
        title, date, file_path_original, file_path_display,
        file_path_thumb, media_type, sort_order, rotation, uploaded_at, transcoding_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
`);
const insertDateMedia = db.prepare(`
    INSERT INTO date_media (title, date, media_id, added_at, display_order)
    VALUES (?, ?, ?, ?, ?)
`);

const seed = db.transaction(() => {
    // Fields
    fieldDefs.forEach((f) => insertField.run(f.name, f.type));
    const fields = db.prepare('SELECT field_id, field_name, field_type FROM fields ORDER BY field_id').all();

    // Date entries + field values
    const dateEntries = [];
    for (let i = 0; i < eventNames.length; i++) {
        const d = new Date(startDate.getTime() + i * 4 * 24 * 60 * 60 * 1000);
        const dateOnly = d.toISOString().slice(0, 10);
        const title = eventNames[i];
        insertDateEntry.run(title, dateOnly, nowIso, nowIso);
        dateEntries.push({ title, date: dateOnly });

        const fieldA = fields[i % fields.length];
        const fieldB = fields[(i + 2) % fields.length];
        insertFieldValue.run(title, dateOnly, fieldA.field_id, fieldA.field_name, fieldA.field_type, `Sample ${fieldA.field_name}`);
        insertFieldValue.run(title, dateOnly, fieldB.field_id, fieldB.field_name, fieldB.field_type, `Sample ${fieldB.field_name}`);
    }

    // Media + associations (titles intentionally null)
    const mediaTypes = ['image', 'video'];
    const totalMedia = 200;

    for (let i = 0; i < totalMedia; i++) {
        const uploadDate = new Date(startDate.getTime() + i * 0.9 * 24 * 60 * 60 * 1000);
        const mediaType = mediaTypes[i % mediaTypes.length];
        const timestamp = uploadDate.getTime();
        const fileId = `test-${i}-${timestamp}`;

        const original = mediaType === 'image'
            ? `originals/${fileId}.jpg`
            : `originals/${fileId}.mp4`;

        const display = mediaType === 'image'
            ? `originals/${fileId}.jpg`
            : `web-videos/${fileId}.mp4`;

        const thumb = mediaType === 'image'
            ? `thumbnails/${fileId}-thumb.webp`
            : `thumbnails/${fileId}-thumb.jpg`;

        const dateEntry = dateEntries[i % dateEntries.length];

        const result = insertMedia.run(
            null,                 // title should be null for media
            dateEntry.date,       // date FK
            original,
            display,
            thumb,
            mediaType,
            0,
            uploadDate.toISOString(),
            'completed'
        );

        insertDateMedia.run(
            dateEntry.title,
            dateEntry.date,
            result.lastInsertRowid,
            nowIso,
            i % 6
        );
    }
});

seed();

console.log(`✅ Seed complete: ${fieldDefs.length} fields, ${eventNames.length} date entries, 200 media rows (titles null)`);

const samples = db.prepare('SELECT uploaded_at FROM media ORDER BY uploaded_at DESC LIMIT 5').all();
console.log('\nNewest 5 uploads:');
samples.forEach((s) => console.log('  -', new Date(s.uploaded_at).toLocaleString()));

const oldest = db.prepare('SELECT uploaded_at FROM media ORDER BY uploaded_at ASC LIMIT 1').get();
console.log('Oldest upload:', new Date(oldest.uploaded_at).toLocaleString());

db.close();
