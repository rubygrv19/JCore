<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Sign in',
  description: 'Sign in to the JCore service dashboard.'
})

const route = useRoute()
const email = ref('')
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const { fetch: refreshSession } = useUserSession()

const redirectPath = computed(() => {
  const redirect = route.query.redirect
  if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.startsWith('/\\')) {
    return '/'
  }

  return redirect
})

async function signIn() {
  if (!email.value.trim() || !password.value || isSubmitting.value) return

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    await refreshSession()
    password.value = ''
    await navigateTo(redirectPath.value, { replace: true })
  } catch (error) {
    const statusCode = (error as { statusCode?: number, status?: number }).statusCode
      ?? (error as { status?: number }).status

    errorMessage.value = statusCode === 429
      ? 'Too many sign-in attempts. Wait one minute and try again.'
      : statusCode === 503
        ? 'Sign-in is not configured. Ask the administrator to configure the server credentials.'
        : statusCode === 401 ? 'Email address or password is incorrect.' : 'Sign-in is temporarily unavailable. Please try again.'
    password.value = ''
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-svh flex-col bg-app-canvas text-gray-900 dark:bg-app-canvas-dark dark:text-white">
    <header class="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-gray-300 px-5 py-5 dark:border-gray-700 sm:px-8 sm:py-6">
      <NuxtLink
        to="/login"
        class="inline-flex min-h-11 cursor-pointer items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <span class="grid size-9 place-items-center rounded-none bg-primary text-white">
          <UIcon
            name="i-lucide-panels-top-left"
            class="size-5"
            aria-hidden="true"
          />
        </span>
        <span class="text-[15px] font-semibold tracking-tight">JCore</span>
      </NuxtLink>
      <UColorModeButton
        color="neutral"
        variant="ghost"
        aria-label="Toggle color mode"
        class="cursor-pointer"
      />
    </header>

    <section class="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-12 lg:gap-16">
      <div class="lg:col-span-6">
        <div class="max-w-2xl">
          <p class="mb-5 text-sm font-semibold text-muted dark:text-muted">
            JCore / Administrator access
          </p>
          <h1 class="text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            Sign in to JCore
          </h1>
          <p class="mt-5 max-w-lg text-base leading-7 text-gray-600 dark:text-muted">
            Use your administrator account to access the service dashboard.
          </p>
        </div>
      </div>

      <div class="lg:col-span-5 lg:col-start-8">
        <UCard
          class="rounded-none border-gray-300 bg-white shadow-none dark:border-gray-700 dark:bg-app-sidebar-dark"
          :ui="{ body: 'p-5 sm:p-7' }"
        >
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Unable to sign in"
            :description="errorMessage"
            class="mb-6"
            role="alert"
          />

          <form
            class="space-y-5"
            aria-label="Administrator sign-in"
            @submit.prevent="signIn"
          >
            <UFormField
              label="Email address"
              name="email"
              required
            >
              <UInput
                v-model="email"
                type="email"
                autocomplete="username"
                inputmode="email"
                placeholder="Email address"
                icon="i-lucide-mail"
                leading
                size="lg"
                required
                class="mt-1.5 w-full"
                :disabled="isSubmitting"
              />
            </UFormField>

            <UFormField
              label="Password"
              name="password"
              required
            >
              <UInput
                v-model="password"
                type="password"
                autocomplete="current-password"
                placeholder="Enter your password"
                icon="i-lucide-lock-keyhole"
                leading
                size="lg"
                required
                class="mt-1.5 w-full"
                :disabled="isSubmitting"
              />
            </UFormField>

            <UButton
              type="submit"
              :label="isSubmitting ? 'Signing in…' : 'Sign in'"
              icon="i-lucide-arrow-right"
              trailing
              block
              size="lg"
              color="primary"
              :loading="isSubmitting"
              :disabled="isSubmitting || !email.trim() || !password"
              :class="isSubmitting || !email.trim() || !password ? 'cursor-not-allowed' : 'cursor-pointer'"
            />
          </form>
        </UCard>
      </div>
    </section>

    <footer class="mx-auto w-full max-w-7xl border-t border-gray-300 px-5 py-4 text-xs text-muted dark:border-gray-700 dark:text-muted sm:px-8">
      JCore · Service dashboard
    </footer>
  </main>
</template>
