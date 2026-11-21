import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUp, FileText, FileImage, Download, Copy, Check, X, LoaderCircle, FolderArchive, ShieldCheck, AlertCircle, Trash2, Sun, Moon, BookOpen, GraduationCap } from 'lucide-react'

type PickedFile = { id: string; file: File }
type Result = { name: string; pages: number; text_pages: number; ocr_pages: number; images: number; markdown: string; ocr_available: boolean }
type ApiResponse = { results: Result[]; errors: { name: string; error: string }[]; download_url: string }

const API = 'http://127.0.0.1:8000'
const AUDIO_ORIGIN = 'http://127.0.0.1:5001'
const HISTORY_ORIGIN = 'http://127.0.0.1:5174'
const QUIZ_ORIGIN = 'http://127.0.0.1:5175'

const translations = {
  vi: {
    siteTitle: 'Góc nhỏ của sekireiberry08',
    localOnly: 'Xử lý trên thiết bị',
    chooseFeature: 'Chọn tính năng',
    pdfTab: 'Trích xuất PDF',
    audioTab: 'Cắt audio',
    historyTab: 'Lịch sử Đảng',
    quizTab: 'Quiz MMT',
    themeLight: 'Chuyển sang giao diện sáng',
    themeDark: 'Chuyển sang giao diện tối',
    language: 'Ngôn ngữ',
    eyebrow: 'TIỆN ÍCH TÀI LIỆU',
    headline: 'Trích xuất dữ liệu',
    headlineEm: 'từ tài liệu PDF.',
    heroDescription: 'Tải lên tài liệu để trích xuất văn bản, hình ảnh và nhận dạng nội dung từ trang quét.',
    addDocs: 'Thêm tài liệu',
    fileLimit: 'PDF · Tối đa 150 MB / tệp',
    dropPdf: 'Kéo thả tệp PDF vào đây',
    or: 'hoặc',
    selectDevice: 'chọn tệp từ thiết bị',
    multipleFiles: 'Có thể chọn nhiều tệp cùng lúc',
    filesSelected: 'tệp đã chọn',
    removeFile: 'Xóa tệp',
    removeAll: 'Xóa tất cả',
    configure: 'Thiết lập trích xuất',
    defaultSettings: 'Mặc định',
    textOrder: 'Văn bản theo thứ tự trang',
    textDescription: 'Xuất nội dung thành Markdown',
    embeddedImages: 'Hình ảnh nhúng',
    imageDescription: 'Trích xuất ảnh và thêm liên kết vào tài liệu',
    scannedPdf: 'Nhận dạng trang quét',
    scanDescription: 'OCR các trang không có lớp văn bản',
    enabled: 'BẬT',
    extract: 'Trích xuất',
    pdf: 'PDF',
    processing: 'Đang xử lý…',
    loading: 'Đang tải tệp và phân tích PDF…',
    complete: 'Đã trích xuất xong.',
    extractionError: 'Không thể xử lý PDF.',
    unknownError: 'Đã xảy ra lỗi. Vui lòng kiểm tra backend.',
    clipboardError: 'Không thể sao chép. Hãy chọn nội dung trong phần xem trước.',
    results: 'Kết quả',
    done: 'Hoàn tất',
    totalPages: 'Tổng số trang',
    extractedImages: 'Ảnh đã trích xuất',
    ocrPages: 'Trang OCR',
    someFilesFailed: 'Một số tệp chưa xử lý được:',
    copyAll: 'Sao chép tất cả',
    copied: 'Đã sao chép',
    downloadZip: 'Tải ZIP',
    pages: 'trang',
    images: 'ảnh',
    zipReady: 'Tệp ZIP đã sẵn sàng.',
    zipDescription: 'Gồm document.md, thư mục images/, metadata.json cho từng PDF và README.',
    pdfFooter: 'Góc nhỏ của sekireiberry08 · Trích xuất PDF',
    footerNote: 'Xử lý cục bộ trên thiết bị',
    audioFrameTitle: 'Cắt audio từ video',
  },
  en: {
    siteTitle: 'Góc nhỏ của sekireiberry08',
    localOnly: 'Processed on this device',
    chooseFeature: 'Choose a feature',
    pdfTab: 'PDF extractor',
    audioTab: 'Audio cutter',
    historyTab: 'Party history',
    quizTab: 'Computer networks',
    themeLight: 'Switch to light mode',
    themeDark: 'Switch to dark mode',
    language: 'Language',
    eyebrow: 'DOCUMENT TOOLS',
    headline: 'Extract text and images',
    headlineEm: 'from PDF documents.',
    heroDescription: 'Upload documents to extract text and images, including text from scanned pages.',
    addDocs: 'Add documents',
    fileLimit: 'PDF · Up to 150 MB per file',
    dropPdf: 'Drop PDF files here',
    or: 'or',
    selectDevice: 'choose files from your device',
    multipleFiles: 'You can select multiple files',
    filesSelected: 'files selected',
    removeFile: 'Remove file',
    removeAll: 'Remove all',
    configure: 'Extraction settings',
    defaultSettings: 'Default',
    textOrder: 'Text in page order',
    textDescription: 'Export content as Markdown',
    embeddedImages: 'Embedded images',
    imageDescription: 'Extract images and link them in the document',
    scannedPdf: 'Scanned page recognition',
    scanDescription: 'OCR pages without a text layer',
    enabled: 'ON',
    extract: 'Extract',
    pdf: 'PDF',
    processing: 'Processing…',
    loading: 'Uploading files and analyzing PDFs…',
    complete: 'Extraction complete.',
    extractionError: 'Unable to process the PDF.',
    unknownError: 'An error occurred. Check that the backend is running.',
    clipboardError: 'Could not copy. Select the text in the preview to copy it.',
    results: 'Results',
    done: 'Complete',
    totalPages: 'Total pages',
    extractedImages: 'Images extracted',
    ocrPages: 'OCR pages',
    someFilesFailed: 'Some files could not be processed:',
    copyAll: 'Copy all',
    copied: 'Copied',
    downloadZip: 'Download ZIP',
    pages: 'pages',
    images: 'images',
    zipReady: 'ZIP file is ready.',
    zipDescription: 'Includes document.md, an images/ folder, metadata.json for each PDF, and a README.',
    pdfFooter: 'sekireiberry08’s little corner · PDF extractor',
    footerNote: 'Processed locally on this device',
    audioFrameTitle: 'Audio cutter',
  },
} as const

type Language = keyof typeof translations
type Theme = 'light' | 'dark'

export default function App() {
  const [activeFeature, setActiveFeature] = useState<'pdf' | 'audio' | 'history' | 'quiz'>('pdf')
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('app-language') === 'en' ? 'en' : 'vi')
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('app-theme') === 'dark' ? 'dark' : 'light')
  const [files, setFiles] = useState<PickedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [selected, setSelected] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const audioFrameRef = useRef<HTMLIFrameElement>(null)
  const historyFrameRef = useRef<HTMLIFrameElement>(null)
  const quizFrameRef = useRef<HTMLIFrameElement>(null)
  const audioLoadedRef = useRef(false)
  const historyLoadedRef = useRef(false)
  const quizLoadedRef = useRef(false)
  const text = translations[language]

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('app-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem('app-language', language)
    if (audioLoadedRef.current) audioFrameRef.current?.contentWindow?.postMessage({ type: 'app-preferences', theme, language }, AUDIO_ORIGIN)
    if (historyLoadedRef.current) historyFrameRef.current?.contentWindow?.postMessage({ type: 'app-preferences', theme, language }, HISTORY_ORIGIN)
    if (quizLoadedRef.current) quizFrameRef.current?.contentWindow?.postMessage({ type: 'app-preferences', theme, language }, QUIZ_ORIGIN)
  }, [language, theme])

  const syncAudioPreferences = () => {
    audioLoadedRef.current = true
    audioFrameRef.current?.contentWindow?.postMessage({ type: 'app-preferences', theme, language }, AUDIO_ORIGIN)
  }

  const syncHistoryPreferences = () => {
    historyLoadedRef.current = true
    historyFrameRef.current?.contentWindow?.postMessage({ type: 'app-preferences', theme, language }, HISTORY_ORIGIN)
  }

  const syncQuizPreferences = () => {
    quizLoadedRef.current = true
    quizFrameRef.current?.contentWindow?.postMessage({ type: 'app-preferences', theme, language }, QUIZ_ORIGIN)
  }

  useEffect(() => {
    const handleFrameMessage = (event: MessageEvent<{ type?: string; height?: number }>) => {
      const frame = event.source === historyFrameRef.current?.contentWindow && event.origin === HISTORY_ORIGIN
        ? historyFrameRef.current
        : event.source === quizFrameRef.current?.contentWindow && event.origin === QUIZ_ORIGIN
          ? quizFrameRef.current
          : null
      const height = event.data?.height
      if (frame && event.data?.type === 'app-resize' && typeof height === 'number' && Number.isFinite(height) && height > 0) {
        frame.style.height = `${Math.ceil(height)}px`
      }
    }

    window.addEventListener('message', handleFrameMessage)
    return () => window.removeEventListener('message', handleFrameMessage)
  }, [])

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter(file => file.name.toLowerCase().endsWith('.pdf'))
    setFiles(current => {
      const known = new Set(current.map(item => `${item.file.name}-${item.file.size}-${item.file.lastModified}`))
      const additions = pdfs.filter(file => !known.has(`${file.name}-${file.size}-${file.lastModified}`)).map(file => ({ id: crypto.randomUUID(), file }))
      return [...current, ...additions]
    })
    setResult(null)
    setError('')
  }, [])

  const extract = async () => {
    if (!files.length || busy) return
    setBusy(true); setError(''); setResult(null); setProgress(text.loading)
    try {
      const form = new FormData()
      files.forEach(item => form.append('files', item.file))
      const response = await fetch(`${API}/api/extract`, { method: 'POST', body: form })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : payload.detail?.message || text.extractionError)
      setResult(payload as ApiResponse); setSelected(0); setProgress(text.complete)
    } catch (e) {
      setError(e instanceof Error ? e.message : text.unknownError)
      setProgress('')
    } finally { setBusy(false) }
  }

  const copyText = async () => {
    if (!result) return
    const markdownText = result.results.map(item => item.markdown).join('\n\n---\n\n')
    try { await navigator.clipboard.writeText(markdownText); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    catch { setError(text.clipboardError) }
  }

  const downloadZip = () => { if (result) window.location.href = `${API}${result.download_url}` }
  const current = result?.results[selected]

  return <main className="shell" data-theme={theme}>
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-icon"><FileText size={19}/></span><span>{text.siteTitle}</span></a>
      <div className="header-actions">
        <div className="local-pill"><ShieldCheck size={14}/>{text.localOnly}</div>
        <button className="utility-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? text.themeDark : text.themeLight} title={theme === 'light' ? text.themeDark : text.themeLight}>
          {theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}
        </button>
        <button className="utility-button language-button" onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')} aria-label={text.language} title={text.language}>{language.toUpperCase()}</button>
      </div>
    </header>
    <nav className="feature-tabs" role="tablist" aria-label={text.chooseFeature}>
      <button id="pdf-tab" className={`feature-tab ${activeFeature === 'pdf' ? 'active' : ''}`} role="tab" aria-selected={activeFeature === 'pdf'} aria-controls="pdf-panel" onClick={() => setActiveFeature('pdf')}><FileText size={16}/> {text.pdfTab}</button>
      <button id="audio-tab" className={`feature-tab ${activeFeature === 'audio' ? 'active' : ''}`} role="tab" aria-selected={activeFeature === 'audio'} aria-controls="audio-panel" onClick={() => setActiveFeature('audio')}><FileImage size={16}/> {text.audioTab}</button>
      <button id="history-tab" className={`feature-tab ${activeFeature === 'history' ? 'active' : ''}`} role="tab" aria-selected={activeFeature === 'history'} aria-controls="history-panel" onClick={() => setActiveFeature('history')}><BookOpen size={16}/> {text.historyTab}</button>
      <button id="quiz-tab" className={`feature-tab ${activeFeature === 'quiz' ? 'active' : ''}`} role="tab" aria-selected={activeFeature === 'quiz'} aria-controls="quiz-panel" onClick={() => setActiveFeature('quiz')}><GraduationCap size={16}/> {text.quizTab}</button>
    </nav>
    <div id="pdf-panel" role="tabpanel" aria-labelledby="pdf-tab" hidden={activeFeature !== 'pdf'}>
    <section className="hero"><div className="eyebrow">{text.eyebrow}<span/></div><h1>{text.headline}<br/><em>{text.headlineEm}</em></h1><p>{text.heroDescription}</p></section>

    <section className="workspace">
      <div className="section-heading"><div><span className="step">01</span><h2>{text.addDocs}</h2></div><span className="muted">{text.fileLimit}</span></div>
      <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}/>
        <div className="upload-icon"><FileUp size={24}/></div><strong>{text.dropPdf}</strong><span>{text.or} <b>{text.selectDevice}</b></span><small>{text.multipleFiles}</small>
      </div>
      {files.length > 0 && <div className="file-list"><div className="list-title"><span>{files.length} {text.filesSelected}</span><button className="text-button" onClick={() => setFiles([])}><Trash2 size={14}/> {text.removeAll}</button></div>{files.map(item => <div className="file-row" key={item.id}><div className="pdf-icon">PDF</div><div className="file-meta"><strong>{item.file.name}</strong><span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span></div><button className="icon-button" aria-label={text.removeFile} onClick={() => setFiles(current => current.filter(f => f.id !== item.id))}><X size={16}/></button></div>)}</div>}

      <div className="section-heading options-heading"><div><span className="step">02</span><h2>{text.configure}</h2></div><span className="muted">{text.defaultSettings}</span></div>
      <div className="options"><div className="option"><span className="option-icon"><FileText size={17}/></span><div><strong>{text.textOrder}</strong><small>{text.textDescription}</small></div><span className="enabled">{text.enabled}</span></div><div className="option"><span className="option-icon"><FileImage size={17}/></span><div><strong>{text.embeddedImages}</strong><small>{text.imageDescription}</small></div><span className="enabled">{text.enabled}</span></div><div className="option"><span className="option-icon"><span className="ocr-mark">OCR</span></span><div><strong>{text.scannedPdf}</strong><small>{text.scanDescription}</small></div><span className="enabled">{text.enabled}</span></div></div>
      <button className="primary-button" disabled={!files.length || busy} onClick={extract}>{busy ? <><LoaderCircle className="spin" size={18}/> {text.processing}</> : <><FileUp size={18}/> {text.extract} {files.length ? `${files.length} ${text.pdf}` : text.pdf}</>}</button>
      {progress && <div className="status-line"><span className={busy ? 'pulse' : 'status-dot'}/>{progress}</div>}
      {error && <div className="error-box"><AlertCircle size={17}/>{error}</div>}
    </section>

    {result && <section className="results-section"><div className="section-heading"><div><span className="step">03</span><h2>{text.results}</h2></div><span className="success-label"><Check size={14}/> {text.done}</span></div>
      <div className="summary-grid"><div><strong>{result.results.reduce((n, r) => n + r.pages, 0)}</strong><span>{text.totalPages}</span></div><div><strong>{result.results.reduce((n, r) => n + r.images, 0)}</strong><span>{text.extractedImages}</span></div><div><strong>{result.results.reduce((n, r) => n + r.ocr_pages, 0)}</strong><span>{text.ocrPages}</span></div></div>
      {result.errors.length > 0 && <div className="warning-box">{text.someFilesFailed} {result.errors.map(e => `${e.name}: ${e.error}`).join(' · ')}</div>}
      <div className="preview-card"><div className="preview-header"><div className="tabs">{result.results.map((item, i) => <button key={item.name} className={selected === i ? 'tab active' : 'tab'} onClick={() => setSelected(i)}>{item.name}</button>)}</div><div className="preview-actions"><button className="secondary-button" onClick={copyText}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? text.copied : text.copyAll}</button><button className="download-button" onClick={downloadZip}><Download size={15}/> {text.downloadZip}</button></div></div>
        {current && <><div className="doc-stats"><span><FileText size={14}/>{current.pages} {text.pages}</span><span><FileImage size={14}/>{current.images} {text.images}</span><span>{current.ocr_pages} {text.ocrPages}</span></div><pre className="markdown-preview">{current.markdown}</pre></>}
      </div>
      <div className="export-note"><FolderArchive size={17}/><span><strong>{text.zipReady}</strong> {text.zipDescription}</span></div>
    </section>}
    <footer><span>{text.pdfFooter}</span><span>{text.footerNote}</span></footer>
    </div>
    <div id="audio-panel" className="audio-panel" role="tabpanel" aria-labelledby="audio-tab" hidden={activeFeature !== 'audio'}>
      <iframe ref={audioFrameRef} className="audio-frame" src={AUDIO_ORIGIN} title={text.audioFrameTitle} onLoad={syncAudioPreferences} />
    </div>
    <div id="history-panel" className="app-panel" role="tabpanel" aria-labelledby="history-tab" hidden={activeFeature !== 'history'}>
      <iframe ref={historyFrameRef} className="app-frame" src={HISTORY_ORIGIN} title={text.historyTab} onLoad={syncHistoryPreferences} />
    </div>
    <div id="quiz-panel" className="app-panel" role="tabpanel" aria-labelledby="quiz-tab" hidden={activeFeature !== 'quiz'}>
      <iframe ref={quizFrameRef} className="app-frame" src={QUIZ_ORIGIN} title={text.quizTab} onLoad={syncQuizPreferences} />
    </div>
  </main>
}
