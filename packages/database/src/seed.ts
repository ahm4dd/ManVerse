import { getDatabase, initDatabase } from './db.js';

// Initialize DB
initDatabase();
const db = getDatabase();

console.log('🌱 Seeding database...');

// Insert Provider Manga (Solo Leveling)
try {
  db.run(`
    INSERT INTO provider_manga (
      id, provider, provider_id, provider_url, title, cover_url, status, total_chapters, description, genres, last_scraped
    ) VALUES (
      1,
      'asura', 
      'solo-leveling', 
      'https://asuratoon.com/manga/solo-leveling', 
      'Solo Leveling', 
      'https://up.mangadoge.com/m/s/solo-leveling/custom-cover.jpg', 
      'Completed', 
      179, 
      'Ten years ago, after the Gate that connected the real world with the monster world opened, some of the ordinary, everyday people received the power to hunt monsters within the Gate.',
      '["Action", "Adventure", "Fantasy", "Shounen"]',
      1704153600000
    )
    ON CONFLICT(id) DO NOTHING;
  `);
  console.log('✅ Inserted Solo Leveling into provider_manga');
} catch (e) {
  console.error('Error seeding provider_manga:', e);
}

// Insert User Library Entry
try {
  db.run(`
    INSERT INTO user_library (
      provider, provider_manga_id, status, progress, added_at, last_read, is_favorite
    ) VALUES (
      'asura', 1, 'reading', 15, 1704153600000, 1704153600000, 1
    )
    ON CONFLICT(provider, provider_manga_id) DO NOTHING;
  `);
  console.log('✅ Inserted Solo Leveling into user_library');
} catch (e) {
  console.error('Error seeding user_library:', e);
}

console.log('✨ Seeding complete!');
