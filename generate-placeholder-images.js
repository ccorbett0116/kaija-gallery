// generate-placeholder-images.js
const Database = require('better-sqlite3');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, 'data', 'gallery.sqlite'));
const mediaDir = path.join(__dirname, 'data', 'media');

console.log('Generating placeholder images for test data...');

// Ensure directories exist
const dirs = ['originals', 'display', 'thumbnails', 'web-videos'];
for (const dir of dirs) {
    const fullPath = path.join(mediaDir, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
}

// Get all test media entries
const testMedia = db.prepare(`
    SELECT * FROM media
    WHERE file_path_original LIKE 'originals/test-%'
`).all();

console.log(`Found ${testMedia.length} test media entries`);

// Color palette for variety
const colors = [
    { r: 99, g: 102, b: 241 },   // indigo
    { r: 139, g: 92, b: 246 },   // purple
    { r: 236, g: 72, b: 153 },   // pink
    { r: 251, g: 146, b: 60 },   // orange
    { r: 34, g: 197, b: 94 },    // green
    { r: 14, g: 165, b: 233 },   // sky
    { r: 248, g: 113, b: 113 },  // red
    { r: 253, g: 224, b: 71 },   // yellow
];

(async () => {
    let created = 0;

    for (let i = 0; i < testMedia.length; i++) {
        const media = testMedia[i];
        const color = colors[i % colors.length];

        try {
            if (media.media_type === 'image') {
                // Create original/display image (800x600)
                const originalPath = path.join(mediaDir, media.file_path_original);
                if (!fs.existsSync(originalPath)) {
                    await sharp({
                        create: {
                            width: 800,
                            height: 600,
                            channels: 3,
                            background: color
                        }
                    })
                    .jpeg({ quality: 90 })
                    .toFile(originalPath);
                }

                // Create thumbnail (400px wide)
                const thumbPath = path.join(mediaDir, media.file_path_thumb);
                if (!fs.existsSync(thumbPath)) {
                    await sharp({
                        create: {
                            width: 400,
                            height: 300,
                            channels: 3,
                            background: color
                        }
                    })
                    .webp({ quality: 80 })
                    .toFile(thumbPath);
                }

                created++;
            } else {
                // For videos, just create thumbnails (we won't create actual video files)
                const thumbPath = path.join(mediaDir, media.file_path_thumb);
                if (!fs.existsSync(thumbPath)) {
                    await sharp({
                        create: {
                            width: 400,
                            height: 300,
                            channels: 3,
                            background: color
                        }
                    })
                    .jpeg({ quality: 80 })
                    .toFile(thumbPath);
                }

                // Create a dummy video file (just a small placeholder)
                const videoPath = path.join(mediaDir, media.file_path_display);
                const videoOriginalPath = path.join(mediaDir, media.file_path_original);

                if (!fs.existsSync(videoPath)) {
                    // Create empty file as placeholder
                    fs.writeFileSync(videoPath, Buffer.from([0x00, 0x00, 0x00, 0x20]));
                }
                if (!fs.existsSync(videoOriginalPath)) {
                    fs.writeFileSync(videoOriginalPath, Buffer.from([0x00, 0x00, 0x00, 0x20]));
                }

                created++;
            }

            if ((i + 1) % 20 === 0) {
                console.log(`  Created ${i + 1}/${testMedia.length} placeholder images...`);
            }
        } catch (error) {
            console.error(`Failed to create placeholder for ${media.file_path_original}:`, error);
        }
    }

    console.log(`\n✓ Successfully created ${created} placeholder images`);
    console.log('  - Images: 800x600 JPEGs + 400x300 WebP thumbnails');
    console.log('  - Videos: Thumbnail JPEGs only (no actual video files)');
    console.log('  - Ready to test without 404 errors!');

    db.close();
})();
