<script setup lang="ts">
const menuGroups = [
  {
    label: 'Dashboard',
    icon: 'i-lucide-layout-dashboard',
    children: [
      { label: 'Ringkasan', href: '#ringkasan' },
      { label: 'Pendapatan', href: '#pendapatan' },
      { label: 'Target bulanan', href: '#target' }
    ]
  },
  {
    label: 'Services',
    icon: 'i-lucide-server',
    children: [
      { label: 'VPS', href: '#vps' },
      { label: 'Timeshit', href: '#timeshit' },
      { label: 'Code Review', href: '#code-review' },
      { label: 'Quota Tracker', href: '#quota-tracker' }
    ]
  },
  {
    label: 'Settings',
    icon: 'i-lucide-settings',
    children: []
  }
]

const expandedGroups = ref(new Set(['Dashboard', 'Services']))
const activeMenu = ref('Ringkasan')
const services = [
  { label: 'VPS', icon: 'i-lucide-server' },
  { label: 'Timeshit', icon: 'i-lucide-clock-3' },
  { label: 'Code Review', icon: 'i-lucide-git-pull-request' },
  { label: 'Quota Tracker', icon: 'i-lucide-chart-no-axes-column-increasing' }
]
const selectedService = ref('')
const configModalOpen = ref(false)
const connectionAccordion = ref<string | undefined>('connection')
const dangerZoneAccordion = ref<string | undefined>()
const baseUrls = reactive<Record<string, string>>(Object.fromEntries(services.map(service => [service.label, ''])))
const baseUrlDraft = ref('')
const serviceModes = reactive<Record<string, string>>(Object.fromEntries(services.map(service => [service.label, ''])))
const serviceModeDraft = ref('')
const shutdownConfirmed = ref(false)
const serviceModeOptions = [
  { value: 'coming-soon', label: 'Coming Soon', description: 'Tandai layanan sebagai belum tersedia.', icon: 'i-lucide-sparkles', color: 'info' as const },
  { value: 'maintenance', label: 'Maintenance', description: 'Tandai layanan sedang dalam pemeliharaan.', icon: 'i-lucide-wrench', color: 'warning' as const },
  { value: 'shutdown', label: 'Shutdown', description: 'Tandai layanan sebagai tidak aktif.', icon: 'i-lucide-power', color: 'error' as const }
]
const serviceCards = computed(() => services.map(service => ({
  ...service,
  mode: serviceModeOptions.find(mode => mode.value === serviceModes[service.label])
})))
const activeService = computed(() => services.find(service => service.label === activeMenu.value))
const activeServiceHref = computed(() => menuGroups.flatMap(group => group.children).find(child => child.label === activeMenu.value)?.href)

function openConfig(service: string) {
  selectedService.value = service
  baseUrlDraft.value = baseUrls[service] ?? ''
  serviceModeDraft.value = serviceModes[service] ?? ''
  shutdownConfirmed.value = false
  connectionAccordion.value = 'connection'
  dangerZoneAccordion.value = undefined
  configModalOpen.value = true
}

function saveConfig() {
  baseUrls[selectedService.value] = baseUrlDraft.value.trim()
  serviceModes[selectedService.value] = serviceModeDraft.value
  configModalOpen.value = false
}

function cancelConfig() {
  configModalOpen.value = false
}

function toggleGroup(label: string) {
  if (expandedGroups.value.has(label)) expandedGroups.value.delete(label)
  else expandedGroups.value.add(label)
}

function openSettings() {
  activeMenu.value = 'Settings'
  window.location.hash = 'settings'
}

function syncPageFromHash() {
  if (window.location.hash === '#settings') {
    activeMenu.value = 'Settings'
    return
  }

  const menuItem = menuGroups.flatMap(group => group.children).find(child => child.href === window.location.hash)
  if (menuItem) activeMenu.value = menuItem.label
}

onMounted(() => {
  syncPageFromHash()
  window.addEventListener('hashchange', syncPageFromHash)
})

onBeforeUnmount(() => window.removeEventListener('hashchange', syncPageFromHash))

const metrics = [
  { label: 'Total pendapatan', value: 'Rp 48,2 jt', change: '+12,8%', icon: 'i-lucide-wallet', tone: 'green' },
  { label: 'Pesanan', value: '1.284', change: '+8,2%', icon: 'i-lucide-shopping-bag', tone: 'blue' },
  { label: 'Pelanggan baru', value: '356', change: '+5,4%', icon: 'i-lucide-users', tone: 'violet' },
  { label: 'Rata-rata pesanan', value: 'Rp 375 rb', change: '+2,1%', icon: 'i-lucide-chart-no-axes-combined', tone: 'amber' }
]

const transactions = [
  { initials: 'AS', name: 'Aditya Saputra', email: 'aditya@mail.com', item: 'Paket Starter', date: 'Hari ini, 10:42', amount: 'Rp 450.000', status: 'Selesai' },
  { initials: 'NP', name: 'Nadia Putri', email: 'nadia@mail.com', item: 'Paket Pro', date: 'Hari ini, 09:18', amount: 'Rp 1.250.000', status: 'Diproses' },
  { initials: 'RF', name: 'Rizky Firmansyah', email: 'rizky@mail.com', item: 'Paket Starter', date: 'Kemarin, 16:35', amount: 'Rp 450.000', status: 'Selesai' },
  { initials: 'DL', name: 'Dewi Lestari', email: 'dewi@mail.com', item: 'Paket Bisnis', date: 'Kemarin, 14:07', amount: 'Rp 2.400.000', status: 'Selesai' }
]

</script>

<template>
  <div class="min-h-screen bg-[#f7f8fa] text-gray-900 dark:bg-[#101214] dark:text-white">
    <aside class="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-gray-200/80 bg-white px-5 py-6 dark:border-gray-800 dark:bg-[#151719] lg:flex">
      <a href="#ringkasan" class="mb-10 flex items-center gap-3 px-2" @click="activeMenu = 'Ringkasan'">
        <span class="grid size-9 place-items-center rounded-xl bg-emerald-500 text-white"><UIcon name="i-lucide-panels-top-left" class="size-5" /></span>
        <span class="text-[15px] font-semibold tracking-tight">ruang<span class="text-emerald-600">kerja</span></span>
      </a>
      <p class="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-gray-400">Menu</p>
      <nav aria-label="Menu utama" class="space-y-1">
        <div v-for="group in menuGroups" :key="group.label">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            :class="activeMenu === group.label ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : ''"
            :aria-expanded="group.children.length ? expandedGroups.has(group.label) : undefined"
            :aria-controls="group.children.length ? `menu-${group.label.toLowerCase()}` : undefined"
            @click="group.children.length ? toggleGroup(group.label) : openSettings()"
          >
            <UIcon :name="group.icon" class="size-[18px]" />
            <span class="flex-1">{{ group.label }}</span>
            <UIcon v-if="group.children.length" name="i-lucide-chevron-down" class="size-4 text-gray-400 transition-transform" :class="expandedGroups.has(group.label) ? 'rotate-180' : ''" />
          </button>
          <Transition v-if="group.children.length" name="submenu">
            <div v-show="expandedGroups.has(group.label)" :id="`menu-${group.label.toLowerCase()}`" class="submenu-content ml-5 space-y-0.5 border-l border-gray-200 pl-3 dark:border-gray-700">
              <a
                v-for="child in group.children"
                :key="child.label"
                :href="child.href"
                class="block cursor-pointer rounded-md px-3 py-2 text-[13px] transition"
                :class="activeMenu === child.label ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'"
                :aria-current="activeMenu === child.label ? 'page' : undefined"
                @click="activeMenu = child.label"
              >
                {{ child.label }}
              </a>
            </div>
          </Transition>
        </div>
      </nav>
      <div class="mt-auto rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
        <div class="mb-2 flex items-center gap-2 text-xs font-semibold"><UIcon name="i-lucide-sparkles" class="size-4 text-emerald-600" /> Ruang kerja demo</div>
        <p class="text-xs leading-5 text-gray-500 dark:text-gray-400">Angka pada halaman ini adalah data contoh.</p>
      </div>
      <div class="mt-5 flex items-center gap-3 px-1">
        <UAvatar text="AR" size="sm" class="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-white" />
        <div class="min-w-0 flex-1"><p class="truncate text-xs font-semibold">Alya Rahma</p><p class="truncate text-[11px] text-gray-500">Pemilik akun</p></div>
        <UIcon name="i-lucide-chevrons-up-down" class="size-4 text-gray-400" />
      </div>
    </aside>

    <main id="ringkasan" class="lg:pl-64">
      <header class="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200/80 bg-white/90 px-5 backdrop-blur-md dark:border-gray-800 dark:bg-[#151719]/90 sm:px-8">
        <a href="#ringkasan" class="flex items-center gap-2.5 lg:hidden" @click="activeMenu = 'Ringkasan'">
          <span class="grid size-8 place-items-center rounded-lg bg-emerald-500 text-white"><UIcon name="i-lucide-panels-top-left" class="size-4" /></span>
          <span class="text-sm font-semibold">ruang<span class="text-emerald-600">kerja</span></span>
        </a>
        <div class="hidden text-sm text-gray-500 lg:block">Workspace <span class="mx-2 text-gray-300">/</span><span class="font-medium text-gray-900 dark:text-white">{{ activeMenu }}</span></div>
        <div class="ml-auto flex items-center gap-2">
          <UIcon name="i-lucide-search" class="mx-2 size-[18px] text-gray-400" aria-hidden="true" />
          <UIcon name="i-lucide-bell" class="mx-2 size-[18px] text-gray-400" aria-hidden="true" />
          <UColorModeButton color="neutral" variant="ghost" />
          <UAvatar text="AR" size="xs" class="ml-1 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-white lg:hidden" />
        </div>
      </header>

      <div v-if="activeMenu === 'Settings'" id="settings" class="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">Settings</h1>
          <p class="mt-1 text-sm text-gray-500">Konfigurasi layanan.</p>
        </div>
        <section aria-label="Konfigurasi services" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="service in serviceCards"
            :key="service.label"
            type="button"
            class="cursor-pointer rounded-xl border border-gray-200/80 bg-white p-5 text-left shadow-none transition hover:border-emerald-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-gray-800 dark:bg-[#151719] dark:hover:border-emerald-700"
            @click="openConfig(service.label)"
          >
            <span class="mb-5 flex items-start justify-between gap-3">
              <span class="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <UIcon :name="service.icon" class="size-5" />
              </span>
              <UBadge v-if="service.mode" :color="service.mode.color" variant="subtle" size="sm" class="rounded-full">
                <UIcon :name="service.mode.icon" class="mr-1 size-3.5" />{{ service.mode.label }}
              </UBadge>
              <UBadge v-else color="neutral" variant="subtle" size="sm" class="rounded-full">Belum diatur</UBadge>
            </span>
            <span class="block text-sm font-semibold">{{ service.label }}</span>
            <span class="mt-1 block text-xs text-gray-500">Konfigurasi layanan</span>
            <span class="mt-5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Atur konfigurasi<UIcon name="i-lucide-arrow-up-right" class="size-3.5" /></span>
          </button>
        </section>
      </div>

      <div v-else-if="activeService" :id="activeServiceHref?.slice(1)" class="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">{{ activeService.label }}</h1>
          <p class="mt-1 text-sm text-gray-500">Halaman layanan.</p>
        </div>
        <UCard class="rounded-xl border-gray-200/80 bg-white shadow-none dark:border-gray-800 dark:bg-[#151719]" :ui="{ body: 'p-8 sm:p-12' }">
          <div class="flex min-h-64 flex-col items-center justify-center text-center">
            <span class="mb-5 grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <UIcon :name="activeService.icon" class="size-6" />
            </span>
            <UBadge color="info" variant="subtle" class="rounded-full">Coming Soon</UBadge>
            <h2 class="mt-4 text-lg font-semibold tracking-tight">{{ activeService.label }} sedang disiapkan</h2>
            <p class="mt-2 max-w-sm text-sm leading-6 text-gray-500">Konten untuk layanan ini akan tersedia segera.</p>
          </div>
        </UCard>
      </div>

      <div v-else class="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
        <div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p class="mb-2 text-sm text-gray-500">Minggu, 27 September 2026</p><h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">Ringkasan</h1><p class="mt-1 text-sm text-gray-500">Pantau perkembangan bisnis Anda.</p></div>
          <div class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"><UIcon name="i-lucide-calendar-days" class="size-4 text-gray-400" />7 hari terakhir<UIcon name="i-lucide-chevron-down" class="size-4 text-gray-400" /></div>
        </div>

        <section aria-label="Metrik utama" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UCard v-for="metric in metrics" :key="metric.label" class="rounded-xl border-gray-200/80 bg-white shadow-none dark:border-gray-800 dark:bg-[#151719]" :ui="{ body: 'p-5 sm:p-5' }">
            <div class="flex items-start justify-between"><p class="text-[13px] font-medium text-gray-500">{{ metric.label }}</p><span class="grid size-9 place-items-center rounded-lg" :class="`metric-${metric.tone}`"><UIcon :name="metric.icon" class="size-[18px]" /></span></div>
            <div class="mt-4 flex items-baseline gap-2"><p class="text-[25px] font-semibold tracking-tight">{{ metric.value }}</p><span class="text-[11px] font-medium text-emerald-600">{{ metric.change }}</span></div>
            <p class="mt-1.5 text-xs text-gray-400">dibanding 7 hari sebelumnya</p>
          </UCard>
        </section>

        <section class="mt-6 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
          <div id="pendapatan" class="scroll-mt-20">
            <UCard class="rounded-xl border-gray-200/80 bg-white shadow-none dark:border-gray-800 dark:bg-[#151719]" :ui="{ body: 'p-5 sm:p-6' }">
              <div class="flex items-start justify-between"><div><h2 class="text-sm font-semibold">Pendapatan</h2><p class="mt-1 text-xs text-gray-500">Performa selama 7 hari terakhir</p></div><span class="inline-flex items-center gap-1.5 text-xs text-gray-500"><span class="size-2 rounded-full bg-emerald-500" /> Minggu ini</span></div>
              <RevenueChart class="mt-7" />
            </UCard>
          </div>

          <div id="target" class="scroll-mt-20">
            <UCard class="rounded-xl border-gray-200/80 bg-white shadow-none dark:border-gray-800 dark:bg-[#151719]" :ui="{ body: 'p-5 sm:p-6' }">
              <div class="flex items-start justify-between"><div><h2 class="text-sm font-semibold">Target bulanan</h2><p class="mt-1 text-xs text-gray-500">Pendapatan bulan ini</p></div><UIcon name="i-lucide-ellipsis" class="size-5 text-gray-400" /></div>
              <div class="mt-7 flex items-center gap-5">
                <div class="relative grid size-28 shrink-0 place-items-center rounded-full" style="background: conic-gradient(#10b981 0% 72%, #e5e7eb 72% 100%)"><div class="grid size-[5.4rem] place-items-center rounded-full bg-white text-center dark:bg-[#151719]"><div><p class="text-xl font-semibold">72%</p><p class="text-[10px] text-gray-400">tercapai</p></div></div></div>
                <div><p class="text-2xl font-semibold tracking-tight">Rp 72 jt</p><p class="mt-1 text-xs text-gray-500">dari target Rp 100 jt</p><p class="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><UIcon name="i-lucide-trending-up" class="size-3.5" />On track</p></div>
              </div>
              <div class="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-800">Sisa target <span class="float-right font-medium text-gray-900 dark:text-white">Rp 28 jt</span></div>
            </UCard>
          </div>
        </section>

        <section id="transaksi" class="mt-6 scroll-mt-20">
          <UCard class="rounded-xl border-gray-200/80 bg-white shadow-none dark:border-gray-800 dark:bg-[#151719]" :ui="{ body: 'p-0' }">
            <div class="flex items-center justify-between px-5 py-5 sm:px-6"><div><h2 class="text-sm font-semibold">Transaksi terbaru</h2><p class="mt-1 text-xs text-gray-500">Aktivitas penjualan terkini</p></div><a href="#transaksi" class="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Lihat semua<UIcon name="i-lucide-arrow-up-right" class="size-3.5" /></a></div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[700px] text-left text-xs">
                <thead><tr class="border-y border-gray-100 text-[10px] uppercase tracking-wider text-gray-400 dark:border-gray-800"><th class="px-6 py-3 font-medium">Pelanggan</th><th class="px-4 py-3 font-medium">Produk</th><th class="px-4 py-3 font-medium">Tanggal</th><th class="px-4 py-3 font-medium">Jumlah</th><th class="px-6 py-3 font-medium">Status</th></tr></thead>
                <tbody><tr v-for="(tx, index) in transactions" :key="tx.email" class="border-b border-gray-100 last:border-0 dark:border-gray-800"><td class="px-6 py-4"><div class="flex items-center gap-3"><UAvatar :text="tx.initials" size="sm" class="bg-gray-100 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300" /><div><p class="font-medium text-gray-800 dark:text-gray-100">{{ tx.name }}</p><p class="mt-0.5 text-[11px] text-gray-400">{{ tx.email }}</p></div></div></td><td class="px-4 py-4 text-gray-500">{{ tx.item }}</td><td class="px-4 py-4 text-gray-500">{{ tx.date }}</td><td class="px-4 py-4 font-medium">{{ tx.amount }}</td><td class="px-6 py-4"><UBadge :color="tx.status === 'Selesai' ? 'success' : 'warning'" variant="subtle" size="sm" class="rounded-full">{{ tx.status }}</UBadge></td></tr></tbody>
              </table>
            </div>
            <div class="px-6 py-4 text-[11px] text-gray-400">Menampilkan 4 transaksi contoh</div>
          </UCard>
        </section>
        <p class="mt-5 text-center text-[10px] text-gray-400">Data pada dashboard ini hanya contoh.</p>
      </div>

      <UModal v-model:open="configModalOpen" :title="selectedService">
        <template #body>
          <div class="space-y-3">
            <UAccordion
              v-model="connectionAccordion"
              :items="[{ label: 'Connection', value: 'connection', icon: 'i-lucide-plug-zap' }]"
              type="single"
              class="overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-800"
              :ui="{ item: 'border-0', trigger: 'cursor-pointer px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50', content: 'px-4', body: 'pb-4 pt-1' }"
            >
              <template #body>
                <UFormField label="Base URL" description="Alamat dasar API untuk layanan ini." class="w-full">
                  <UInput v-model="baseUrlDraft" type="url" placeholder="https://api.example.com" class="mt-2 w-full" />
                </UFormField>
              </template>
            </UAccordion>

            <UAccordion
              v-model="dangerZoneAccordion"
              :items="[{ label: 'Danger Zone', value: 'danger-zone', icon: 'i-lucide-triangle-alert' }]"
              type="single"
              class="overflow-hidden rounded-xl border border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/15"
              :ui="{ item: 'border-0', trigger: 'cursor-pointer px-4 py-3.5 text-sm font-semibold text-red-700 hover:bg-red-100/60 dark:text-red-300 dark:hover:bg-red-950/50', leadingIcon: 'text-red-600 dark:text-red-400', label: 'text-red-700 dark:text-red-300', content: 'px-4', body: 'pb-4 pt-1' }"
            >
              <template #body>
                <div class="space-y-3">
                  <p class="text-xs leading-5 text-red-800/80 dark:text-red-200/80">Pilih mode tampilan layanan. Perubahan ini hanya tersimpan sementara dan belum mengubah layanan.</p>
                  <fieldset class="space-y-2">
                    <legend class="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Service mode</legend>
                    <label
                      v-for="mode in serviceModeOptions"
                      :key="mode.value"
                      class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition"
                      :class="serviceModeDraft === mode.value ? 'border-red-300 bg-white ring-1 ring-red-300 dark:border-red-800 dark:bg-red-950/30 dark:ring-red-800' : 'border-gray-200 bg-white/80 hover:border-red-200 dark:border-red-900/50 dark:bg-[#151719]/70 dark:hover:border-red-800'"
                    >
                      <input v-model="serviceModeDraft" type="radio" name="service-mode" :value="mode.value" class="mt-0.5 size-4 shrink-0 accent-red-600" @change="shutdownConfirmed = false">
                      <span class="min-w-0 flex-1">
                        <span class="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                          <UIcon :name="mode.icon" class="size-4 text-red-600 dark:text-red-400" />
                          {{ mode.label }}
                        </span>
                        <span class="mt-1 block text-xs leading-5 text-gray-500 dark:text-gray-400">{{ mode.description }}</span>
                      </span>
                    </label>
                  </fieldset>
                  <label v-if="serviceModeDraft === 'shutdown'" class="flex cursor-pointer items-start gap-2.5 rounded-lg border border-red-300 bg-red-100/70 p-3 text-xs leading-5 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                    <input v-model="shutdownConfirmed" type="checkbox" class="mt-0.5 size-4 shrink-0 accent-red-600">
                    <span>Saya paham mode ini akan menandai layanan sebagai tidak aktif.</span>
                  </label>
                </div>
              </template>
            </UAccordion>
          </div>
        </template>
        <template #footer>
          <div class="flex w-full items-center justify-between gap-4">
            <p class="text-xs text-gray-400">Tersimpan sementara di halaman ini</p>
            <div class="flex shrink-0 items-center gap-2">
              <UButton label="Cancel" color="neutral" variant="ghost" @click="cancelConfig" />
              <UButton label="Save" :color="serviceModeDraft === 'shutdown' ? 'error' : 'success'" icon="i-lucide-check" :disabled="serviceModeDraft === 'shutdown' && !shutdownConfirmed" @click="saveConfig" />
            </div>
          </div>
        </template>
      </UModal>
    </main>
  </div>
</template>

<style scoped>
.submenu-enter-active,
.submenu-leave-active {
  overflow: hidden;
  transition: max-height 200ms ease, opacity 200ms ease, transform 200ms ease;
}

.submenu-enter-from,
.submenu-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.submenu-enter-to,
.submenu-leave-from {
  max-height: 12rem;
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .submenu-enter-active,
  .submenu-leave-active {
    transition-duration: 1ms;
  }
}
</style>
