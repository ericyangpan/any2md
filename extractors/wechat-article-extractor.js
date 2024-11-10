import { chromium } from 'playwright'
import TurndownService from 'turndown'

export default class WeChatArticleExtractor {
  constructor() {
    this.turndownService = this.configureTurndownService()
  }

  async extract(url) {
    const browser = await chromium.launch({
      headless: true // Set to false for debugging
    })

    try {
      const page = await this.setupPage(browser, url)
      const title = await this.extractTitle(page)
      const content = await this.extractContent(page)
      const metaInfo = await this.extractMetaInfo(page)

      // Convert HTML to Markdown with meta information
      const markdown = this.turndownService.turndown(content)
      const markdownWithMeta = this.addFrontMatter(url, title, metaInfo, markdown)

      return {
        title,
        content: markdownWithMeta,
        url,
        meta: metaInfo
      }
    } catch (error) {
      console.error('Error extracting article:', error)
      throw error
    } finally {
      await browser.close()
    }
  }

  async setupPage(browser, url) {
    const context = await browser.newContext()
    const page = await context.newPage()

    console.log('Loading WeChat article...')
    await page.goto(url, {
      waitUntil: 'networkidle'
    })
    await page.waitForSelector('#js_content')
    return page
  }

  async extractTitle(page) {
    return page.$eval('#activity-name', el => el.textContent.trim())
  }

  async extractContent(page) {
    return page.$eval('#js_content', el => {
      el.querySelectorAll('script').forEach(script => script.remove())
      return el.innerHTML
    })
  }

  async extractMetaInfo(page) {
    return page.evaluate(() => {
      const metaContent = document.querySelector('#meta_content')

      return {
        isOriginal: !!metaContent.querySelector('#copyright_logo'),
        author:
          metaContent.querySelector('#js_author_name')?.textContent.trim() ||
          metaContent
            .querySelector('.rich_media_meta_text')
            ?.textContent.trim(),
        subscriptionAccount:
          metaContent
            .querySelector('.rich_media_meta_nickname a')
            ?.textContent.trim() || '',
        publishTime:
          metaContent.querySelector('#publish_time')?.textContent.trim() || '',
        location:
          metaContent.querySelector('#js_ip_wording')?.textContent.trim() || ''
      }
    })
  }

  configureTurndownService() {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      bulletListMarker: '-'
    })

    // Add custom rules
    this.addEmptyElementRule(turndownService)
    this.addTableRule(turndownService)
    this.addImageRule(turndownService)

    return turndownService
  }

  addEmptyElementRule(turndownService) {
    turndownService.addRule('removeEmpty', {
      filter: node => {
        return (
          node.nodeType === 1 &&
          !node.querySelector('img') &&
          node.textContent.trim() === ''
        )
      },
      replacement: () => ''
    })
  }

  addTableRule(turndownService) {
    turndownService.addRule('tables', {
      filter: ['table'],
      replacement: (content, node) => {
        const rows = node.querySelectorAll('tr')
        if (rows.length === 0) return ''

        let markdown = '\n\n'
        Array.from(rows).forEach((row, rowIndex) => {
          const cells = row.querySelectorAll('td, th')
          markdown +=
            '|' +
            Array.from(cells)
              .map(cell => ` ${cell.textContent.trim()} `)
              .join('|') +
            '|\n'

          if (rowIndex === 0) {
            markdown +=
              '|' +
              Array.from(cells)
                .map(() => ' --- ')
                .join('|') +
              '|\n'
          }
        })
        return markdown + '\n\n'
      }
    })
  }

  addImageRule(turndownService) {
    turndownService.addRule('images', {
      filter: ['img'],
      replacement: (content, node) => {
        const imgUrl = node.getAttribute('data-src') || node.getAttribute('src')

        if (!imgUrl) return ''

        const altText = node.getAttribute('alt') || 'Image'
        return `\n\n![${altText}](${imgUrl})\n\n`
      }
    })
  }

  addFrontMatter(url, title, metaInfo, markdown) {
    return `---
url: ${url}
title: ${title}
is_original: ${metaInfo.isOriginal}
author: ${metaInfo.author}
subscription_account: ${metaInfo.subscriptionAccount}
publish_time: ${metaInfo.publishTime}
location: ${metaInfo.location}
---

${markdown}`
  }
}
