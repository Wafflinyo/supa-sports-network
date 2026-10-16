import React, { useEffect, useRef, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import './pwa.css'

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone

export default function PwaInstall() {
  const [installed, setInstalled] = useState(standalone)
  const [prompt, setPrompt] = useState(null)
  const [open, setOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [message, setMessage] = useState('')
  const dialog = useRef(null)
  const trigger = useRef(null)
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const macSafari = /Mac/.test(navigator.platform) && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent)

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const beforeInstall = event => { event.preventDefault(); setPrompt(event) }
    const appInstalled = () => { setInstalled(true); setPrompt(null); setOpen(false) }
    const modeChanged = () => setInstalled(standalone())
    const connection = () => setOnline(navigator.onLine)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', appInstalled)
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
    media.addEventListener('change', modeChanged)
    const register = () => {
      if (import.meta.env.PROD && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {scope: import.meta.env.BASE_URL, updateViaCache: 'none'}).catch(error => console.warn('App offline screen unavailable:', error))
      }
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, {once: true})
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', appInstalled)
      window.removeEventListener('online', connection)
      window.removeEventListener('offline', connection)
      window.removeEventListener('load', register)
      media.removeEventListener('change', modeChanged)
    }
  }, [])

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])

  async function install() {
    if (!prompt) return
    try {
      await prompt.prompt()
      const result = await prompt.userChoice
      setPrompt(null)
      if (result.outcome === 'accepted') setOpen(false)
      else setMessage('You can install later using your browser’s menu.')
    } catch {
      setPrompt(null)
      setMessage('Use the browser menu instructions below to install.')
    }
  }

  return <>
    {!online && <div className="pwa-connection" role="status">You’re offline. Reconnect for league updates and team changes.</div>}
    {!installed && <div className="pwa-install-bar container">
      <div><strong>SUPA SPORTS. ONE TAP AWAY.</strong><span>Add the league to your home screen or Dock.</span></div>
      <button ref={trigger} className="outline-btn" aria-haspopup="dialog" onClick={() => {setMessage('');setOpen(true)}}><Download size={16}/> INSTALL APP</button>
    </div>}
    <dialog ref={dialog} className="pwa-dialog" aria-labelledby="pwa-title" onClose={() => {setOpen(false);trigger.current?.focus()}} onClick={event => {if(event.target===dialog.current)setOpen(false)}}>
      <div className="pwa-dialog-heading"><img src={`${import.meta.env.BASE_URL}app/icon-192.png`} width="64" height="64" alt="SSL badge"/><button className="pwa-close" aria-label="Close installation help" onClick={() => setOpen(false)}><X size={22}/></button></div>
      <small className="eyebrow dark">YOUR LEAGUE. YOUR HOME SCREEN.</small><h2 id="pwa-title">SUPA SPORTS NETWORK</h2>
      <p>Open the league in its own app window, with the same scores, accounts, drafts and fantasy leagues.</p>
      {prompt && <button className="red-btn pwa-native-install" onClick={install}><Download size={17}/> INSTALL SUPA SPORTS</button>}
      {ios ? <section><h3>ON YOUR IPHONE OR IPAD</h3><ol><li>Open this website in <strong>Safari</strong>.</li><li>Tap <Share size={15} aria-hidden="true"/> <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li></ol></section> : macSafari ? <section><h3>ON YOUR MAC</h3><p>In Safari, choose <strong>File → Add to Dock</strong>, then choose <strong>Add</strong>.</p></section> : <section><h3>FROM YOUR BROWSER</h3><p>Use the install button above when available. You can also open your browser’s menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. On Mac Safari, choose <strong>File → Add to Dock</strong>.</p></section>}
      <p className="pwa-note">Internet is needed for league data, sign-in and team changes. You may need to sign in again when you first open the installed app.</p>
      {message && <p role="status">{message}</p>}
    </dialog>
  </>
}
