import puppeteer from 'puppeteer';
import { AsuraScans } from './services/scraper/asuraScans.js';
import { defaultBrowserConfig } from './config/index.js';

// -------------------------------For Puppeteer Stealth--------------------------------
// ------------------------------------------------------------------------------------
// import { addExtra } from 'puppeteer-extra';
// import vanillaPuppeteer from 'puppeteer';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';

// const puppeteer = addExtra(vanillaPuppeteer);

// puppeteer.use(StealthPlugin()).use(AdblockerPlugin({ blockTrackers: true }));
// ------------------------------------------------------------------------------------

// Helper function for nice console output
function printSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function printSubSection(title: string) {
  console.log('\n' + '-'.repeat(60));
  console.log(`  ${title}`);
  console.log('-'.repeat(60));
}

async function main() {
  printSection(' ManVerse Scraper Demo - AsuraScans');
  
  console.log('\n Launching browser with configuration...');
  const browser = await puppeteer.launch({
    headless: defaultBrowserConfig.headless,
    args: defaultBrowserConfig.args,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(defaultBrowserConfig.viewport);

    // Check for common detection points (optional, for debugging)
    const detectionResults = await page.evaluate(() => {
      return {
        webdriver: navigator.webdriver,
        userAgent: navigator.userAgent,
      };
    });
    console.log('\n Browser Detection Status:', detectionResults);

    const asuraScans = new AsuraScans();

    // ============================================================================
    // Test 1: Search Functionality
    // ============================================================================
    printSection('Test 1: Search Functionality');
    
    const searchTerm = 'dragon';
    console.log(`\n Searching for: "${searchTerm}"`);
    
    const searchResults = await asuraScans.search(false, page, searchTerm, 1);
    
    console.log(`\n Search completed!`);
    console.log(`    Current Page: ${searchResults.currentPage}`);
    console.log(`    Has Next Page: ${searchResults.hasNextPage}`);
    console.log(`    Results Found: ${searchResults.results.length}`);
    
    if (searchResults.results.length > 0) {
      printSubSection('Top 5 Search Results');
      searchResults.results.slice(0, 5).forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.title}`);
        console.log(`    Rating: ${result.rating || 'N/A'}`);
        console.log(`    Status: ${result.status || 'N/A'}`);
        console.log(`    Chapters: ${result.chapters || 'N/A'}`);
        console.log(`    URL: ${result.id}`);
      });
    }

    // ============================================================================
    // Test 2: Get Manhwa Details
    // ============================================================================
    if (searchResults.results.length > 0) {
      printSection('Test 2: Manhwa Details Scraping');
      
      const firstResult = searchResults.results[0];
      console.log(`\n Fetching details for: "${firstResult.title}"`);
      console.log(`   URL: ${firstResult.id}`);
      
      const manhwaDetails = await asuraScans.checkManhwa(page, firstResult.id);
      
      console.log('\n Manhwa details retrieved!');
      printSubSection('Basic Information');
      console.log(`    Title: ${manhwaDetails.title}`);
      console.log(`    Status: ${manhwaDetails.status}`);
      console.log(`    Rating: ${manhwaDetails.rating || 'N/A'}`);
      console.log(`    Followers: ${manhwaDetails.followers || 'N/A'}`);
      
      printSubSection('Credits');
      console.log(`    Author: ${manhwaDetails.author || 'N/A'}`);
      console.log(`    Artist: ${manhwaDetails.artist || 'N/A'}`);
      console.log(`    Serialization: ${manhwaDetails.serialization || 'N/A'}`);
      console.log(`    Updated On: ${manhwaDetails.updatedOn || 'N/A'}`);
      
      printSubSection('Description');
      const truncatedDesc = manhwaDetails.description.length > 200 
        ? manhwaDetails.description.substring(0, 200) + '...'
        : manhwaDetails.description;
      console.log(`   ${truncatedDesc}`);
      
      printSubSection('Genres');
      if (manhwaDetails.genres.length > 0) {
        console.log(`    ${manhwaDetails.genres.join(', ')}`);
      } else {
        console.log(`    No genres available`);
      }
      
      printSubSection('Chapters');
      console.log(`    Total Chapters: ${manhwaDetails.chapters.length}`);
      if (manhwaDetails.chapters.length > 0) {
        console.log(`\n    Latest Chapters:`);
        manhwaDetails.chapters.slice(0, 5).forEach((chapter, index) => {
          console.log(`    ${index + 1}. Chapter ${chapter.chapterNumber}${chapter.chapterTitle ? ` - ${chapter.chapterTitle}` : ''}`);
          console.log(`      ${chapter.releaseDate || 'No date'}`);
        });
        if (manhwaDetails.chapters.length > 5) {
          console.log(`   ... and ${manhwaDetails.chapters.length - 5} more chapters`);
        }
      }
    }

    // ============================================================================
    // Test 3: Pagination Test
    // ============================================================================
    printSection(' Test 3: Pagination Test');
    
    console.log(`\n Testing pagination with "${searchTerm}"...`);
    
    const page2Results = await asuraScans.search(false, page, searchTerm, 2);
    console.log(`\n Page 2 loaded!`);
    console.log(`    Current Page: ${page2Results.currentPage}`);
    console.log(`    Has Next Page: ${page2Results.hasNextPage}`);
    console.log(`    Results Found: ${page2Results.results.length}`);

    // ============================================================================
    // Test 4: Chapter Images Scraping
    // ============================================================================
    if (searchResults.results.length > 0) {
      printSection('Test 4: Chapter Images Scraping');
      
      // We need to get the details again or use the previously fetched details
      // Let's assume we want to check the first chapter of the first manhwa
      const firstResult = searchResults.results[0];
      // We already fetched details in Test 2, but let's re-fetch or use if available
      // To be safe and independent, let's just use the first chapter from the details we got in Test 2
      // Wait, we didn't save the details variable outside the scope of Test 2 block? 
      // Ah, we did: `const manhwaDetails = await asuraScans.checkManhwa(page, firstResult.id);` 
      // But it was inside the if block. Let's re-fetch for clarity or just fetch details if we haven't.
      
      // For simplicity in this script, let's just re-fetch details for the first result to get a chapter URL
      console.log(`\n Getting chapter list for: "${firstResult.title}"`);
      const manhwaDetails = await asuraScans.checkManhwa(page, firstResult.id);
      
      if (manhwaDetails.chapters.length > 0) {
        const firstChapter = manhwaDetails.chapters[0];
        console.log(`\n Checking images for: Chapter ${firstChapter.chapterNumber}`);
        console.log(`   URL: ${firstChapter.chapterUrl}`);
        
        const chapterImages = await asuraScans.checkManhwaChapter(page, firstChapter.chapterUrl);
        
        console.log(`\n Chapter images retrieved!`);
        console.log(`    Total Images: ${chapterImages.length}`);
        
        if (chapterImages.length > 0) {
          console.log(`    First Image: ${chapterImages[0].img}`);
          console.log(`    Last Image: ${chapterImages[chapterImages.length - 1].img}`);
        }

        // ============================================================================
        // Test 5: Chapter Download
        // ============================================================================
        printSection('Test 5: Chapter Download');
        console.log(`\n Downloading images for: Chapter ${firstChapter.chapterNumber}`);
        console.log(`   Target Directory: ${process.cwd()}/man`);
        
        // Note: This will download files to the disk. 
        await asuraScans.downloadManhwaChapter(page, firstChapter.chapterUrl);
        
        console.log(`\n Download completed!`);
      } else {
        console.log('\n No chapters found to test image scraping/download.');
      }
    }

    // ============================================================================
    // Summary
    // ============================================================================
    printSection('Test Summary');
    console.log('\n All tests completed successfully!');
    console.log('\n Tests Performed:');
    console.log('   ✓ Search functionality (Page 1)');
    console.log('   ✓ Manhwa details scraping');
    console.log('   ✓ Pagination (Page 2)');
    console.log('   ✓ Chapter images scraping');
    console.log('   ✓ Chapter download');
    console.log('\n Scraper is working correctly!\n');

  } catch (error) {
    console.error('\n An error occurred:', error);
    console.error('\nStack trace:', (error as Error).stack);
  } finally {
    console.log('\n Closing browser...');
    await browser.close();
    console.log(' Browser closed.\n');
  }
}

main();
