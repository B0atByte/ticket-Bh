import { useState } from 'react'
import { Camera, X, Loader2, ImagePlus } from 'lucide-react'
import { api } from '../lib/api'

interface Props {
  count: number
  onComplete: (urls: string[]) => void
  label?: string
}

export function PhotoSlots({ count, onComplete, label = 'รูปภาพ' }: Props) {
  const [photos, setPhotos] = useState<(string | null)[]>(Array(count).fill(null))
  const [uploading, setUploading] = useState<number | null>(null)

  const filled = photos.filter(Boolean).length

  async function handleFile(index: number, file: File) {
    setUploading(index)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.upload<{ url: string }>('/uploads', form)
      const updated = [...photos]
      updated[index] = res.url
      setPhotos(updated)
      if (updated.every((p) => p !== null)) onComplete(updated as string[])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(null)
    }
  }

  function remove(index: number) {
    const updated = [...photos]
    updated[index] = null
    setPhotos(updated)
    onComplete([])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImagePlus size={14} className="text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
          <span className="text-red-500 text-sm">*</span>
        </div>
        <span className={`text-xs font-medium tabular-nums ${filled === count ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
          {filled}/{count}
        </span>
      </div>

      <div className={`grid gap-3 ${count === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {photos.map((photo, i) => (
          <div
            key={i}
            className="aspect-square relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            {photo ? (
              <>
                <img src={photo} alt={`photo-${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-slate-900/70 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <X size={11} />
                </button>
                <div className="absolute bottom-1.5 left-1.5 bg-slate-900/60 text-white text-xs px-1.5 py-0.5 rounded-md">
                  {i + 1}
                </div>
              </>
            ) : uploading === i ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                <Loader2 size={18} className="text-blue-600 animate-spin" />
                <span className="text-xs text-slate-400 dark:text-slate-500">กำลังอัปโหลด</span>
              </div>
            ) : (
              <label className="w-full h-full flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                <Camera size={18} className="text-slate-400 dark:text-slate-500" />
                <span className="text-xs text-slate-400 dark:text-slate-500">รูปที่ {i + 1}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(i, file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
