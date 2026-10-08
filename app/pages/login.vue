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

    errorMessage.value = statusCode === 503
      ? 'Sign-in is not configured. Ask the administrator to configure the server credentials.'
      : 'Email address or password is incorrect.'
    password.value = ''
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-svh flex-col bg-app-canvas text-gray-900 dark:bg-app-canvas-dark dark:text-white">
    <header class="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
      <NuxtLink
        to="/login"
        class="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <span class="grid size-9 place-items-center rounded-xl bg-primary text-white">
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

    <section class="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
      <div class="w-full max-w-md">
        <div class="mb-6 text-center">
          <h1 class="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Sign in to JCore
          </h1>
          <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
            Use your administrator account to access the service dashboard.
          </p>
        </div>

        <UCard
          class="rounded-2xl border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-app-sidebar-dark"
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

    <footer class="px-5 pb-5 text-center text-xs text-gray-500 dark:text-gray-500 sm:pb-6">
      JCore · Service dashboard
    </footer>
  </main>
</template>
