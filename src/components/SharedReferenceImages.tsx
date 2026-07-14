import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { addImageFromFile, useStore } from '../store'

const MAX_REFERENCE_IMAGES = 16

export default function SharedReferenceImages() {
  const inputImages = useStore((state) => state.inputImages)
  const removeInputImage = useStore((state) => state.removeInputImage)
  const clearInputImages = useStore((state) => state.clearInputImages)
  const setLightboxImageId = useStore((state) => state.setLightboxImageId)
  const showToast = useStore((state) => state.showToast)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const addFiles = async (files: FileList | File[]) => {
    const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!images.length) {
      showToast('请选择图片文件', 'error')
      return
    }

    const currentCount = useStore.getState().inputImages.length
    const available = Math.max(0, MAX_REFERENCE_IMAGES - currentCount)
    if (!available) {
      showToast(`参考图已达到 ${MAX_REFERENCE_IMAGES} 张上限`, 'error')
      return
    }

    const selected = images.slice(0, available)
    setUploading(true)
    try {
      for (const file of selected) await addImageFromFile(file)
      const omitted = images.length - selected.length
      showToast(
        omitted > 0
          ? `已上传 ${selected.length} 张，另有 ${omitted} 张超过数量上限`
          : `已上传 ${selected.length} 张参考图`,
        'success',
      )
    } catch (error) {
      showToast(`参考图上传失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await addFiles(event.target.files ?? [])
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void addFiles(event.dataTransfer.files)
  }

  return (
    <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">商品参考图</div>
          <div className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            与底部生图栏共享同一组图片，用于商品事实分析、套图策划和最终生图。当前 {inputImages.length}/{MAX_REFERENCE_IMAGES} 张。
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={uploading || inputImages.length >= MAX_REFERENCE_IMAGES} onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-white/[0.08]">
            {uploading ? '上传中…' : '上传参考图'}
          </button>
          {inputImages.length > 0 ? (
            <button type="button" onClick={clearInputImages} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-400/20 dark:text-red-300 dark:hover:bg-red-400/10">清空</button>
          ) : null}
        </div>
      </div>

      <div onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
        className={`mt-3 min-h-24 rounded-xl border border-dashed p-3 transition ${dragging ? 'border-blue-400 bg-blue-50 dark:bg-blue-400/10' : 'border-gray-300 bg-gray-50 dark:border-white/[0.12] dark:bg-gray-950'}`}>
        {inputImages.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,72px)]">
            {inputImages.map((image, index) => (
              <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/[0.08]">
                <button type="button" className="h-full w-full" onClick={() => setLightboxImageId(image.id)} aria-label={`查看参考图 ${index + 1}`}>
                  <img src={image.dataUrl} alt={`参考图 ${index + 1}`} className="h-full w-full object-cover" />
                </button>
                <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">{index + 1}</span>
                <button type="button" onClick={() => removeInputImage(index)} aria-label={`删除参考图 ${index + 1}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white transition hover:bg-red-500">×</button>
              </div>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-16 w-full flex-col items-center justify-center text-center">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">点击选择或拖入产品参考图</span>
            <span className="mt-1 text-xs text-gray-400">支持多选；上传后会自动同步到底部生图栏</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleInput} />
    </div>
  )
}
