/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ISSUE_SERVICE_URL: string
  readonly VITE_URL_BHLOGISTICS?: string
  readonly VITE_URL_PRSYSTEM?: string
  readonly VITE_URL_LMSCASA?: string
  readonly VITE_URL_XBLOOM?: string
  readonly VITE_URL_QSC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
