import { defineConfig } from 'astro/config';
import { astroImageTools } from 'astro-imagetools';
// eslint-disable-next-line import/no-extraneous-dependencies
import sitemap from '@astrojs/sitemap';
import remarkMermaid from 'astro-diagram/remark-mermaid';
import { visit } from 'unist-util-visit';
import remarkGfm from 'remark-gfm';
import robotsTxt from 'astro-robots-txt';

const breakpoints = {
  xs: '320px',
  sm: '576px',
  md: '768px',
  lg: '992px',
  xl: '1200px',
  xxl: '1840px',
};

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const oEmbedsRemarkPlugin = () => async (ast) => {
  visit(ast, 'link', (node) => {
    const matcher = node.children?.[0]?.value?.match(
      /https:\/\/user-images.githubusercontent.com\/(.*).mp4/,
    );
    if (matcher?.length) {
      node.type = 'html';
      const value = node.children[0].value;
      node.value = `<video src="${value}" controls="controls" autoplay="autoplay" muted="muted"></video>`;
    }
  });
};

export default defineConfig({
  site: isGitHubPages
    ? 'https://kurzi01.github.io'
    : 'https://code.juliancataldo.com',
  base: isGitHubPages ? '/web-garden-2' : undefined,

  server: {
    port: 2425,
    host: false,
  },

  integrations: [
    sitemap(),
    astroImageTools,
    robotsTxt(),
  ],

  markdown: {
    remarkPlugins: [
      remarkGfm,
      remarkMermaid,
      oEmbedsRemarkPlugin,
    ],
  },

  vite: {
    ssr: {
      external: ['svgo'],
    },

    plugins: [],

    css: {
      preprocessorOptions: {
        scss: {
          additionalData(source, filePath) {
            if (filePath.includes('use-')) return source;
            if (filePath.includes('src/themes/default/tokens')) return source;
            if (filePath.includes('src/themes/selector')) return source;
            return `
            @use "sass:color";

            @use "astro-breakpoints/use-breakpoints.scss" as * with (
              $breakpoints: (
                "xs": ${breakpoints.xs},
                "sm": ${breakpoints.sm},
                "md": ${breakpoints.md},
                "lg": ${breakpoints.lg},
                "xl": ${breakpoints.xl},
                "xxl": ${breakpoints.xxl},
              )
            );
            
            @use 'astro-scroll-observer/use-scroll-observer.scss' as *;
            @use './src/themes/default/tokens' as *;
            @use './src/themes/selector' as *;

            ${source}
          `;
          },
        },
      },
    },
  },
});
