// Synthetic GitHub responses for an isolated acceptance server; never use in production.
if (process.env.JCORE_TIMESHIT_ACCEPTANCE !== 'synthetic') throw new Error('Explicit synthetic acceptance mode required')
const realFetch = globalThis.fetch
const sha = 'a'.repeat(40)
const repo = { id: 123, owner: { login: 'example' }, name: 'acceptance', description: 'Synthetic acceptance repository', private: true, archived: false, default_branch: 'development' }
const accounts = new Map([
  ['test_only_synthetic_connection_alpha', { id: 701, login: 'acceptance-alpha', node_id: 'MDQ6VXNlcjcwMQ==' }],
  ['test_only_synthetic_connection_beta', { id: 702, login: 'acceptance-beta', node_id: 'MDQ6VXNlcjcwMg==' }]
])
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (url.origin !== 'https://api.github.com') return realFetch(input, init)
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  const account = accounts.get((headers.get('authorization') ?? '').replace(/^Bearer /i, ''))
  const json = (body, status = 200) => Response.json(body, { status })
  if (!account) return json({ message: 'Synthetic rejected token' }, 401)
  if (url.pathname === '/user') return json(account)
  if (url.pathname === '/user/repos') return json([repo])
  if (url.pathname === '/repos/example/acceptance') return json(repo)
  if (url.pathname === '/repos/example/acceptance/branches') return json([{ name: 'development', protected: false, commit: { sha } }])
  if (url.pathname === '/graphql') {
    const { variables } = JSON.parse(init.body)
    return json({ data: { repository: Object.fromEntries(Object.keys(variables).filter(key => /^sha\d+$/.test(key)).map((_, i) => [`h${i}`, { history: { nodes: [{ oid: sha, url: `https://github.com/example/acceptance/commit/${sha}`, message: 'Synthetic acceptance commit', authoredDate: '2026-10-13T03:00:00Z', committedDate: '2026-10-13T03:00:00Z', author: { name: 'Acceptance', user: { login: account.login } }, committer: { name: 'Acceptance' } }], pageInfo: { hasNextPage: false, endCursor: null } } }])) } })
  }
  return json({ message: 'Unsupported synthetic resource' }, 404)
}
