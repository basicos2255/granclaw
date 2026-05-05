export function ConfigPage() {
  return (
    <div>
      <h1>Configuration</h1>
      <p>Configuration page - Coming soon</p>
      <h2>Environment</h2>
      <pre>
{JSON.stringify({
  apiBase: 'http://localhost:3001',
  webPort: 5173,
  env: 'development'
}, null, 2)}
      </pre>
    </div>
  )
}
