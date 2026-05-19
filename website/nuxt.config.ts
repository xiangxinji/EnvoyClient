// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-19',

  ssr: true,

  nitro: {
    preset: 'static',
  },

  modules: [
    '@nuxt/content',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
  ],

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
  },

  content: {
    highlight: {
      theme: {
        default: 'github-dark',
        light: 'github-light',
      },
    },
  },

  i18n: {
    locales: [
      { code: 'zh', name: '中文', file: 'zh.json' },
      { code: 'en', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'zh',
    strategy: 'prefix_except_root',
    lazy: true,
    langDir: 'i18n',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
  },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'EnvoyClient',
      meta: [
        { name: 'description', content: 'AI Agent 团队协作桌面客户端 — Team collaboration with intelligent AI agents' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
      ],
    },
  },
})
