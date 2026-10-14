<script setup lang="ts">
import type { VpsDashboardResponse } from '~/types/vps'

const route = useRoute()
const activity = useTimeshitActivityStore()
const { data: vpsSnapshot } = useNuxtData<VpsDashboardResponse>('vps-dashboard')
const workspaceNotice = computed(() => route.path === '/services/vps'
  ? vpsSnapshot.value?.dataMode === 'live'
    ? { title: 'Live VPS metrics', text: 'Source availability and sample age are shown on this page.' }
    : vpsSnapshot.value?.dataMode === 'mock'
      ? { title: 'Demo VPS data', text: 'Live collection requires a Linux host. These values are samples.' }
      : { title: 'VPS monitoring', text: 'Waiting for a validated metrics response.' }
  : { title: 'JCore workspace', text: 'GitHub connection and tracked repositories persist; other settings are temporary drafts.' })

const serviceLinks = [
  { label: 'VPS', to: '/services/vps' },
  { label: 'Timeshit', to: '/services/timeshit' },
  { label: 'Code Review', to: '/services/code-review' },
  { label: 'Quota Tracker', to: '/services/quota-tracker' }
]

const sidebarOpen = ref(true)
const expandedNavigation = ref(serviceLinks.some(item => item.to === route.path) ? ['services'] : [])
const { user, clear: clearUserSession } = useUserSession()
const pageTitle = computed(() => route.path === '/settings'
  ? 'Settings'
  : serviceLinks.find(item => item.to === route.path)?.label ?? 'Dashboard')
const accountEmail = computed(() => user.value?.email ?? 'Signed in')
const accountInitials = computed(() => accountEmail.value.slice(0, 2).toUpperCase())

async function signOut() {
  activity.reset()
  useTimeshitStore().reset()
  useTimeshitRepositoriesStore().reset()
  await clearUserSession()
  return navigateTo('/login')
}

function closeMobileNavigation() {
  if (import.meta.client && window.matchMedia('(max-width: 1023px)').matches) {
    sidebarOpen.value = false
  }
}

const navigationItems = computed(() => [
  {
    label: 'Dashboard',
    to: '/',
    icon: 'i-lucide-layout-dashboard',
    active: route.path === '/',
    onSelect: closeMobileNavigation
  },
  {
    label: 'Services',
    value: 'services',
    type: 'trigger' as const,
    icon: 'i-lucide-server',
    active: serviceLinks.some(item => item.to === route.path),
    children: serviceLinks.map(item => ({
      label: item.label,
      to: item.to,
      active: route.path === item.to,
      onSelect: closeMobileNavigation
    }))
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: 'i-lucide-settings',
    active: route.path === '/settings',
    onSelect: closeMobileNavigation
  }
])

watch(() => route.path, (path) => {
  if (serviceLinks.some(item => item.to === path) && !expandedNavigation.value.includes('services')) {
    expandedNavigation.value = [...expandedNavigation.value, 'services']
  }
})
</script>

<template>
  <div class="flex min-h-screen bg-app-canvas text-gray-900 dark:bg-app-canvas-dark dark:text-white">
    <USidebar
      v-model:open="sidebarOpen"
      title="Primary navigation"
      description="Workspace navigation"
      collapsible="offcanvas"
      mode="drawer"
      class="z-20"
      :ui="{
        container: 'bg-app-sidebar dark:bg-app-sidebar-dark',
        inner: 'divide-gray-200 dark:divide-gray-800',
        header: 'min-h-20',
        body: 'gap-3',
        footer: 'mt-auto flex-col items-stretch gap-3 overflow-visible'
      }"
    >
      <template #header="{ close }">
        <NuxtLink
          to="/"
          class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-2 py-1"
          @click="closeMobileNavigation"
        >
          <span class="grid size-9 shrink-0 place-items-center rounded-none bg-primary text-white">
            <UIcon
              name="i-lucide-panels-top-left"
              class="size-5"
              aria-hidden="true"
            />
          </span>
          <span class="truncate text-[15px] font-semibold tracking-tight">JCore</span>
        </NuxtLink>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          aria-label="Close navigation"
          class="cursor-pointer lg:hidden"
          @click="close"
        />
      </template>

      <p class="px-3 text-xs font-semibold text-muted">
        Menu
      </p>
      <UNavigationMenu
        v-model="expandedNavigation"
        :items="navigationItems"
        orientation="vertical"
        type="multiple"
        variant="link"
        color="primary"
        class="w-full"
        :ui="{
          list: 'gap-1',
          item: 'w-full',
          link: 'w-full cursor-pointer rounded-none px-3 py-2.5 text-sm font-medium',
          childList: 'ml-5 border-l border-default pl-3',
          childLink: 'cursor-pointer rounded-none px-3 py-2 text-[13px]'
        }"
      />

      <template #footer>
        <div class="border border-default bg-muted p-4">
          <div class="mb-2 flex items-center gap-2 text-xs font-semibold">
            <UIcon
              name="i-lucide-sparkles"
              class="size-4 text-primary"
              aria-hidden="true"
            />{{ workspaceNotice.title }}
          </div>
          <p class="text-xs leading-5 text-muted">
            {{ workspaceNotice.text }}
          </p>
        </div>
        <div class="mt-2 flex min-w-0 items-center gap-3 px-1 py-2">
          <UAvatar
            :text="accountEmail.slice(0, 2).toUpperCase()"
            size="sm"
            class="bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-white"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-semibold">
              {{ accountEmail }}
            </p>
            <p class="truncate text-[11px] text-muted">
              Administrator
            </p>
          </div>
        </div>
        <UButton
          label="Sign out"
          icon="i-lucide-log-out"
          color="neutral"
          variant="outline"
          block
          class="mt-1 cursor-pointer"
          @click="signOut"
        />
      </template>
    </USidebar>

    <div class="min-w-0 flex-1">
      <header class="sticky top-0 z-10 border-b border-default bg-app-sidebar dark:bg-app-sidebar-dark">
        <div class="flex h-16 items-center gap-3 px-4 sm:px-8">
          <UButton
            icon="i-lucide-menu"
            label="Menu"
            color="neutral"
            variant="ghost"
            class="cursor-pointer lg:hidden"
            aria-label="Open navigation menu"
            @click="sidebarOpen = true"
          />
          <div class="hidden text-sm text-muted lg:block">
            Workspace <span class="mx-2 text-gray-300 dark:text-gray-600">/</span><span class="font-medium text-gray-900 dark:text-white">{{ pageTitle }}</span>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <UColorModeButton
              color="neutral"
              variant="ghost"
              class="cursor-pointer"
            />
            <UAvatar
              :text="accountInitials"
              size="xs"
              class="ml-1 bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-white lg:hidden"
            />
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabindex="-1"
      >
        <slot />
      </main>
    </div>
  </div>
</template>
