#!/usr/bin/env node

import { Command } from 'commander'
import { crawl } from './crawler.js'
import fs from 'fs/promises'

const program = new Command()

program
  .version('1.0.0')
  .description('Any Web Page Markdown Converter')
  .argument('<url>', 'URL of the webpage to convert')
  .option('-o, --output <filename>', 'output filename (optional)')
  .action(async (url, options) => {
    console.log('Processing URL:', url)

    try {
      const page = await crawl(url)
      console.log('Title:', page.title)

      // Generate filename from page title or use provided output name
      const filename =
        options.output || `${page.title.replace(/[<>:"/\\|?*]/g, '_')}.md`
      await fs.writeFile(filename, page.content)
      console.log('Content saved to:', filename)
    } catch (error) {
      console.error('Failed to process page:', error)
      process.exit(1)
    }
  })

if (!process.argv.slice(2).length) {
  program.help()
} else {
  program.parse()
}
