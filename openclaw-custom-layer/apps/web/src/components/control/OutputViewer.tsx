/**
 * OutputViewer Component
 * FEATURE 091: Render capability output (documents, editors, info)
 * FIX 101: UX Polish - hide internal paths, better actions, cleaner UI
 * FIX 111: Complete OS Tools UI Confirmation & Human Output
 */

import { useState } from 'react'
import { normalizeOutput, type NormalizedOutput } from '../../lib/output-normalizer'

// Legacy types for backward compatibility
interface DocumentOutput {
  type: 'document'
  title: string
  content: string
  format: 'markdown' | 'text' | 'html'
  editable?: boolean
  capabilityId?: string
  filePath?: string
  sandboxPath?: string
}

interface InfoOutput {
  type: 'info'
  title: string
  message: string
  description?: string
  capabilityId?: string
  sandboxPath?: string
}

export type CapabilityOutput = DocumentOutput | InfoOutput

interface OutputViewerProps {
  /** Legacy: structured output */
  output?: CapabilityOutput
  /** New: any raw response to normalize */
  rawResponse?: unknown
  capabilityName?: string
  /** FIX 111: Callbacks for OS tool confirmation */
  onConfirmAction?: (confirmationId: string, capabilityKey: string) => void
  onCancelAction?: () => void
}

// Extract filename from path
function getFilename(filePath?: string): string {
  if (!filePath) return 'documento.txt'
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || 'documento.txt'
}

/**
 * Render text output
 */
function TextOutput({ normalized }: { normalized: NormalizedOutput }) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    marginTop: '24px'
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    backgroundColor: '#f0fdf4',
    borderBottom: '1px solid #bbf7d0',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }

  const contentStyle: React.CSSProperties = {
    padding: '24px',
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#374151',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: '24px' }}>💬</span>
        <span style={{ fontSize: '16px', fontWeight: '600', color: '#166534' }}>
          {normalized.title || 'Respuesta'}
        </span>
      </div>
      <div style={contentStyle}>
        {normalized.content}
      </div>
      {normalized.isTechnicalRaw && (
        <AdvancedToggle
          showAdvanced={showAdvanced}
          onToggle={() => setShowAdvanced(!showAdvanced)}
          raw={normalized.raw}
        />
      )}
    </div>
  )
}

/**
 * Render action output (OS tool executed)
 */
function ActionOutput({ normalized }: { normalized: NormalizedOutput }) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    marginTop: '24px'
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    backgroundColor: '#eff6ff',
    borderBottom: '1px solid #bfdbfe',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }

  const contentStyle: React.CSSProperties = {
    padding: '24px',
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: '24px' }}>⚡</span>
        <span style={{ fontSize: '16px', fontWeight: '600', color: '#1e40af' }}>
          {normalized.title || 'Accion Ejecutada'}
        </span>
      </div>
      <div style={contentStyle}>
        <span style={{ fontSize: '20px' }}>✓</span>
        <span>{normalized.content}</span>
      </div>
      {normalized.isTechnicalRaw && (
        <AdvancedToggle
          showAdvanced={showAdvanced}
          onToggle={() => setShowAdvanced(!showAdvanced)}
          raw={normalized.raw}
        />
      )}
    </div>
  )
}

/**
 * Render confirmation required output
 */
function ConfirmationOutput({
  normalized,
  onConfirm,
  onCancel
}: {
  normalized: NormalizedOutput
  onConfirm?: (confirmationId: string, capabilityKey: string) => void
  onCancel?: () => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const confirmation = normalized.confirmation

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '2px solid #f59e0b',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
    overflow: 'hidden',
    marginTop: '24px'
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    backgroundColor: '#fffbeb',
    borderBottom: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }

  const contentStyle: React.CSSProperties = {
    padding: '24px'
  }

  const messageStyle: React.CSSProperties = {
    fontSize: '16px',
    lineHeight: '1.7',
    color: '#374151',
    marginBottom: '20px'
  }

  const riskBadgeStyle = (level?: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: level === 'high' ? '#fee2e2' : level === 'medium' ? '#fef3c7' : '#dcfce7',
    color: level === 'high' ? '#dc2626' : level === 'medium' ? '#d97706' : '#16a34a',
    marginBottom: '16px'
  })

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginTop: '16px'
  }

  const confirmBtnStyle: React.CSSProperties = {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#16a34a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }

  const cancelBtnStyle: React.CSSProperties = {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer'
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: '28px' }}>⚠️</span>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#b45309' }}>
          Confirmacion Requerida
        </span>
      </div>
      <div style={contentStyle}>
        {confirmation?.riskLevel && (
          <div style={riskBadgeStyle(confirmation.riskLevel)}>
            Riesgo: {confirmation.riskLevel === 'high' ? 'ALTO' : confirmation.riskLevel === 'medium' ? 'MEDIO' : 'BAJO'}
          </div>
        )}
        <div style={messageStyle}>
          {normalized.content}
        </div>
        {confirmation?.actionLabel && (
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            Accion: <strong>{confirmation.actionLabel}</strong>
          </div>
        )}
        <div style={actionsStyle}>
          <button
            style={confirmBtnStyle}
            onClick={() => {
              if (confirmation && onConfirm) {
                onConfirm(confirmation.confirmationId, confirmation.capabilityKey)
              }
            }}
          >
            ✓ Confirmar ejecucion
          </button>
          <button
            style={cancelBtnStyle}
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
      {normalized.isTechnicalRaw && (
        <AdvancedToggle
          showAdvanced={showAdvanced}
          onToggle={() => setShowAdvanced(!showAdvanced)}
          raw={normalized.raw}
        />
      )}
    </div>
  )
}

/**
 * Render document output
 */
function DocumentOutputView({ normalized, capabilityName }: { normalized: NormalizedOutput; capabilityName?: string }) {
  const [content, setContent] = useState(normalized.content)
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const filename = normalized.fileName || getFilename(normalized.filePath)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    marginTop: '24px'
  }

  const successBannerStyle: React.CSSProperties = {
    padding: '16px 24px',
    backgroundColor: '#ecfdf5',
    borderBottom: '1px solid #d1fae5',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #e5e7eb'
  }

  const headerTopStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px'
  }

  const titleBlockStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: 0
  }

  const filenameStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
    fontFamily: 'ui-monospace, monospace',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  }

  const actionBtnStyle = (variant: 'primary' | 'secondary'): React.CSSProperties => ({
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: '500',
    borderRadius: '8px',
    cursor: 'pointer',
    border: variant === 'secondary' ? '1px solid #d1d5db' : 'none',
    backgroundColor: variant === 'primary' ? '#2563eb' : 'white',
    color: variant === 'primary' ? 'white' : '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  })

  const contentAreaStyle: React.CSSProperties = {
    padding: '24px',
    minHeight: '200px',
    backgroundColor: 'white'
  }

  const preStyle: React.CSSProperties = {
    margin: 0,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#374151',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '300px',
    padding: '20px',
    fontSize: '14px',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    lineHeight: '1.7',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    resize: 'vertical',
    outline: 'none',
    backgroundColor: '#fafafa'
  }

  return (
    <div style={cardStyle}>
      <div style={successBannerStyle}>
        <span style={{ fontSize: '20px' }}>✓</span>
        <span style={{ fontSize: '14px', fontWeight: '500', color: '#065f46' }}>
          Documento creado correctamente
        </span>
      </div>

      <div style={headerStyle}>
        <div style={headerTopStyle}>
          <div style={titleBlockStyle}>
            <h3 style={titleStyle}>
              <span style={{ fontSize: '24px' }}>📄</span>
              {normalized.title || 'Documento generado'}
            </h3>
            <div style={filenameStyle}>
              <span>Nombre:</span>
              <strong>{filename}</strong>
            </div>
          </div>

          <div style={actionsStyle}>
            <button
              style={actionBtnStyle('secondary')}
              onClick={handleCopy}
            >
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
            <button
              style={actionBtnStyle('secondary')}
              onClick={handleDownload}
            >
              ⬇ Descargar
            </button>
            {normalized.editable && !isEditing && (
              <button
                style={actionBtnStyle('primary')}
                onClick={() => setIsEditing(true)}
              >
                ✏️ Editar
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={contentAreaStyle}>
        {isEditing ? (
          <div>
            <textarea
              style={textareaStyle}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                style={actionBtnStyle('secondary')}
                onClick={() => {
                  setContent(normalized.content)
                  setIsEditing(false)
                }}
              >
                Cancelar
              </button>
              <button
                style={actionBtnStyle('primary')}
                onClick={() => setIsEditing(false)}
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <pre style={preStyle}>{content}</pre>
        )}
      </div>

      {normalized.isTechnicalRaw && (
        <AdvancedToggle
          showAdvanced={showAdvanced}
          onToggle={() => setShowAdvanced(!showAdvanced)}
          raw={normalized.raw}
          extra={capabilityName ? { Capability: capabilityName } : undefined}
        />
      )}
    </div>
  )
}

/**
 * Render JSON/unknown output (technical data)
 */
function JsonOutput({ normalized }: { normalized: NormalizedOutput }) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    marginTop: '24px'
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }

  const contentStyle: React.CSSProperties = {
    padding: '24px',
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#6b7280',
    textAlign: 'center'
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: '24px' }}>📊</span>
        <span style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>
          Resultado
        </span>
      </div>
      <div style={contentStyle}>
        <p style={{ margin: 0, marginBottom: '16px' }}>
          {normalized.content || 'La ejecucion devolvio datos tecnicos.'}
        </p>
        <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>
          Puedes ver los datos completos en modo avanzado.
        </p>
      </div>
      <AdvancedToggle
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        raw={normalized.raw}
        forceShow
      />
    </div>
  )
}

/**
 * Advanced toggle for showing raw JSON
 */
function AdvancedToggle({
  showAdvanced,
  onToggle,
  raw,
  extra,
  forceShow
}: {
  showAdvanced: boolean
  onToggle: () => void
  raw: unknown
  extra?: Record<string, string>
  forceShow?: boolean
}) {
  const toggleStyle: React.CSSProperties = {
    padding: '12px 24px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
    fontSize: '12px',
    color: '#9ca3af',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    userSelect: 'none'
  }

  const detailsStyle: React.CSSProperties = {
    padding: '12px 24px',
    backgroundColor: '#f3f4f6',
    borderTop: '1px solid #e5e7eb',
    fontSize: '11px',
    color: '#6b7280',
    fontFamily: 'ui-monospace, monospace',
    maxHeight: '300px',
    overflow: 'auto'
  }

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '500',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer'
  }

  if (forceShow && !showAdvanced) {
    return (
      <div style={{ ...toggleStyle, justifyContent: 'center' }}>
        <button style={buttonStyle} onClick={onToggle}>
          Ver datos avanzados
        </button>
      </div>
    )
  }

  return (
    <>
      <div style={toggleStyle} onClick={onToggle}>
        <span style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
          ▶
        </span>
        {showAdvanced ? 'Ocultar detalles tecnicos' : 'Ver detalles tecnicos'}
      </div>

      {showAdvanced && (
        <div style={detailsStyle}>
          {extra && Object.entries(extra).map(([key, value]) => (
            <div key={key}>{key}: {value}</div>
          ))}
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}
    </>
  )
}

/**
 * Main OutputViewer component
 */
export function OutputViewer({
  output,
  rawResponse,
  capabilityName,
  onConfirmAction,
  onCancelAction
}: OutputViewerProps) {
  // Determine what to normalize
  const dataToNormalize = rawResponse !== undefined ? rawResponse : output

  // Normalize the response
  const normalized = normalizeOutput(dataToNormalize)

  // Render based on type
  switch (normalized.type) {
    case 'text':
      return <TextOutput normalized={normalized} />

    case 'action':
      return <ActionOutput normalized={normalized} />

    case 'confirmation_required':
      return (
        <ConfirmationOutput
          normalized={normalized}
          onConfirm={onConfirmAction}
          onCancel={onCancelAction}
        />
      )

    case 'document':
      return <DocumentOutputView normalized={normalized} capabilityName={capabilityName} />

    case 'json':
    case 'unknown':
      return <JsonOutput normalized={normalized} />

    case 'empty':
      return null

    default:
      return <TextOutput normalized={normalized} />
  }
}
