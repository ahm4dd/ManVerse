/**
 * AniList Integration Test Script
 * Demonstrates OAuth authentication, search, and list management
 */

import { AniListClient } from '@manverse/anilist';

async function main() {
  console.log('🎯 AniList Integration Test\n');

  // Read credentials from environment
  const clientId = process.env.ANILIST_CLIENT_ID;
  const clientSecret = process.env.ANILIST_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Missing credentials!');
    console.error('Please set ANILIST_CLIENT_ID and ANILIST_CLIENT_SECRET environment variables.');
    console.error('\nTo get credentials:');
    console.error('1. Visit https://anilist.co/settings/developer');
    console.error('2. Create a new client');
    console.error('3. Set redirect URI to: http://localhost:8888/callback');
    console.error('4. Copy Client ID and Client Secret to .env file');
    process.exit(1);
  }

  // Test 1: Guest Mode Search
  console.log('📚 Test 1: Guest Mode Search (no authentication)\n');
  const guestClient = AniListClient.create();

  try {
    const searchResults = await guestClient.searchManga('Solo Leveling', 1);
    console.log(`✅ Found ${searchResults.media.length} results`);
    console.log(`   Total results: ${searchResults.pageInfo.total}`);
    console.log(`   Has next page: ${searchResults.pageInfo.hasNextPage}`);

    if (searchResults.media.length > 0) {
      const first = searchResults.media[0];
      console.log(`\n   First result:`);
      console.log(`   - Title: ${first.title.romaji}`);
      console.log(`   - Status: ${first.status}`);
      console.log(`   - Chapters: ${first.chapters || 'Unknown'}`);
      console.log(`   - Score: ${first.averageScore || 'N/A'}/100`);
      console.log(`   - URL: ${first.siteUrl}`);
    }
  } catch (error) {
    console.error('❌ Search failed:', error);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Authentication
  console.log('🔐 Test 2: OAuth Authentication\n');

  const authClient = AniListClient.create({
    clientId,
    clientSecret,
    enableRateLimit: true,
  });

  try {
    console.log('Starting OAuth flow...');
    const token = await authClient.authenticate();

    console.log('✅ Authentication successful!');
    console.log(`   Token: ${token.accessToken.substring(0, 20)}...`);
    console.log(`   Expires: ${new Date(token.expiresAt).toLocaleString()}`);

    // Test 3: Get Current User
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('👤 Test 3: Get Current User\n');

    const user = await authClient.getCurrentUser();
    console.log('✅ User retrieved:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    if (user.avatar?.large) {
      console.log(`   Avatar: ${user.avatar.large}`);
    }

    // Test 4: Get User's Manga List
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('📖 Test 4: Get Reading List\n');

    const readingList = await authClient.getUserMangaList(user.id, 'CURRENT');
    console.log(`✅ Found ${readingList.length} manga in "Reading" list`);

    if (readingList.length > 0) {
      console.log('\n   Current reading:');
      readingList.slice(0, 5).forEach((entry) => {
        const title = entry.media?.title.romaji || 'Unknown';
        const progress = entry.progress;
        const total = entry.media?.chapters || '?';
        console.log(`   - ${title} (${progress}/${total} chapters)`);
      });
    }

    // Test 5: Search and Add to Plan to Read
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('➕ Test 5: Add Manga to Plan to Read\n');

    const searchTest = await authClient.searchManga('Berserk', 1);
    if (searchTest.media.length > 0) {
      const manga = searchTest.media[0];
      console.log(`Found: ${manga.title.romaji}`);
      console.log('Adding to "Plan to Read" list...');

      try {
        const entry = await authClient.addToList(manga.id, 'PLANNING');
        console.log('✅ Successfully added to list!');
        console.log(`   Entry ID: ${entry.id}`);
        console.log(`   Status: ${entry.status}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log('ℹ️  Already in list (this is fine)');
        } else {
          throw error;
        }
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
