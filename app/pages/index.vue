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
    label: 'Penjualan',
    icon: 'i-lucide-shopping-bag',
    children: [
      { label: 'Transaksi', href: '#transaksi' }
    ]
  }
]

const expandedGroups = ref(new Set(['Dashboard', 'Penjualan']))
const activeMenu = ref('Ringkasan')

function toggleGroup(label: string) {
  if (expandedGroups.value.has(label)) expandedGroups.value.delete(label)
  else expandedGroups.value.add(label)
}

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
      <a href="#ringkasan" class="mb-10 flex items-center gap-3 px-2">
        <span class="grid size-9 place-items-center rounded-xl bg-emerald-500 text-white"><UIcon name="i-lucide-panels-top-left" class="size-5" /></span>
        <span class="text-[15px] font-semibold tracking-tight">ruang<span class="text-emerald-600">kerja</span></span>
      </a>
      <p class="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-gray-400">Menu</p>
      <nav aria-label="Menu utama" class="space-y-1">
        <div v-for="group in menuGroups" :key="group.label">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            :aria-expanded="expandedGroups.has(group.label)"
            :aria-controls="`menu-${group.label.toLowerCase()}`"
            @click="toggleGroup(group.label)"
          >
            <UIcon :name="group.icon" class="size-[18px]" />
            <span class="flex-1">{{ group.label }}</span>
            <UIcon name="i-lucide-chevron-down" class="size-4 text-gray-400 transition-transform" :class="expandedGroups.has(group.label) ? 'rotate-180' : ''" />
          </button>
          <div v-show="expandedGroups.has(group.label)" :id="`menu-${group.label.toLowerCase()}`" class="ml-5 space-y-0.5 border-l border-gray-200 pl-3 dark:border-gray-700">
            <a
              v-for="child in group.children"
              :key="child.label"
              :href="child.href"
              class="block rounded-md px-3 py-2 text-[13px] transition"
              :class="activeMenu === child.label ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'"
              @click="activeMenu = child.label"
            >
              {{ child.label }}
            </a>
          </div>
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
        <a href="#ringkasan" class="flex items-center gap-2.5 lg:hidden">
          <span class="grid size-8 place-items-center rounded-lg bg-emerald-500 text-white"><UIcon name="i-lucide-panels-top-left" class="size-4" /></span>
          <span class="text-sm font-semibold">ruang<span class="text-emerald-600">kerja</span></span>
        </a>
        <div class="hidden text-sm text-gray-500 lg:block">Workspace <span class="mx-2 text-gray-300">/</span><span class="font-medium text-gray-900 dark:text-white">Ringkasan</span></div>
        <div class="ml-auto flex items-center gap-2">
          <UIcon name="i-lucide-search" class="mx-2 size-[18px] text-gray-400" aria-hidden="true" />
          <UIcon name="i-lucide-bell" class="mx-2 size-[18px] text-gray-400" aria-hidden="true" />
          <UColorModeButton color="neutral" variant="ghost" />
          <UAvatar text="AR" size="xs" class="ml-1 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-white lg:hidden" />
        </div>
      </header>

      <div class="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
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
    </main>
  </div>
</template>
