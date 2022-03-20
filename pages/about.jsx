import Head from 'next/head'
import Container from '../components/Layout/Container'
import Layout from '../components/Layout/Layout'
import { BLOG_NAME } from '../lib/constants'
import PageHeading from '../components/PageHeading'
import CartIcon from '../public/assets/blog/authors/avatar.jpg';

export default function About() {
  return (
    <Layout>
      <Head>
        <title>About | {BLOG_NAME}</title>,
      </Head>
      <Container>
      <div style={{ 
      backgroundImage: `url("https://source.unsplash.com/1L71sPT5XKc")` 
    }}>
      <div class="mx-auto pt-12 max-w-4xl h-auto">
      <img src={require('../public/assets/blog/authors/avatar.jpg')}></img>
      </div>
    </div>
   
      </Container>
    </Layout>
  )
}
