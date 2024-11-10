import WeChatArticleExtractor from './extractors/wechat-article-extractor.js'
import PageContentExtractor from './extractors/page-content-extractor.js'

export async function crawl(url) {
  try {
    const urlObj = new URL(url)
    const extractor =
      urlObj.hostname === 'mp.weixin.qq.com'
        ? new WeChatArticleExtractor()
        : new PageContentExtractor()

    return await extractor.extract(url)
  } catch (error) {
    console.error('Error crawling content:', error)
    throw error
  }
}
