import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { QueueFactory, QueueAdapterType } from '@manverse/adapters-queue';
import { JobType, JobManager, QueueNames } from '@manverse/core';
import { AsuraScans } from '@manverse/scrapers';

// 1. Initialize Adapters (Switch to SQLITE for zero-config local persistence)
const ADAPTER_TYPE = QueueAdapterType.SQLITE;
const scraperQueue = QueueFactory.create(ADAPTER_TYPE, QueueNames.SCRAPER_JOBS);

// 2. Define Worker Logic (In-Process)
// We use the SAME scraper logic as the distributed worker
const asuraScans = new AsuraScans();
const jobManager = new JobManager();

jobManager.register(JobType.SCRAPE_SEARCH, async (job, data) => {
  return await asuraScans.search((data as any).searchTerm, (data as any).page);
});

(scraperQueue as any).setWorker(async (job: any) => {
  return await jobManager.handle(job);
});

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
          data: { searchTerm: term, page: 1, provider: 'asuraScans' },
        });

        const result = await scraperQueue.waitForAttributes(jobId);
        spinner.stop();

        if (result.status === 'completed') {
          console.log(chalk.green('Search Complete!'));
          const data = result.data as any;
          data.results.forEach((r: any) => {
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
