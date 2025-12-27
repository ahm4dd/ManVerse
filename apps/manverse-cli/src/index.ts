import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { QueueFactory, QueueAdapterType } from '@manverse/adapters-queue';
import {
  JobType,
  JobManager,
  QueueNames,
  JobStatus,
  type IJobQueue,
  type Job,
  type SearchResult,
  type SearchedManhwa,
  type ScrapeSearchData,
} from '@manverse/core';
import { AsuraScans } from '@manverse/scrapers';

// 1. Initialize Adapters (Switch to SQLITE for zero-config local persistence)
const ADAPTER_TYPE = QueueAdapterType.SQLITE;
const scraperQueue = QueueFactory.create(ADAPTER_TYPE, QueueNames.SCRAPER_JOBS) as IJobQueue;

// 2. Define Worker Logic (In-Process)
// We use the SAME scraper logic as the distributed worker
const asuraScans = new AsuraScans();
const jobManager = new JobManager();

jobManager.register(JobType.SCRAPE_SEARCH, async (_job, data) => {
  return await asuraScans.search(data.searchTerm, data.page);
});

// For local mode, we manually route queue jobs to the manager
// We cast scraperQueue as any only for the worker setup if the interface doesn't expose it
if ('setWorker' in scraperQueue) {
  (scraperQueue as any).setWorker(async (job: Job<unknown, unknown>) => {
    return await jobManager.handle(job);
  });
}

async function main() {
  console.log(chalk.bold.blue('ManVerse CLI - Professional Local Mode'));
  console.log(chalk.gray('Deployment-Agnostic Architecture (Bun + SQLite)\n'));

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: ['Search Manhwa (AsuraScans)', 'Exit'],
      },
    ]);

    if (action === 'Exit') {
      process.exit(0);
    }

    if (action === 'Search Manhwa (AsuraScans)') {
      const { term } = await inquirer.prompt([
        {
          type: 'input',
          name: 'term',
          message: 'Enter search term:',
        },
      ]);

      const spinner = ora('Searching via Local SQLite Queue...').start();

      try {
        const jobId = await scraperQueue.add({
          type: JobType.SCRAPE_SEARCH,
          data: { searchTerm: term, page: 1, provider: 'asuraScans' } as ScrapeSearchData,
        });

        const result = await scraperQueue.waitForAttributes(jobId);
        spinner.stop();

        if (result.status === JobStatus.COMPLETED) {
          console.log(chalk.green('Search Complete!'));
          const data = result.data as SearchResult;
          data.results.forEach((r: SearchedManhwa) => {
            console.log(`${chalk.yellow(r.title)} - ${chalk.gray(r.id)}`);
          });
        } else {
          console.log(chalk.red('Search Failed:'), result.error);
        }
      } catch (error) {
        spinner.fail('Error occurred');
        console.error(error);
      }
    }
  }
}

main();
