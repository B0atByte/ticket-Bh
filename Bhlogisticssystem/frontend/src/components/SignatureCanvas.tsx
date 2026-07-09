import { useRef, useEffect, useState } from 'react'
import { Trash2, PenLine } from 'lucide-react'

interface Props {
  onSave: (dataUrl: string) => void
  disabled?: boolean
}

export function SignatureCanvas({ onSave, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy }
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    if (disabled) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasSignature(true)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || disabled) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stop() {
    if (!isDrawing) return
    setIsDrawing(false)
    onSave(canvasRef.current!.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    onSave('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenLine size={14} className="text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">ลายเซ็นผู้รับ</span>
          <span className="text-red-500 text-sm">*</span>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasSignature}
          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 transition-colors"
        >
          <Trash2 size={12} />
          ล้าง
        </button>
      </div>

      <div className={`rounded-xl overflow-hidden border-2 ${hasSignature ? 'border-slate-300 dark:border-slate-600' : 'border-dashed border-slate-200 dark:border-slate-700'} bg-white touch-none`}>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-36 cursor-crosshair block"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={stop}
        />
      </div>

      {!hasSignature && (
        <p className="text-xs text-center text-slate-400 dark:text-slate-500">
          วาดลายเซ็นในกรอบด้านบน
        </p>
      )}
    </div>
  )
}
