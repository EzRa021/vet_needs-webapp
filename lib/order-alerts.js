// Staff alerts for live orders: the chime, desktop notifications, and the
// per-browser preferences that switch them on and off.
//
// Browser-only. Every entry point checks for `window` so a stray server import
// is harmless rather than a crash.

const PREFS_KEY = 'vn-admin-order-alerts'
const ALERTED_PREFIX = 'vn-alerted:'
const ALERTED_TTL_MS = 6 * 60 * 60 * 1000

export const DEFAULT_ALERT_PREFS = {
  sound: true,
  desktop: true,
  onNewOrder: true,
  onPayment: true,
  onLowStock: true,
  volume: 0.7,
}

const isBrowser = () => typeof window !== 'undefined'

// ---------- Preferences (per browser, not per account) ----------
// localStorage can throw (private mode, blocked storage) — fall back to the
// defaults rather than breaking the dashboard over a convenience setting.
export function loadAlertPrefs() {
  if (!isBrowser()) return DEFAULT_ALERT_PREFS
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_ALERT_PREFS, ...JSON.parse(raw) } : DEFAULT_ALERT_PREFS
  } catch {
    return DEFAULT_ALERT_PREFS
  }
}

export function saveAlertPrefs(prefs) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* not persisted; still applies for this session */
  }
}

// ---------- Sound ----------
// Synthesised with Web Audio rather than shipped as a file: nothing to
// download, and it can't 404. Browsers start an AudioContext "suspended"
// until the page has had a click or key press, so unlockAudio() is wired to
// the first interaction and the chime simply waits for that.
let audioContext = null

function getAudioContext() {
  if (!isBrowser()) return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!audioContext) {
    try {
      audioContext = new Ctor()
    } catch {
      return null
    }
  }
  return audioContext
}

export function unlockAudio() {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

export const isAudioUnlocked = () => audioContext?.state === 'running'

// [frequency Hz, start offset s]. A new order is a two-note "ding-dong";
// a payment is a brighter rising arpeggio; a stock warning falls, lower and
// slower. Staff can tell the three apart without looking.
const CHIMES = {
  order: [
    [659.25, 0], // E5
    [880.0, 0.16], // A5
  ],
  payment: [
    [523.25, 0], // C5
    [659.25, 0.09], // E5
    [783.99, 0.18], // G5
    [1046.5, 0.27], // C6
  ],
  stock: [
    [587.33, 0], // D5
    [440.0, 0.22], // A4
    [440.0, 0.5], // A4 again: a warning, not a celebration
  ],
}

export function playChime(kind = 'order', volume = DEFAULT_ALERT_PREFS.volume) {
  const ctx = getAudioContext()
  if (!ctx) return false
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const start = ctx.currentTime + 0.03
  const master = ctx.createGain()
  master.gain.value = Math.min(Math.max(volume, 0), 1)
  master.connect(ctx.destination)

  for (const [freq, offset] of CHIMES[kind] || CHIMES.order) {
    const t = start + offset
    // A sine plus a quiet octave overtone reads as a bell rather than a beep.
    const tone = ctx.createOscillator()
    const overtone = ctx.createOscillator()
    tone.type = 'sine'
    overtone.type = 'sine'
    tone.frequency.value = freq
    overtone.frequency.value = freq * 2

    const envelope = ctx.createGain()
    const overtoneLevel = ctx.createGain()
    overtoneLevel.gain.value = 0.22
    envelope.gain.setValueAtTime(0.0001, t)
    envelope.gain.exponentialRampToValueAtTime(0.45, t + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)

    tone.connect(envelope)
    overtone.connect(overtoneLevel)
    overtoneLevel.connect(envelope)
    envelope.connect(master)

    tone.start(t)
    overtone.start(t)
    tone.stop(t + 1.2)
    overtone.stop(t + 1.2)
  }
  return ctx.state === 'running'
}

// ---------- Desktop notifications ----------
export const notificationsSupported = () => isBrowser() && 'Notification' in window

export const notificationPermission = () =>
  notificationsSupported() ? window.Notification.permission : 'unsupported'

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return await window.Notification.requestPermission()
  } catch {
    return window.Notification.permission
  }
}

// Desktop browsers take `new Notification()`. Chrome on Android refuses the
// constructor and only shows notifications through the service worker, which
// handles the click in public/sw.js — so try one, then the other.
export async function showDesktopNotification({ title, body, tag, url, onClick }) {
  if (notificationPermission() !== 'granted') return false
  const options = {
    body,
    tag,
    icon: '/icon-app.svg',
    badge: '/icon-app.svg',
    data: { url },
  }
  try {
    const n = new window.Notification(title, options)
    n.onclick = (event) => {
      event.preventDefault()
      window.focus()
      onClick?.()
      n.close()
    }
    return true
  } catch {
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) {
        await reg.showNotification(title, options)
        return true
      }
    } catch {
      /* fall through */
    }
    return false
  }
}

// ---------- One alert per event, however many tabs are open ----------
// Every open admin tab receives the same realtime event. Without this, three
// tabs means three chimes and three notifications for one order. The first tab
// to claim the event's key alerts; the rest stay quiet. Web Locks make the
// check-and-set atomic across tabs where supported.
const claimedHere = new Set()

function pruneAlerted() {
  try {
    const now = Date.now()
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith(ALERTED_PREFIX)) continue
      if (now - Number(window.localStorage.getItem(key)) > ALERTED_TTL_MS) {
        window.localStorage.removeItem(key)
      }
    }
  } catch {
    /* ignore */
  }
}

export async function claimAlert(key) {
  if (!isBrowser()) return false
  if (claimedHere.has(key)) return false

  const checkAndSet = () => {
    try {
      const storageKey = ALERTED_PREFIX + key
      if (window.localStorage.getItem(storageKey)) return false
      window.localStorage.setItem(storageKey, String(Date.now()))
      return true
    } catch {
      return true // no shared storage: better a duplicate chime than none
    }
  }

  let claimed
  if (navigator.locks?.request) {
    try {
      claimed = await navigator.locks.request('vn-order-alerts', checkAndSet)
    } catch {
      claimed = checkAndSet()
    }
  } else {
    claimed = checkAndSet()
  }

  if (claimed) {
    claimedHere.add(key)
    pruneAlerted()
  }
  return claimed
}
