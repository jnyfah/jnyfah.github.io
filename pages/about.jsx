import Head from 'next/head'
import Container from '../components/Layout/Container'
import Layout from '../components/Layout/Layout'
import { BLOG_NAME } from '../lib/constants'
import PageHeading from '../components/PageHeading'

export default function About() {
  return (
    <Layout>
      <Head>
        <title>About | {BLOG_NAME}</title>
      </Head>
      <Container>
        <PageHeading>kobayashi maru ...</PageHeading>
        <section className="max-w-3xl mx-auto py-8 md:py-16 lg:py-24">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gridGap: 0 }}>
        <div style={{ 
      backgroundColor: 'rgba(52, 52, 52, 0.8)'
    }}>
          <br/>
          <p>&nbsp; &#128188; &nbsp;&nbsp; SWE @ Microsoft</p>
          <br/>
          <p>&nbsp; &#127760; &nbsp;&nbsp; Jupiter</p>
          <br/>
          <p>&nbsp; &#129337; &nbsp;&nbsp; C/C++, Python and Rust</p>
          <br/>
          <p>&nbsp; &#11088; &nbsp;&nbsp; she/her</p>
       </div>
       <div>
       <img src="assets/blog/authors/avatar.jpg" alt="BigCo Inc. logo"/>
       </div>
  </div>
        </section>
      </Container>
    </Layout>
  )	
}