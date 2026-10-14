<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'
import { timeshitHeatmapDays, timeshitHeatmapDayLabel, type TimeshitHeatmapDay } from '#shared/utils/timeshit-heatmap'
import { timeshitAuthoredDay } from '#shared/utils/timeshit-activity'
import { formatTimeshitDigest, timeshitDigestGroups } from '#shared/utils/timeshit-digest'
import type { TableColumn } from '@nuxt/ui'
import type { TimeshitCommits, TimeshitRepository } from '#shared/types/timeshit'

useSeoMeta({ title: 'Timeshit' })
const connection = useTimeshitStore()
const repos = useTimeshitRepositoriesStore()
const history = useTimeshitHistoryStore()
const activity = useTimeshitActivityStore()
const startDate = ref('')
const endDate = ref('')
const digestDay = ref('')
const startOpen = ref(false)
const endOpen = ref(false)
const digestOpen = ref(false)
const branchDraft = ref('development')
const branchSaved = ref(false)
watch(() => history.preferredBranch, (value) => {
  branchDraft.value = value
})
const startCalendar = computed<DateValue | undefined>({ get: () => startDate.value ? parseDate(startDate.value) : undefined, set: (value) => {
  startDate.value = value?.toString() ?? ''
  startOpen.value = false
} })
const endCalendar = computed<DateValue | undefined>({ get: () => endDate.value ? parseDate(endDate.value) : undefined, set: (value) => {
  endDate.value = value?.toString() ?? ''
  endOpen.value = false
} })
const digestCalendar = computed<DateValue | undefined>({ get: () => digestDay.value ? parseDate(digestDay.value) : undefined, set: (value) => {
  digestDay.value = value?.toString() ?? ''
  digestOpen.value = false
} })
const calendarMinimum = parseDate('1970-01-01')
const calendarMaximum = parseDate('2099-12-31')
const calendarLabel = (value: string) => value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : 'Select date'
async function saveHistoryPreference() {
  branchSaved.value = false
  await history.savePreference(branchDraft.value)
  branchSaved.value = !history.preferenceError
}

const digestPage = ref(1)
const heatmapPage = ref(1)
const heatmapDays = computed(() => activity.snapshot ? timeshitHeatmapDays(activity.snapshot) : [])
const heatmapRows = computed(() => heatmapDays.value.slice((heatmapPage.value - 1) * 14, heatmapPage.value * 14))
const heatmapColumns: TableColumn<TimeshitHeatmapDay>[] = [
  { accessorKey: 'date', header: 'Author date · Asia/Jakarta' },
  { accessorKey: 'observedCount', header: 'Commits' },
  { id: 'actions', header: 'Daily digest' }
]
function selectActivityDay(day: string) {
  digestDay.value = day
  const index = heatmapDays.value.findIndex(value => value.date === day)
  if (index >= 0) heatmapPage.value = Math.floor(index / 14) + 1
}
watch(digestDay, day => selectActivityDay(day))
watch(() => activity.snapshot?.collectionId, () => selectActivityDay(digestDay.value))
const copyNotice = ref('')
const copyFailed = ref(false)
const copying = ref(false)
const digestGroups = computed(() => {
  const result = activity.snapshot
  if (!result || !digestDay.value || digestDay.value < result.range.startDate || digestDay.value > result.range.endDate) return []
  return timeshitDigestGroups(result, digestDay.value)
})
const digestRows = computed(() => digestGroups.value.flatMap(repo => repo.commits.map(commit => ({ ...commit, repository: `${repo.owner}/${repo.name}`, repositoryId: repo.repositoryId }))))
const visibleDigest = computed(() => digestRows.value.slice((digestPage.value - 1) * 20, digestPage.value * 20))
watch([digestDay, () => activity.snapshot], () => {
  digestPage.value = 1
  copyNotice.value = ''
  const range = activity.snapshot?.range
  if (range && (digestDay.value < range.startDate || digestDay.value > range.endDate)) digestDay.value = range.endDate
})
async function collectActivity() {
  copyNotice.value = ''
  await activity.start({ startDate: startDate.value, endDate: endDate.value, timeZone: 'Asia/Jakarta' })
}
async function copyDigest(format: 'plain' | 'markdown') {
  if (!activity.snapshot || copying.value) return
  copying.value = true
  copyNotice.value = ''
  try {
    await navigator.clipboard.writeText(formatTimeshitDigest(activity.snapshot, digestDay.value, format, activity.stale))
    copyFailed.value = false
    copyNotice.value = `Digest copied as ${format === 'plain' ? 'plain text' : 'Markdown'}.`
  } catch {
    copyFailed.value = true
    copyNotice.value = 'Copy failed. Allow clipboard access and try again.'
  } finally {
    copying.value = false
  }
}
const search = ref('')
const filter = ref('all')
const trackedPage = ref(1)
const connected = computed(() => connection.connection?.state === 'connected')
watch(() => repos.tracked?.repositories.length ?? 0, (count) => {
  trackedPage.value = Math.min(trackedPage.value, Math.max(1, Math.ceil(count / 20)))
})
const selected = computed(() => new Set(repos.tracked?.repositories.map(repo => repo.id)))
const trackedRows = computed(() => (repos.tracked?.repositories ?? []).slice((trackedPage.value - 1) * 20, trackedPage.value * 20))
const discoveryRows = computed(() => (repos.discovery?.repositories ?? []).filter((repo) => {
  const matches = `${repo.owner}/${repo.name}`.toLowerCase().includes(search.value.toLowerCase())
  return matches && (filter.value === 'all' || (filter.value === 'private' ? repo.private : !repo.private))
}))
const columns: TableColumn<TimeshitRepository>[] = [
  { accessorKey: 'name', header: 'Repository' }, { accessorKey: 'private', header: 'Visibility' },
  { accessorKey: 'defaultBranch', header: 'Default branch' }, { accessorKey: 'access', header: 'Access' }, { id: 'actions', header: 'Actions' }
]
const visibilityOptions = [{ label: 'All visibility', value: 'all' }, { label: 'Private', value: 'private' }, { label: 'Public', value: 'public' }]
const commitColumns: TableColumn<TimeshitCommits['commits'][number]>[] = [
  { accessorKey: 'title', header: 'Commit' }, { accessorKey: 'sha', header: 'SHA' },
  { accessorKey: 'authoredAt', header: 'Authored' }, { id: 'actions', header: 'Changes' }
]
const fileItems = computed(() => history.detail?.files.map((file, index) => ({
  ...file,
  value: `${index}-${file.filename}`,
  label: `${file.filename} · ${file.status} · +${file.additions} / −${file.deletions}`
})) ?? [])
const accessLabel = (value: TimeshitRepository['access']) => value === 'readable' ? 'Contents readable' : value === 'unavailable' ? 'Unavailable' : 'Needs verification'
const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value))
async function refresh(page = 1) {
  search.value = ''
  trackedPage.value = 1
  await connection.load()
  if (connected.value) await repos.load(page)
  else repos.reset()
}
async function initialize() {
  await refresh()
  await history.loadPreferences()
  branchDraft.value = history.preferredBranch
}
onMounted(() => {
  startDate.value = endDate.value = digestDay.value = timeshitAuthoredDay(new Date().toISOString())
  activity.attachView()
  void initialize()
})
onBeforeUnmount(() => {
  activity.detachView()
  repos.reset()
  history.reset()
})
</script>

<template>
  <div class="w-full min-w-0 space-y-6 px-5 py-7 sm:px-8 sm:py-10 lg:px-10">
    <header class="flex flex-wrap items-end justify-between gap-4 border-b border-default pb-6">
      <div>
        <p class="mb-2 text-xs font-medium uppercase tracking-widest text-muted">
          GitHub / Repository management
        </p>
        <h1 class="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
          Timeshit
        </h1>
        <p class="mt-2 max-w-xl text-sm text-muted">
          Collect your daily activity across branches, copy a digest, and inspect file changes.
        </p>
      </div>
      <UButton
        to="/settings"
        icon="i-lucide-settings-2"
        color="neutral"
        variant="outline"
      >
        Connection settings
      </UButton>
    </header>
    <UAlert
      v-if="connection.error"
      color="neutral"
      variant="outline"
      title="Connection unavailable"
      :description="connection.error"
      :actions="[{ label: 'Retry', onClick: initialize }]"
    />
    <UCard v-else-if="!connected">
      <h2 class="text-lg font-semibold">
        {{ connection.loading ? 'Checking connection…' : 'Connect your GitHub account' }}
      </h2>
      <p class="mt-2 text-sm text-muted">
        Add a GitHub personal access token in Settings → Timeshit. Repository discovery uses the access granted to that token.
      </p>
      <UButton
        class="mt-5"
        to="/settings"
        color="neutral"
      >
        Open Settings
      </UButton>
    </UCard>
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm">
          Connected as <strong>{{ connection.connection?.account?.login }}</strong>
        </p>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :loading="repos.loading"
          :disabled="repos.busyId !== null"
          @click="refresh(repos.discovery?.page ?? 1)"
        >
          Refresh repositories
        </UButton>
      </div>
      <UAlert
        v-if="repos.error"
        color="neutral"
        variant="outline"
        icon="i-lucide-circle-alert"
        title="Repository request failed"
        :description="repos.error"
      />
      <UCard>
        <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              Activity collection
            </h2>
            <p class="mt-1 text-sm text-muted">
              Only tracked repositories are collected, across all their observed remote branches. Dates use Asia/Jakarta.
            </p>
          </div>
          <UBadge
            color="neutral"
            variant="outline"
          >
            {{ activity.phase }}
          </UBadge>
        </div>
        <form
          class="flex flex-wrap items-end gap-4"
          @submit.prevent="collectActivity"
        >
          <UFormField
            label="Start date"
            name="activity-start"
          >
            <UPopover v-model:open="startOpen">
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar-days"
                class="min-w-44 justify-start"
                :aria-label="`Start date: ${calendarLabel(startDate)}`"
                :disabled="activity.loading"
              >
                {{ calendarLabel(startDate) }}
              </UButton>
              <template #content>
                <UCalendar
                  v-model="startCalendar"
                  :min-value="calendarMinimum"
                  :max-value="endCalendar || calendarMaximum"
                  :disabled="activity.loading"
                  class="p-2"
                />
              </template>
            </UPopover>
          </UFormField>
          <UFormField
            label="End date"
            name="activity-end"
          >
            <UPopover v-model:open="endOpen">
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar-days"
                class="min-w-44 justify-start"
                :aria-label="`End date: ${calendarLabel(endDate)}`"
                :disabled="activity.loading"
              >
                {{ calendarLabel(endDate) }}
              </UButton>
              <template #content>
                <UCalendar
                  v-model="endCalendar"
                  :min-value="startCalendar || calendarMinimum"
                  :max-value="calendarMaximum"
                  :disabled="activity.loading"
                  class="p-2"
                />
              </template>
            </UPopover>
          </UFormField>
          <UButton
            type="submit"
            color="neutral"
            :loading="activity.loading"
            :disabled="repos.loading || !repos.tracked?.repositories.length || ['collecting', 'waiting'].includes(activity.phase)"
          >
            Collect activity
          </UButton>
          <UButton
            v-if="['collecting', 'waiting'].includes(activity.phase)"
            color="neutral"
            variant="outline"
            @click="activity.pause()"
          >
            Pause
          </UButton>
          <UButton
            v-else-if="activity.resumable"
            color="neutral"
            variant="outline"
            :disabled="activity.loading"
            @click="activity.resume()"
          >
            Resume collection
          </UButton>
        </form>
        <p class="mt-4 text-sm text-muted">
          Select at most 366 days. Each collection checks tracked repositories and pages the account's commits across their captured branch histories. The selected date range is applied to each commit's author timestamp locally, so a shorter range does not reduce GitHub history pages. Collection runs in sequential, rate-limited batches only while this page is visible and replaces the previous result.
        </p>
        <UAlert
          v-if="activity.error"
          class="mt-4"
          color="neutral"
          variant="outline"
          title="Collection needs attention"
          :description="activity.error"
        />
        <template v-if="activity.snapshot">
          <p
            class="mt-4 text-sm tabular-nums"
            role="status"
          >
            {{ activity.coverage.complete }} / {{ activity.coverage.total }} repositories complete · {{ activity.coverage.failed }} failed · {{ activity.coverage.branchesCompleted }} / {{ activity.coverage.branchesDiscovered }} discovered branches scanned
          </p>
          <p class="mt-2 text-xs text-muted">
            Range {{ activity.snapshot.range.startDate }} to {{ activity.snapshot.range.endDate }} · Asia/Jakarta · Updated {{ formatDate(activity.snapshot.updatedAt) }} · Expires {{ formatDate(activity.snapshot.expiresAt) }}
          </p>
          <UAlert
            v-if="activity.snapshot.status !== 'complete' || activity.stale"
            class="mt-4"
            color="neutral"
            variant="outline"
            :title="activity.stale ? 'Stale activity' : 'Partial activity'"
            :description="`Counts are observed only; missing activity is unknown. Collection reasons: ${activity.snapshot.partialReasons.join(', ') || 'none'}.`"
          />
          <ul class="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <li
              v-for="repo in activity.snapshot.coverage"
              :key="repo.repositoryId"
              class="flex flex-wrap justify-between gap-2 border-b border-default py-2"
            >
              <span class="break-all">{{ repo.owner }}/{{ repo.name }}</span>
              <span class="text-muted">{{ repo.status }}{{ repo.failure ? ` · ${repo.failure}` : '' }}</span>
            </li>
          </ul>
        </template>
        <p
          v-else
          class="mt-4 text-sm text-muted"
        >
          Track repositories below, then collect activity to create a daily digest.
        </p>
      </UCard>
      <UCard
        v-if="activity.snapshot"
        class="w-full min-w-0"
      >
        <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              Commit activity
            </h2>
            <p class="mt-1 text-sm text-muted">
              All observed remote branches · Asia/Jakarta · {{ activity.snapshot.range.startDate }} to {{ activity.snapshot.range.endDate }}
            </p>
          </div>
          <UBadge
            color="neutral"
            variant="outline"
          >
            {{ activity.stale ? 'Stale' : activity.snapshot.status === 'complete' ? 'Complete' : 'Partial · observed only' }}
          </UBadge>
        </div>
        <p class="mb-4 text-sm text-muted">
          Select a day to update the daily digest below. Counts may differ from GitHub’s contribution graph.
        </p>
        <ClientOnly>
          <TimeshitHeatmap
            :days="heatmapDays"
            :selected-day="digestDay"
            @select-day="selectActivityDay"
          />
          <template #fallback>
            <p class="py-6 text-sm text-muted">
              Loading chart. Daily counts are available in the table below.
            </p>
          </template>
        </ClientOnly>
        <ul
          class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs"
          aria-label="Commit count intensity legend"
        >
          <li
            v-for="(label, index) in ['0', '1', '2–4', '5–9', '≥10']"
            :key="label"
            class="flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              class="size-3 border border-neutral-600 dark:border-neutral-500"
              :class="['bg-neutral-50 dark:bg-neutral-900', 'bg-neutral-300 dark:bg-neutral-600', 'bg-neutral-400 dark:bg-neutral-500', 'bg-neutral-500 dark:bg-neutral-400', 'bg-neutral-900 dark:bg-neutral-100'][index]"
            />
            <span>{{ label }} commits</span>
          </li>
        </ul>
        <p class="mt-4 text-xs text-muted">
          Fixed intensity scale: 0 · 1 · 2–4 · 5–9 · ≥10 commits. {{ activity.snapshot.status === 'partial' ? 'Shades show observed activity; zero observed does not mean zero total.' : 'Zero means no matching commits in the completed scope.' }}
        </p>
        <div class="mt-6 border-t border-default pt-4">
          <h3 class="mb-3 text-sm font-semibold">
            Daily counts
          </h3>
          <UTable
            :data="heatmapRows"
            :columns="heatmapColumns"
            :ui="{ base: 'w-full min-w-[420px]' }"
          >
            <template #observedCount-cell="{ row }">
              <span class="tabular-nums">{{ row.original.observedCount.toLocaleString('en-US') }}</span>
              <span
                v-if="row.original.count === null"
                class="ml-2 text-xs text-muted"
              >observed · total unknown</span>
            </template>
            <template #actions-cell="{ row }">
              <UButton
                color="neutral"
                :variant="digestDay === row.original.date ? 'solid' : 'outline'"
                size="sm"
                :aria-pressed="digestDay === row.original.date"
                :aria-label="`View digest for ${timeshitHeatmapDayLabel(row.original)}`"
                @click="selectActivityDay(row.original.date)"
              >
                {{ digestDay === row.original.date ? 'Selected' : 'View digest' }}
              </UButton>
            </template>
          </UTable>
          <UPagination
            v-if="heatmapDays.length > 14"
            v-model:page="heatmapPage"
            class="mt-4"
            :total="heatmapDays.length"
            :items-per-page="14"
          />
        </div>
      </UCard>
      <UCard
        v-if="activity.snapshot"
        class="w-full min-w-0"
      >
        <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">
              Daily digest
            </h2>
            <p class="mt-1 text-sm text-muted">
              Original commit messages, grouped by repository and author date. Copy includes the complete selected day and coverage warnings.
            </p>
          </div>
          <UFormField
            label="Digest day"
            name="digest-day"
          >
            <UPopover v-model:open="digestOpen">
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar-days"
                class="min-w-44 justify-start"
                :aria-label="`Digest day: ${calendarLabel(digestDay)}`"
                :disabled="activity.loading"
              >
                {{ calendarLabel(digestDay) }}
              </UButton>
              <template #content>
                <UCalendar
                  v-model="digestCalendar"
                  :min-value="parseDate(activity.snapshot.range.startDate)"
                  :max-value="parseDate(activity.snapshot.range.endDate)"
                  :disabled="activity.loading"
                  class="p-2"
                />
              </template>
            </UPopover>
          </UFormField>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-copy"
            :disabled="copying || !digestGroups.length"
            @click="copyDigest('plain')"
          >
            Copy as plain text
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-copy"
            :disabled="copying || !digestGroups.length"
            @click="copyDigest('markdown')"
          >
            Copy as Markdown
          </UButton>
          <span class="text-sm text-muted">{{ digestRows.length }} {{ activity.snapshot.status === 'complete' ? 'commits' : 'observed commits · total unknown' }}</span>
        </div>
        <p
          v-if="copyNotice"
          class="mt-4 text-sm"
          :role="copyFailed ? 'alert' : 'status'"
        >
          {{ copyNotice }}
        </p>
        <p
          v-if="!digestRows.length"
          class="mt-6 text-sm text-muted"
        >
          {{ !digestGroups.length ? 'Choose a day within the collected range.' : activity.snapshot.status === 'complete' ? 'No commits on this day.' : 'No commits observed on this day. Complete or resume collection before treating this as zero activity.' }}
        </p>
        <ol class="mt-6 divide-y divide-default">
          <li
            v-for="commit in visibleDigest"
            :key="`${commit.repositoryId}:${commit.sha}`"
            class="py-4 first:pt-0"
          >
            <p class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span class="break-all font-medium">{{ commit.repository }}</span>
              <span>{{ formatDate(commit.authoredAt) }}</span>
              <UButton
                :to="commit.htmlUrl"
                target="_blank"
                color="neutral"
                variant="link"
                size="xs"
                class="cursor-pointer"
                :aria-label="`View commit ${commit.sha} on GitHub`"
              >
                {{ commit.sha.slice(0, 7) }}
              </UButton>
            </p>
            <p class="whitespace-pre-wrap break-words text-sm">
              {{ commit.message }}
            </p>
          </li>
        </ol>
        <UPagination
          v-if="digestRows.length > 20"
          v-model:page="digestPage"
          class="mt-4"
          :total="digestRows.length"
          :items-per-page="20"
        />
      </UCard>
      <UCard>
        <div class="mb-6 border-b border-default pb-6">
          <h2 class="text-lg font-semibold">
            History preference
          </h2>
          <p class="mt-1 text-sm text-muted">
            Default branch for Browse history across all repositories. Saved on this server; does not change the all-branch collection scope.
          </p>
          <form
            class="mt-4 flex flex-wrap items-end gap-3"
            @submit.prevent="saveHistoryPreference"
          >
            <UFormField
              label="Preferred branch"
              name="history-default-branch"
            >
              <UInput
                v-model="branchDraft"
                placeholder="development"
                :maxlength="255"
                required
                :disabled="history.preferenceLoading"
                @update:model-value="branchSaved = false"
              />
            </UFormField>
            <UButton
              type="submit"
              color="neutral"
              :loading="history.preferenceLoading"
            >
              Save preference
            </UButton>
            <UButton
              v-if="history.preferenceError"
              color="neutral"
              variant="outline"
              :disabled="history.preferenceLoading"
              @click="history.loadPreferences()"
            >
              Retry loading preference
            </UButton>
          </form>
          <p
            v-if="branchSaved"
            class="mt-3 text-sm"
            role="status"
          >
            History preference saved. It applies the next time you browse a repository.
          </p>
          <UAlert
            v-if="history.preferenceError"
            class="mt-4"
            color="neutral"
            variant="outline"
            title="History preference unavailable"
            :description="history.preferenceError"
          />
        </div>
        <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              Tracked repositories
            </h2>
            <p class="mt-1 text-sm text-muted">
              Selections are saved on this server. Recheck access after replacing your token.
            </p>
          </div>
          <UBadge
            color="neutral"
            variant="outline"
          >
            {{ repos.tracked?.repositories.length ?? 0 }} selected
          </UBadge>
        </div>
        <UTable
          :data="trackedRows"
          :columns="columns"
          :loading="repos.loading"
          empty="No tracked repositories. Choose one from discovery below."
          :ui="{ base: 'w-full min-w-[760px]' }"
        >
          <template #name-cell="{ row }">
            <span class="font-medium">{{ row.original.owner }}/{{ row.original.name }}</span>
            <UBadge
              v-if="row.original.archived"
              class="ml-2"
              color="neutral"
              variant="outline"
            >
              Archived
            </UBadge>
            <p
              v-if="row.original.description"
              class="mt-1 max-w-sm truncate text-xs text-muted"
            >
              {{ row.original.description }}
            </p>
          </template>
          <template #private-cell="{ row }">
            {{ row.original.private ? 'Private' : 'Public' }}
          </template>
          <template #defaultBranch-cell="{ row }">
            {{ row.original.defaultBranch ?? 'Not provided' }}
          </template>
          <template #access-cell="{ row }">
            <UBadge
              color="neutral"
              variant="outline"
              :icon="row.original.access === 'readable' ? 'i-lucide-check' : 'i-lucide-circle-alert'"
            >
              {{ accessLabel(row.original.access) }}
            </UBadge>
            <p
              v-if="row.original.checkedAt"
              class="mt-1 text-xs text-muted"
            >
              Last checked: {{ formatDate(row.original.checkedAt) }}
            </p>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex gap-2">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-git-branch"
                :loading="history.branchesLoading && history.repository?.id === row.original.id"
                :disabled="row.original.access !== 'readable' || repos.loading || repos.busyId !== null || history.branchesLoading || history.preferenceLoading || !!history.preferenceError"
                @click="history.selectRepository(row.original)"
              >
                Browse history
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                :loading="repos.busyId === row.original.id"
                :disabled="repos.loading || repos.busyId !== null"
                @click="repos.change(row.original.id, 'check')"
              >
                Recheck
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="repos.loading || repos.busyId !== null"
                @click="repos.change(row.original.id, 'remove')"
              >
                Untrack
              </UButton>
            </div>
          </template>
        </UTable>
        <UPagination
          v-if="(repos.tracked?.repositories.length ?? 0) > 20"
          v-model:page="trackedPage"
          class="mt-4"
          :items-per-page="20"
          :total="repos.tracked?.repositories.length ?? 0"
        />
        <p class="mt-4 text-xs leading-5 text-muted">
          Unavailable does not distinguish revoked access from deletion. Renamed repositories can be verified again through discovery; their GitHub ID stays the selection key. Only verified repositories will be eligible for future activity collection.
        </p>
      </UCard>
      <UAlert
        v-if="history.error"
        color="neutral"
        variant="outline"
        icon="i-lucide-circle-alert"
        title="History request failed"
        :description="history.error"
      />
      <UCard
        v-if="history.repository"
        class="w-full min-w-0"
      >
        <div class="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
          <div>
            <p class="text-xs font-medium uppercase tracking-widest text-muted">
              Commit history
            </p>
            <h2 class="mt-1 text-lg font-semibold">
              {{ history.repository.owner }}/{{ history.repository.name }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              Commits authored by {{ connection.connection?.account?.login }} on the selected branch.
            </p>
          </div>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-x"
            aria-label="Close repository history"
            @click="history.reset()"
          />
        </div>
        <UAlert
          v-if="history.branchNotice"
          class="mb-5"
          color="neutral"
          variant="outline"
          title="Branch selection"
          :description="history.branchNotice"
        />
        <div class="mb-5 flex flex-wrap items-end gap-3">
          <UFormField
            label="Branch"
            class="w-full sm:max-w-sm"
          >
            <USelect
              :model-value="history.selectedBranchName"
              :items="(history.branches?.branches ?? []).map(branch => ({ label: `${branch.name}${branch.protected ? ' · protected' : ''}`, value: branch.name }))"
              :disabled="history.branchesLoading || !history.branches?.branches.length"
              aria-label="Select branch"
              @update:model-value="history.selectBranch(String($event))"
            />
          </UFormField>
          <UButton
            v-if="history.branches?.hasNext"
            color="neutral"
            variant="outline"
            :loading="history.branchesLoading"
            @click="history.loadMoreBranches()"
          >
            Load more branches
          </UButton>
        </div>
        <p
          v-if="history.branchesLoading"
          class="py-4 text-sm text-muted"
          role="status"
        >
          Loading branches and commit history…
        </p>
        <UTable
          v-else
          :data="history.commits?.commits ?? []"
          :columns="commitColumns"
          :loading="history.commitsLoading"
          :empty="history.error && !history.commits ? 'Commit history could not be loaded. Retry by reopening this repository.' : !history.branches?.branches.length ? 'This repository has no available branches.' : 'No commits authored by this account were found on this branch.'"
          :ui="{ base: 'w-full min-w-[760px]' }"
        >
          <template #title-cell="{ row }">
            <p class="max-w-xl font-medium">
              {{ row.original.title || '(No commit message)' }}
            </p>
            <p
              v-if="row.original.authorName"
              class="mt-1 text-xs text-muted"
            >
              {{ row.original.authorName }}<template v-if="row.original.authorLogin">
                · @{{ row.original.authorLogin }}
              </template>
            </p>
          </template>
          <template #sha-cell="{ row }">
            <span class="font-mono text-xs">{{ row.original.sha.slice(0, 7) }}</span>
          </template>
          <template #authoredAt-cell="{ row }">
            {{ formatDate(row.original.authoredAt) }}
          </template>
          <template #actions-cell="{ row }">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              :loading="history.requestedCommitSha === row.original.sha"
              @click="history.selectCommit(row.original.sha)"
            >
              View changes
            </UButton>
          </template>
        </UTable>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
          <p class="text-xs text-muted">
            Page {{ history.commits?.page ?? 1 }} · 30 commits per page · Results are filtered by the connected GitHub account.
          </p>
          <UButton
            v-if="history.commits?.hasNext"
            color="neutral"
            variant="outline"
            :loading="history.commitsLoading"
            :disabled="history.detailLoading"
            @click="history.loadMoreCommits()"
          >
            Load more commits
          </UButton>
        </div>
      </UCard>
      <UCard v-if="history.detail || history.detailLoading">
        <div class="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
          <div>
            <p class="text-xs font-medium uppercase tracking-widest text-muted">
              Commit changes
            </p>
            <h2 class="mt-1 max-w-4xl whitespace-pre-wrap break-words text-lg font-semibold">
              {{ history.detail?.message ?? 'Loading commit details…' }}
            </h2>
            <p
              v-if="history.detail"
              class="mt-2 text-sm text-muted"
            >
              {{ history.detail.sha.slice(0, 7) }} · Authored {{ formatDate(history.detail.authoredAt) }} · Committed {{ formatDate(history.detail.committedAt) }}
            </p>
          </div>
          <div
            v-if="history.detail"
            class="flex items-center gap-2 text-sm tabular-nums"
          >
            <span>+{{ history.detail.stats.additions }}</span><span class="text-muted">/</span><span>−{{ history.detail.stats.deletions }}</span>
          </div>
        </div>
        <p
          v-if="history.detailLoading"
          class="py-3 text-sm text-muted"
          role="status"
        >
          Loading changed files…
        </p>
        <template v-if="history.detail">
          <p
            v-if="history.detail.files.length === 0"
            class="py-4 text-sm text-muted"
          >
            GitHub returned no changed-file entries for this commit.
          </p>
          <UAccordion
            v-else
            :items="fileItems"
            type="multiple"
            :ui="{ trigger: 'cursor-pointer', content: 'pb-4' }"
          >
            <template #content="{ item }">
              <div class="space-y-3 px-4 pb-2">
                <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                  <span>{{ item.changes }} changed lines · {{ item.additions }} additions · {{ item.deletions }} deletions</span>
                  <NuxtLink
                    v-if="item.blobUrl"
                    :to="item.blobUrl"
                    target="_blank"
                    rel="noreferrer"
                    class="underline underline-offset-4"
                  >
                    Open file on GitHub
                  </NuxtLink>
                </div>
                <p
                  v-if="item.patchTruncated"
                  class="text-xs text-muted"
                >
                  Patch preview is limited to 20,000 characters. Open the file on GitHub to view the full change.
                </p>
                <pre class="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words border border-default bg-elevated p-4 font-mono text-xs leading-5">{{ item.patch ?? 'GitHub did not include patch text for this file.' }}</pre>
              </div>
            </template>
          </UAccordion>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
            <p class="text-xs text-muted">
              Showing {{ history.detail.files.length }} changed files · Page {{ history.detail.filePage }} · Patch text may be unavailable for some files.
            </p>
            <UButton
              v-if="history.detail.hasNextFiles"
              color="neutral"
              variant="outline"
              :loading="history.detailLoading"
              @click="history.loadMoreFiles()"
            >
              Load more files
            </UButton>
          </div>
          <UAlert
            v-if="history.detail.filesTruncatedAtGitHubLimit"
            class="mt-4"
            color="neutral"
            variant="outline"
            title="GitHub file listing limit reached"
            description="GitHub limits commit detail responses to 3,000 changed files. Open the commit on GitHub to inspect the full change set."
            :actions="[{ label: 'Open commit on GitHub', to: history.detail.htmlUrl, target: '_blank' }]"
          />
        </template>
      </UCard>
      <UCard>
        <div class="mb-6 space-y-4">
          <div>
            <h2 class="text-lg font-semibold">
              Discover repositories
            </h2>
            <p class="mt-1 text-sm text-muted">
              Only repositories accessible to the connected PAT. Tracking checks repository identity and Contents access.
            </p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <UInput
              v-model="search"
              class="w-full sm:max-w-sm"
              icon="i-lucide-search"
              placeholder="Search this page"
              aria-label="Search repository names on this page"
            />
            <USelect
              v-model="filter"
              :items="visibilityOptions"
              class="w-full sm:w-44"
              aria-label="Filter visibility on this page"
            />
          </div>
        </div>
        <UTable
          :data="discoveryRows"
          :columns="columns"
          :loading="repos.loading"
          empty="No repositories on this page match your filters."
          :ui="{ base: 'w-full min-w-[760px]' }"
        >
          <template #name-cell="{ row }">
            <span class="font-medium">{{ row.original.owner }}/{{ row.original.name }}</span>
            <UBadge
              v-if="row.original.archived"
              class="ml-2"
              color="neutral"
              variant="outline"
            >
              Archived
            </UBadge>
            <p
              v-if="row.original.description"
              class="mt-1 max-w-sm truncate text-xs text-muted"
            >
              {{ row.original.description }}
            </p>
          </template>
          <template #private-cell="{ row }">
            {{ row.original.private ? 'Private' : 'Public' }}
          </template>
          <template #defaultBranch-cell="{ row }">
            {{ row.original.defaultBranch ?? 'Not provided' }}
          </template>
          <template #access-cell>
            Not checked
          </template>
          <template #actions-cell="{ row }">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              :loading="repos.busyId === row.original.id"
              :disabled="repos.loading || repos.busyId !== null"
              @click="repos.change(row.original.id, 'track')"
            >
              {{ selected.has(row.original.id) ? 'Verify selection' : 'Track repository' }}
            </UButton>
          </template>
        </UTable>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
          <p class="text-xs text-muted">
            Page {{ repos.discovery?.page ?? 1 }} · Up to 30 repositories · Search and filters apply to this page.
          </p>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="repos.loading || repos.busyId !== null || !repos.discovery || repos.discovery.page <= 1"
              @click="refresh((repos.discovery?.page ?? 1) - 1)"
            >
              Previous
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              :disabled="repos.loading || repos.busyId !== null || !repos.discovery?.hasNext"
              @click="refresh((repos.discovery?.page ?? 1) + 1)"
            >
              Next
            </UButton>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
