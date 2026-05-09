/**
 * Result Renderers
 * P6.3: Operational UX, Result Visibility & Real Task Outcomes
 *
 * Renders structured task outputs in human-readable format.
 */

import type { TaskOutput, TaskArtifact } from '../../services/api'

interface OutputRendererProps {
  output: TaskOutput
}

/**
 * Text output renderer
 */
function TextResult({ output }: OutputRendererProps) {
  return (
    <div style={{ marginBottom: '12px' }}>
      {output.label && (
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
          {output.label}
        </div>
      )}
      <div style={{
        padding: '12px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#0f172a',
        whiteSpace: 'pre-wrap'
      }}>
        {String(output.value)}
      </div>
    </div>
  )
}

/**
 * Link output renderer
 */
function LinkResult({ output }: OutputRendererProps) {
  const value = output.value as string | { url?: string; href?: string; title?: string }
  const url = typeof value === 'string' ? value : (value?.url || value?.href || '')
  const title = typeof value === 'object' ? value?.title : undefined

  return (
    <div style={{ marginBottom: '8px' }}>
      {output.label && (
        <span style={{ fontSize: '12px', color: '#64748b', marginRight: '8px' }}>
          {output.label}:
        </span>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#3b82f6',
          textDecoration: 'none',
          fontSize: '14px'
        }}
      >
        {title || url}
      </a>
    </div>
  )
}

/**
 * Table/list output renderer
 */
function TableResult({ output }: OutputRendererProps) {
  const items = output.value as unknown[]

  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  // Check if items are objects (table) or primitives (list)
  const isTable = typeof items[0] === 'object' && items[0] !== null

  if (isTable) {
    const keys = Object.keys(items[0] as Record<string, unknown>).slice(0, 5) // Max 5 columns

    return (
      <div style={{ marginBottom: '12px' }}>
        {output.label && (
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
            {output.label}
          </div>
        )}
        <div style={{
          overflow: 'auto',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                {keys.map(key => (
                  <th key={key} style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#475569',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 10).map((item, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 ? '#f8fafc' : 'white' }}>
                  {keys.map(key => (
                    <td key={key} style={{
                      padding: '8px 12px',
                      color: '#0f172a',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      {String((item as Record<string, unknown>)[key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length > 10 && (
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Mostrando 10 de {items.length} resultados
          </div>
        )}
      </div>
    )
  }

  // Simple list
  return (
    <div style={{ marginBottom: '12px' }}>
      {output.label && (
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
          {output.label}
        </div>
      )}
      <ul style={{
        margin: 0,
        padding: '0 0 0 20px',
        fontSize: '14px'
      }}>
        {items.slice(0, 20).map((item, idx) => (
          <li key={idx} style={{ marginBottom: '4px', color: '#0f172a' }}>
            {String(item)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * JSON output renderer
 */
function JsonResult({ output }: OutputRendererProps) {
  return (
    <div style={{ marginBottom: '12px' }}>
      {output.label && (
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
          {output.label}
        </div>
      )}
      <pre style={{
        margin: 0,
        padding: '12px',
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#e2e8f0',
        overflow: 'auto',
        maxHeight: '300px'
      }}>
        {JSON.stringify(output.value, null, 2)}
      </pre>
    </div>
  )
}

/**
 * Warning output renderer
 */
function WarningResult({ output }: OutputRendererProps) {
  const isError = output.label?.toLowerCase().includes('error')

  return (
    <div style={{
      marginBottom: '12px',
      padding: '12px',
      borderRadius: '8px',
      backgroundColor: isError ? '#fef2f2' : '#fef3c7',
      border: `1px solid ${isError ? '#fecaca' : '#fde68a'}`
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: output.label ? '4px' : 0
      }}>
        <span>{isError ? '!' : '!'}</span>
        {output.label && (
          <span style={{
            fontWeight: '600',
            color: isError ? '#dc2626' : '#d97706',
            fontSize: '13px'
          }}>
            {output.label}
          </span>
        )}
      </div>
      <div style={{
        color: isError ? '#991b1b' : '#92400e',
        fontSize: '14px'
      }}>
        {String(output.value)}
      </div>
    </div>
  )
}

/**
 * Code output renderer
 */
function CodeResult({ output }: OutputRendererProps) {
  return (
    <div style={{ marginBottom: '12px' }}>
      {output.label && (
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
          {output.label}
        </div>
      )}
      <pre style={{
        margin: 0,
        padding: '12px',
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#e2e8f0',
        overflow: 'auto',
        fontFamily: 'monospace'
      }}>
        {String(output.value)}
      </pre>
    </div>
  )
}

/**
 * Image output renderer
 */
function ImageResult({ output }: OutputRendererProps) {
  const src = typeof output.value === 'string'
    ? output.value
    : (output.value as { url?: string; src?: string })?.url || (output.value as { src?: string })?.src

  if (!src) return null

  return (
    <div style={{ marginBottom: '12px' }}>
      {output.label && (
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
          {output.label}
        </div>
      )}
      <img
        src={src}
        alt={output.label || 'Result image'}
        style={{
          maxWidth: '100%',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}
      />
    </div>
  )
}

/**
 * Main output renderer - dispatches to specific renderer based on type
 */
export function OutputRenderer({ output }: OutputRendererProps) {
  switch (output.type) {
    case 'text':
      return <TextResult output={output} />
    case 'link':
      return <LinkResult output={output} />
    case 'table':
    case 'list':
      return <TableResult output={output} />
    case 'json':
      return <JsonResult output={output} />
    case 'warning':
      return <WarningResult output={output} />
    case 'code':
      return <CodeResult output={output} />
    case 'image':
      return <ImageResult output={output} />
    default:
      // Fallback to text
      return <TextResult output={output} />
  }
}

/**
 * Render all outputs
 */
export function OutputsRenderer({ outputs }: { outputs: TaskOutput[] }) {
  if (!outputs || outputs.length === 0) {
    return (
      <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>
        Sin outputs
      </div>
    )
  }

  return (
    <div>
      {outputs.map((output, idx) => (
        <OutputRenderer key={idx} output={output} />
      ))}
    </div>
  )
}

/**
 * Artifact renderer
 */
export function ArtifactRenderer({ artifact }: { artifact: TaskArtifact }) {
  const getIcon = () => {
    switch (artifact.type) {
      case 'file': return '.'
      case 'download': return '.'
      case 'screenshot': return '.'
      case 'report': return '.'
      case 'url': return '.'
      case 'log': return '.'
      default: return '.'
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      marginBottom: '8px'
    }}>
      <span style={{ fontSize: '20px' }}>{getIcon()}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '500', color: '#0f172a', fontSize: '14px' }}>
          {artifact.name}
        </div>
        {artifact.path && (
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {artifact.path}
          </div>
        )}
      </div>
      {artifact.url && (
        <a
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '6px 12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '6px',
            fontSize: '12px',
            textDecoration: 'none'
          }}
        >
          {artifact.type === 'download' ? 'Descargar' : 'Ver'}
        </a>
      )}
    </div>
  )
}

/**
 * Render all artifacts
 */
export function ArtifactsRenderer({ artifacts }: { artifacts: TaskArtifact[] }) {
  if (!artifacts || artifacts.length === 0) {
    return (
      <div style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>
        Sin artifacts
      </div>
    )
  }

  return (
    <div>
      {artifacts.map((artifact, idx) => (
        <ArtifactRenderer key={idx} artifact={artifact} />
      ))}
    </div>
  )
}
