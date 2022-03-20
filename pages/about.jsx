import Head from 'next/head'
import Container from '../components/Layout/Container'
import Layout from '../components/Layout/Layout'
import { BLOG_NAME } from '../lib/constants'
import PageHeading from '../components/PageHeading'
import CartIcon from '../public/assets/blog/Capture3.JPG';

export default function About() {
  return (
    <div>
      <img src="assets/blog/Capture3.JPG" alt="BigCo Inc. logo"/>
    </div>
  );
}
