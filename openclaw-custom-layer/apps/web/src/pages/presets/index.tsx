import { useEffect, useState } from 'react'
import { api } from '../../services/api'

export function PresetsPage() {
  const [presets, setPresets] = useState<unknown[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getPresets().then((res) => {
      if (res.success && res.data) {
        setPresets(res.data)
      } else {
        setError(res.error || 'Failed to fetch presets')
      }
    })
  }, [])

  return (
    <div>
      <h1>Presets</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <pre>{JSON.stringify(presets, null, 2)}</pre>
      {presets.length === 0 && !error && <p>No presets found</p>}
    </div>
  )
}
