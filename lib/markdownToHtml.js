import { remark } from 'remark'
import html from 'remark-html'
import remarkGfm from 'remark-gfm'
import rehypePrism from 'rehype-prism-plus'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

export default async function markdownToHtml(markdown) {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypePrism)
    .use(rehypeStringify)
    .process(markdown)
  return result.toString()
}
