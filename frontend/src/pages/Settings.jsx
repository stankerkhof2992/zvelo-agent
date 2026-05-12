import { useEffect, useState } from 'react'
import { getSettings, saveSettings, exportData } from '../api'

const CRON_PRESETS = [
  { label: '08:00 dagelijks (standaard)', value: '0 8 * * *' },
  { label: '06:00 dagelijks', value: '0 6 * * *' },
  { label: '10:00 dagelijks', value: '0 10 * * *' },
  { label: 'Elke 12 uur', value: '0 */12 * * *' },
  { label: 'Alleen maandag 08:00', value: '0 8 * * 1' },
]

const NICHES = [
  'Minimalist Wall Art Printables', 'Digital Planner Inserts', 'Social Media Templates',
  'Wedding Invitation Suites', 'Budget Tracker Spreadsheets', 'Quote Prints & Typography',
  'Kids Room Decor Printables', 'Resume & CV Templates', 'Recipe Cards Printables', 'Logo Design Templates'
]

function KeyStatus({ configured }) {
  return configured
    ? <span className="text-xs text-green-600 font-medium">✅ Geconfigureerd</span>
    : <span className="text-xs text-yellow-600 font-medium">⚠️ Niet ingesteld (simulatiemodus)</span>
}

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    SMARTMOCKUPS_API_KEY: '',
    ETSY_CLIENT_ID: '',
    ETSY_CLIENT_SECRET: '',
    AGENT_CRON_SCHEDULE: '0 8 * * *',
    AGENT_CONCEPTS_PER_DAY: '3',
    DEFAULT_NICHE: NICHES[0],
    EMAIL_ENABLED: 'false',
    EMAIL_HOST: 'smtp.gmail.com',
    EMAIL_PORT: '587',
    EMAIL_USER: '',
    EMAIL_PASS: '',
    EMAIL_TO: '',
    BACKEND_URL: 'http://localhost:3001'
  })

  useEffect(() => {
    getSettings()
      .then(data => {
        setSettings(data)
        setForm(f => ({
          ...f,
          AGENT_CRON_SCHEDULE: data.preferences.AGENT_CRON_SCHEDULE || f.AGENT_CRON_SCHEDULE,
          AGENT_CONCEPTS_PER_DAY: data.preferences.AGENT_CONCEPTS_PER_DAY || f.AGENT_CONCEPTS_PER_DAY,
          DEFAULT_NICHE: data.preferences.DEFAULT_NICHE || f.DEFAULT_NICHE,
          EMAIL_ENABLED: data.preferences.EMAIL_ENABLED || f.EMAIL_ENABLED,
          EMAIL_TO: data.preferences.EMAIL_TO || f.EMAIL_TO,
          BACKEND_URL: data.preferences.BACKEND_URL || f.BACKEND_URL,
        }))
      })
      .catch(e => setError(typeof e === 'string' ? e : 'Laden mislukt'))
      .finally(() => setLoading(false))
  }, [])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const toSave = {}
      for (const [key, value] of Object.entries(form)) {
        if (value && value.trim() !== '') toSave[key] = value.trim()
      }
      await saveSettings(toSave)
      setSuccess('Instellingen opgeslagen! Herstart de backend server als je API keys hebt gewijzigd.')
      const refreshed = await getSettings()
      setSettings(refreshed)
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-48 text-zinc-400">Laden...</div>
  }

  const sim = settings?.simulation_mode || {}

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Instellingen</h1>
        <p className="text-zinc-500 mt-1">API keys, schema en notificaties</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

      {/* Simulatiemodus overzicht */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-zinc-800 mb-3">⚡ Simulatiemodus</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Claude (tekst)', key: 'claude' },
            { label: 'DALL-E (afbeeldingen)', key: 'dalle' },
            { label: 'Smartmockups (mockups)', key: 'mockups' },
            { label: 'Etsy (publiceren)', key: 'etsy' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg">
              <span className="text-zinc-600">{item.label}</span>
              {sim[item.key]
                ? <span className="text-xs text-yellow-600 font-medium">⚡ Simulatie</span>
                : <span className="text-xs text-green-600 font-medium">✅ Live</span>
              }
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400 mt-3">Vul API keys in hieronder om de simulatiemodus uit te schakelen. Herstart de server na het opslaan.</p>
      </div>

      {/* API Keys */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-zinc-800 mb-4">🔑 API Keys</h2>
        <div className="space-y-4">
          {[
            {
              key: 'ANTHROPIC_API_KEY', label: 'Anthropic Claude API Key',
              placeholder: 'sk-ant-api03-...',
              link: 'https://console.anthropic.com/settings/keys',
              configuredKey: 'ANTHROPIC_API_KEY'
            },
            {
              key: 'OPENAI_API_KEY', label: 'OpenAI API Key (DALL-E)',
              placeholder: 'sk-proj-...',
              link: 'https://platform.openai.com/api-keys',
              configuredKey: 'OPENAI_API_KEY'
            },
            {
              key: 'SMARTMOCKUPS_API_KEY', label: 'Smartmockups API Key',
              placeholder: 'sm_...',
              link: 'https://smartmockups.com/api',
              configuredKey: 'SMARTMOCKUPS_API_KEY'
            },
            {
              key: 'ETSY_CLIENT_ID', label: 'Etsy Client ID',
              placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
              link: 'https://www.etsy.com/developers/register',
              configuredKey: 'ETSY_CLIENT_ID'
            },
            {
              key: 'ETSY_CLIENT_SECRET', label: 'Etsy Client Secret',
              placeholder: '••••••••',
              configuredKey: 'ETSY_CLIENT_SECRET'
            },
          ].map(field => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">{field.label}</label>
                <KeyStatus configured={settings?.keys?.[field.configuredKey]?.configured} />
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  className="input"
                  placeholder={settings?.keys?.[field.configuredKey]?.masked || field.placeholder}
                  value={form[field.key]}
                  onChange={e => set(field.key, e.target.value)}
                  autoComplete="new-password"
                />
                {field.link && (
                  <a href={field.link} target="_blank" rel="noopener noreferrer" className="btn-secondary shrink-0 text-xs">
                    Aanvragen →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent instellingen */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-zinc-800 mb-4">🤖 Agent instellingen</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Dagelijks schema</label>
            <select className="input mb-2" value={form.AGENT_CRON_SCHEDULE} onChange={e => set('AGENT_CRON_SCHEDULE', e.target.value)}>
              {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <input
              className="input font-mono text-sm"
              value={form.AGENT_CRON_SCHEDULE}
              onChange={e => set('AGENT_CRON_SCHEDULE', e.target.value)}
              placeholder="0 8 * * *"
            />
            <p className="text-xs text-zinc-400 mt-1">Cron expressie (standaard: 0 8 * * * = elke dag om 08:00)</p>
          </div>
          <div>
            <label className="label">Concepten per dag</label>
            <input type="number" min={1} max={10} className="input" value={form.AGENT_CONCEPTS_PER_DAY} onChange={e => set('AGENT_CONCEPTS_PER_DAY', e.target.value)} />
          </div>
          <div>
            <label className="label">Standaard niche</label>
            <select className="input" value={form.DEFAULT_NICHE} onChange={e => set('DEFAULT_NICHE', e.target.value)}>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Backend URL (voor Smartmockups)</label>
            <input className="input" value={form.BACKEND_URL} onChange={e => set('BACKEND_URL', e.target.value)} placeholder="http://localhost:3001" />
            <p className="text-xs text-zinc-400 mt-1">Voor lokaal testen: gebruik ngrok om een publieke URL te krijgen</p>
          </div>
        </div>
      </div>

      {/* Email notificaties */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-zinc-800 mb-4">📧 Email notificaties</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="email_enabled" checked={form.EMAIL_ENABLED === 'true'} onChange={e => set('EMAIL_ENABLED', e.target.checked ? 'true' : 'false')} className="rounded" />
            <label htmlFor="email_enabled" className="text-sm text-zinc-700 cursor-pointer">Email notificaties inschakelen</label>
          </div>
          {form.EMAIL_ENABLED === 'true' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">SMTP Host</label>
                  <input className="input" value={form.EMAIL_HOST} onChange={e => set('EMAIL_HOST', e.target.value)} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className="label">SMTP Poort</label>
                  <input className="input" value={form.EMAIL_PORT} onChange={e => set('EMAIL_PORT', e.target.value)} placeholder="587" />
                </div>
              </div>
              <div>
                <label className="label">Gmail adres</label>
                <input className="input" type="email" value={form.EMAIL_USER} onChange={e => set('EMAIL_USER', e.target.value)} placeholder="jou@gmail.com" />
              </div>
              <div>
                <label className="label">App wachtwoord</label>
                <input className="input" type="password" value={form.EMAIL_PASS} onChange={e => set('EMAIL_PASS', e.target.value)} placeholder="Google App Password" />
                <p className="text-xs text-zinc-400 mt-1">Gebruik een <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline text-orange-500">Google App Password</a>, niet je normale wachtwoord</p>
              </div>
              <div>
                <label className="label">Notificaties sturen naar</label>
                <input className="input" type="email" value={form.EMAIL_TO} onChange={e => set('EMAIL_TO', e.target.value)} placeholder="jou@email.com" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Data */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-zinc-800 mb-3">💾 Data export</h2>
        <p className="text-sm text-zinc-500 mb-3">Exporteer alle concepten, shops en niche analyses als JSON bestand.</p>
        <button className="btn-secondary" onClick={exportData}>⬇️ Exporteer alle data (JSON)</button>
      </div>

      {/* Opslaan */}
      <div className="flex gap-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Opslaan...' : '💾 Instellingen opslaan'}
        </button>
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-700">
        ⚠️ Na het opslaan van API keys: herstart de backend server (<code>node server.js</code>) zodat de nieuwe keys worden geladen.
      </div>
    </div>
  )
}
