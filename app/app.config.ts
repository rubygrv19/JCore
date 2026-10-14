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
    button: {
      slots: { base: 'cursor-pointer' }
    },
    select: {
      slots: { base: 'cursor-pointer', item: 'cursor-pointer' }
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
