export default defineAppConfig({
  ui: {
    colors: {
      primary: 'neutral',
      secondary: 'neutral',
      success: 'neutral',
      info: 'neutral',
      warning: 'neutral',
      error: 'neutral',
      neutral: 'zinc'
    },
    card: {
      slots: {
        root: 'rounded-none'
      }
    },
    badge: {
      slots: {
        base: 'rounded-none tracking-wide'
      }
    }
  }
})
