import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypePrism from '../lib/rehype-prism'

export default async function markdownToHtml(markdown) {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypePrism)
    .use(rehypeStringify)
    .process(markdown)

  return result.toString()
}
