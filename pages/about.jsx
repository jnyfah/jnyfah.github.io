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
        <PageHeading>Kaizen 改善</PageHeading>
        <section className="max-w-3xl mx-auto py-8 md:py-16 lg:py-24">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gridGap: 0 }}>
        <div style={{ 
      backgroundColor: 'rgba(50, 50, 50, 0.5)'
    }}>
          <br/>
          <p>&nbsp; &#128188; SWE @ Microsoft</p>
          <br/>
          <p>&nbsp; &#127760; Jupiter</p>
          <br/>
          <p>&nbsp; &#129337; C/C++ | Python | Rust</p>
          <br/>
          <p>&nbsp; &#11088; she/her</p>
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