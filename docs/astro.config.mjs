import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://ogabrielluiz.github.io',
  base: '/patchflow',
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'patchflow',
      description: 'Eurorack patch diagram renderer. Patchbook-compatible notation to skeuomorphic SVG.',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: false,
      },
      customCss: ['./src/styles/custom.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/ogabrielluiz/patchflow' },
      ],
      editLink: {
        baseUrl: 'https://github.com/ogabrielluiz/patchflow/edit/main/docs/',
      },
      lastUpdated: true,
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Introduction', slug: 'guides/intro' },
            { label: 'Quickstart', slug: 'guides/quickstart' },
          ],
        },
        {
          label: 'Notation',
          items: [
            { label: 'Syntax', slug: 'guides/notation' },
            { label: 'Signal operators', slug: 'guides/operators' },
            { label: 'Modules, voices, params', slug: 'guides/structure' },
          ],
        },
        {
          label: 'Rendering',
          items: [
            { label: 'Theming', slug: 'guides/theming' },
            { label: 'Layout', slug: 'guides/layout' },
          ],
        },
        { label: 'Playground', slug: 'playground' },
        { label: 'Gallery', slug: 'gallery' },
        {
          label: 'API reference',
          items: [
            { label: 'Functions', slug: 'reference/api' },
            { label: 'Types', slug: 'reference/types' },
          ],
        },
      ],
      components: {
        // keep Starlight defaults; override later if needed
      },
      head: [
        {
          tag: 'meta',
          attrs: { name: 'theme-color', content: '#0d1117' },
        },
      ],
    }),
  ],
  vite: {
    ssr: {
      noExternal: ['@ogabrielluiz/patchflow'],
    },
  },
});
