export function useTimeshitPageLifecycle(options: { onMount: () => void, onPreferredBranchLoaded: (branch: string) => void }) {
  const connection = useTimeshitStore()
  const repositories = useTimeshitRepositoriesStore()
  const history = useTimeshitHistoryStore()
  const activity = useTimeshitActivityStore()

  async function refreshRepositories(page = 1) {
    await connection.load()
    if (connection.connection?.state === 'connected') await repositories.load(page)
    else repositories.reset()
  }

  async function initialize() {
    await refreshRepositories()
    await history.loadPreferences()
    options.onPreferredBranchLoaded(history.preferredBranch)
  }

  onMounted(() => {
    options.onMount()
    activity.attachView()
    void initialize()
  })

  onBeforeUnmount(() => {
    activity.detachView()
    repositories.reset()
    history.reset()
  })

  return { initialize, refreshRepositories }
}
