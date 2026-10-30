// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@pinia/nuxt',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    timeshit: {
      encryptionKey: '',
      databasePath: '',
      trustedOrigin: ''
    },
    vpsPrometheusUrl: 'http://127.0.0.1:9090',
    vpsExpectedServices: '{}',
    auth: {
      trustedProxyIps: '',
      trustedOrigin: process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:3000',
      adminEmail: '',
      adminPassword: ''
    },
    session: {
      password: '',
      name: process.env.NODE_ENV === 'production' ? '__Host-jcore-session' : 'jcore-session',
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      }
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
