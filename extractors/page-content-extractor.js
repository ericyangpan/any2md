import { chromium } from 'playwright'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'

export default class PageContentExtractor {
  constructor(options = {}) {
    this.options = {
      timeout: 30000,
      waitForSelector: null,
      removeSelectors: [],
      scrollToLoad: false,
      ...options
    }
    this.turndownService = this.configureTurndownService()
  }

  configureTurndownService() {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      bulletListMarker: '-'
    })
    return turndownService
  }

  async extract(url) {
    const browser = await chromium.launch({
      headless: true
    })

    try {
      const page = await browser.newPage()

      // Set viewport size
      await page.setViewportSize({ width: 1280, height: 800 })

      // Navigate to page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.options.timeout
      })

      // Wait for specific content if specified
      if (this.options.waitForSelector) {
        await page.waitForSelector(this.options.waitForSelector, {
          timeout: this.options.timeout
        })
      }

      // Scroll to load lazy content if needed
      if (this.options.scrollToLoad) {
        await this.autoScroll(page)
      }

      // Remove unwanted elements
      if (this.options.removeSelectors.length > 0) {
        await this.removeElements(page, this.options.removeSelectors)
      }

      // Get the final HTML content
      const html = await page.content()

      // Extract content using Readability
      const dom = new JSDOM(html, { url })
      const reader = new Readability(dom.window.document, {
        // Readability options
        charThreshold: 20
      })

      const article = reader.parse()

      // Optional: Get meta information
      const metadata = await this.extractMetadata(page)

      // Convert HTML content to Markdown
      const markdown = this.turndownService.turndown(article.content)
      const markdownWithMeta = this.addFrontMatter(url, metadata, markdown)

      return {
        title: article.title,
        content: markdownWithMeta,
        url,
        meta: metadata
      }
    } catch (error) {
      console.error('Error extracting content:', error)
      throw error
    } finally {
      await browser.close()
    }
  }

  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0
        const distance = 100
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance

          if (totalHeight >= scrollHeight) {
            clearInterval(timer)
            resolve()
          }
        }, 100)
      })
    })
  }

  async removeElements(page, selectors) {
    for (const selector of selectors) {
      await page.evaluate(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove())
      }, selector)
    }
  }

  async extractMetadata(page) {
    return await page.evaluate(() => {
      const metadata = {}

      // Get meta tags
      const metaTags = document.querySelectorAll('meta')
      metaTags.forEach(tag => {
        const name = tag.getAttribute('name') || tag.getAttribute('property')
        const content = tag.getAttribute('content')
        // Only collect title, author, and description
        if (name && content && ['title', 'author', 'description'].includes(name)) {
          metadata[name] = content
        }
      })

      // Get title if not found in meta tags
      if (!metadata.title) {
        metadata.title = document.title
      }

      return metadata
    })
  }

  addFrontMatter(url, metadata, markdown) {
    return `---
url: ${url}
title: ${metadata.title || ''}
author: ${metadata.author || ''}
description: ${metadata.description || ''}
---

${markdown}`
  }
}
