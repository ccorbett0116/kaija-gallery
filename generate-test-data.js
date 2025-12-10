// generate-test-data.js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'gallery.sqlite'));

console.log('Generating 200 test media entries...');

// Start from 365 days ago, create one entry every ~1.8 days to spread across a year
const startDate = new Date();
startDate.setDate(startDate.getDate() - 365);

const mediaTypes = ['image', 'video'];
const titles = [
    'Sunset at the beach',
    'Mountain hike',
    'City lights',
    'Coffee morning',
    'Weekend adventures',
    'Garden flowers',
    'Rainy day',
    'Birthday celebration',
    'Road trip',
    'Cooking session',
];

const stmt = db.prepare(`
    INSERT INTO media (
        title, date, file_path_original, file_path_display,
        file_path_thumb, media_type, sort_order, uploaded_at, transcoding_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 0; i < 200; i++) {
    // Increment timestamp by ~1.8 days per entry
    const uploadDate = new Date(startDate.getTime() + (i * 1.8 * 24 * 60 * 60 * 1000));
    const mediaType = mediaTypes[i % 2]; // Alternate between image and video

    // Create fake file paths
    const timestamp = uploadDate.getTime();
    const fileId = `test-${i}-${timestamp}`;

    const original = mediaType === 'image'
        ? `originals/${fileId}.jpg`
        : `originals/${fileId}.mp4`;

    const display = mediaType === 'image'
        ? `originals/${fileId}.jpg` // Reuse original for display
        : `web-videos/${fileId}.mp4`;

    const thumb = mediaType === 'image'
        ? `thumbnails/${fileId}-thumb.webp`
        : `thumbnails/${fileId}-thumb.jpg`;

    // Set title and date to NULL to avoid foreign key constraint
    stmt.run(
        null, // title
        null, // date
        original,
        display,
        thumb,
        mediaType,
        0,
        uploadDate.toISOString(),
        'completed'
    );
}

console.log('✓ Successfully inserted 200 test media entries');
console.log('  - Spread across the last 365 days');
console.log('  - Mix of images and videos');
console.log('  - Ready to test infinite scroll!');

// Show some sample dates
const samples = db.prepare('SELECT uploaded_at FROM media ORDER BY uploaded_at DESC LIMIT 5').all();
console.log('\nNewest 5 entries:');
samples.forEach(s => console.log('  -', new Date(s.uploaded_at).toLocaleDateString()));

const oldest = db.prepare('SELECT uploaded_at FROM media ORDER BY uploaded_at ASC LIMIT 1').get();
console.log('\nOldest entry:', new Date(oldest.uploaded_at).toLocaleDateString());

db.close();
