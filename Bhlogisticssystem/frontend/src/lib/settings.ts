export interface SystemSettings {
  systemName: string
  orderPrefix: string
  pickupPhotoCount: number
  dropoffPhotoCount: number
  driverRefreshSeconds: number
  requireSignature: boolean
  testMode: boolean
  logoDataUrl: string
}

export const SETTINGS_KEY = 'bhl_admin_settings'
export const SETTINGS_EVENT = 'bhl-settings-updated'

export const DEFAULT_SETTINGS: SystemSettings = {
  systemName: 'BH Logistics',
  orderPrefix: 'ORD',
  pickupPhotoCount: 3,
  dropoffPhotoCount: 2,
  driverRefreshSeconds: 30,
  requireSignature: true,
  testMode: false,
  logoDataUrl: '',
}

export function loadSettings(): SystemSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSystemSettings(settings: SystemSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event(SETTINGS_EVENT))
}

export function applyDocumentBranding(settings: SystemSettings) {
  document.title = settings.testMode ? `${settings.systemName} - Test` : settings.systemName

  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!icon) {
    icon = document.createElement('link')
    icon.rel = 'icon'
    document.head.appendChild(icon)
  }

  if (settings.logoDataUrl) {
    icon.href = settings.logoDataUrl
    icon.type = settings.logoDataUrl.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png'
  }
}
