<script setup lang="ts">
const route = useRoute()
const expandedGroups = ref(new Set(['Services']))
const serviceLinks = [
  { label: 'VPS', to: '/services/vps' },
  { label: 'Timeshit', to: '/services/timeshit' },
  { label: 'Code Review', to: '/services/code-review' },
  { label: 'Quota Tracker', to: '/services/quota-tracker' }
]
const pageTitle = computed(() => route.path === '/settings'
  ? 'Settings'
  : serviceLinks.find(item => item.to === route.path)?.label ?? 'Dashboard')

function toggleGroup(label: string) {
  if (expandedGroups.value.has(label)) expandedGroups.value.delete(label)
  else expandedGroups.value.add(label)
}
</script>

<template>
  <div class="min-h-screen bg-[#f7f8fa] text-gray-900 dark:bg-[#101214] dark:text-white">
    <aside class="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-gray-200/80 bg-white px-5 py-6 dark:border-gray-800 dark:bg-[#151719] lg:flex">
      <NuxtLink
        to="/"
        class="mb-10 flex cursor-pointer items-center gap-3 px-2"
      >
        <span class="grid size-9 place-items-center rounded-xl bg-emerald-500 text-white"><UIcon
          name="i-lucide-panels-top-left"
          class="size-5"
        /></span>
        <span class="text-[15px] font-semibold tracking-tight">ruang<span class="text-emerald-600">kerja</span></span>
      </NuxtLink>
      <p class="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-gray-400">
        Menu
      </p>
      <nav
        aria-label="Menu utama"
        class="space-y-1"
      >
        <NuxtLink
          to="/"
          class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
          :class="route.path === '/' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'"
          :aria-current="route.path === '/' ? 'page' : undefined"
        >
          <UIcon
            name="i-lucide-layout-dashboard"
            class="size-[18px]"
          />Dashboard
        </NuxtLink>
        <div>
          <UButton
            type="button"
            variant="ghost"
            color="neutral"
            class="w-full cursor-pointer justify-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium"
            :aria-expanded="expandedGroups.has('Services')"
            aria-controls="menu-services"
            @click="toggleGroup('Services')"
          >
            <UIcon
              name="i-lucide-server"
              class="size-[18px]"
            />
            <span class="flex-1 text-left">Services</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 text-gray-400 transition-transform"
              :class="expandedGroups.has('Services') ? 'rotate-180' : ''"
            />
          </UButton>
          <Transition name="submenu">
            <div
              v-show="expandedGroups.has('Services')"
              id="menu-services"
              class="submenu-content ml-5 space-y-0.5 border-l border-gray-200 pl-3 dark:border-gray-700"
            >
              <NuxtLink
                v-for="item in serviceLinks"
                :key="item.to"
                :to="item.to"
                class="block cursor-pointer rounded-md px-3 py-2 text-[13px] transition"
                :class="route.path === item.to ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'"
                :aria-current="route.path === item.to ? 'page' : undefined"
              >{{ item.label }}</NuxtLink>
            </div>
          </Transition>
        </div>
        <NuxtLink
          to="/settings"
          class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
          :class="route.path === '/settings' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'"
          :aria-current="route.path === '/settings' ? 'page' : undefined"
        >
          <UIcon
            name="i-lucide-settings"
            class="size-[18px]"
          />Settings
        </NuxtLink>
      </nav>
      <div class="mt-auto rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-2 flex items-center gap-2 text-xs font-semibold">
          <UIcon
            name="i-lucide-sparkles"
            class="size-4 text-emerald-600"
          /> Demo workspace
        </div>
        <p class="text-xs leading-5 text-gray-500 dark:text-gray-400">
          Values on this page are sample data.
        </p>
      </div>
      <div class="mt-5 flex items-center gap-3 px-1">
        <UAvatar
          text="AR"
          size="sm"
          class="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-white"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-semibold">
            Alya Rahma
          </p><p class="truncate text-[11px] text-gray-500">
            Account owner
          </p>
        </div>
      </div>
    </aside>

    <div class="lg:pl-64">
      <header class="sticky top-0 z-10 border-b border-gray-200/80 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-[#151719]/90">
        <div class="flex h-16 items-center justify-between px-5 sm:px-8">
          <NuxtLink
            to="/"
            class="flex cursor-pointer items-center gap-2.5 lg:hidden"
          ><span class="grid size-8 place-items-center rounded-lg bg-emerald-500 text-white"><UIcon
            name="i-lucide-panels-top-left"
            class="size-4"
          /></span><span class="text-sm font-semibold">ruang<span class="text-emerald-600">kerja</span></span></NuxtLink>
          <div class="hidden text-sm text-gray-500 lg:block">
            Workspace <span class="mx-2 text-gray-300">/</span><span class="font-medium text-gray-900 dark:text-white">{{ pageTitle }}</span>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <UColorModeButton
              color="neutral"
              variant="ghost"
              class="cursor-pointer"
            />
            <UAvatar
              text="AR"
              size="xs"
              class="ml-1 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-white lg:hidden"
            />
          </div>
        </div>
        <nav
          aria-label="Navigasi cepat"
          class="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden"
        >
          <NuxtLink
            to="/"
            class="shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium"
            :class="route.path === '/' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'"
          >Dashboard</NuxtLink>
          <NuxtLink
            v-for="item in serviceLinks"
            :key="item.to"
            :to="item.to"
            class="shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium"
            :class="route.path === item.to ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'"
          >{{ item.label }}</NuxtLink>
          <NuxtLink
            to="/settings"
            class="shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium"
            :class="route.path === '/settings' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'"
          >Settings</NuxtLink>
        </nav>
      </header>
      <main id="main-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.submenu-enter-active,
.submenu-leave-active { overflow: hidden; transition: max-height 200ms ease, opacity 200ms ease, transform 200ms ease; }
.submenu-enter-from,
.submenu-leave-to { max-height: 0; opacity: 0; transform: translateY(-4px); }
.submenu-enter-to,
.submenu-leave-from { max-height: 12rem; opacity: 1; transform: translateY(0); }
@media (prefers-reduced-motion: reduce) { .submenu-enter-active, .submenu-leave-active { transition-duration: 1ms; } }
</style>
