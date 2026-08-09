import { useStore } from '../../state/store'
import type { FxId, FxParams } from '../../state/types'
import { fmtHz, fmtPct, fmtSecs } from '../../utils/misc'

export const FX_META: { id: FxId; name: string; color: string }[] = [
  { id: 'filter', name: 'FILTER', color: '#3e9be0' },
  { id: 'dist', name: 'DRIVE', color: '#ee5a2c' },
  { id: 'crush', name: 'CRUSH', color: '#e85c4a' },
  { id: 'chorus', name: 'CHORUS', color: '#56be68' },
  { id: 'delay', name: 'DELAY', color: '#f5c543' },
  { id: 'reverb', name: 'SPACE', color: '#3e9be0' },
  { id: 'eq', name: 'EQ', color: '#56be68' },
]

function preview(fx: FxParams, id: FxId): [string, string][] {
  switch (id) {
    case 'filter':
      return [[fx.filter.type === 'lowpass' ? 'LP' : fx.filter.type === 'highpass' ? 'HP' : 'BP', fmtHz(fx.filter.cutoff)], ['RES', fx.filter.res.toFixed(1)]]
    case 'dist':
      return [['DRV', String(Math.round(fx.dist.drive))], ['MIX', fmtPct(fx.dist.mix)]]
    case 'crush':
      return [['BIT', String(Math.round(fx.crush.bits))], ['MIX', fmtPct(fx.crush.mix)]]
    case 'chorus':
      return [['RATE', `${fx.chorus.rate.toFixed(1)}Hz`], ['MIX', fmtPct(fx.chorus.mix)]]
    case 'delay':
      return [['TIME', fmtSecs(fx.delay.time)], ['MIX', fmtPct(fx.delay.mix)]]
    case 'reverb':
      return [['SIZE', fmtPct(fx.reverb.size)], ['MIX', fmtPct(fx.reverb.mix)]]
    case 'eq':
      return [['LO', `${fx.eq.low > 0 ? '+' : ''}${Math.round(fx.eq.low)}`], ['HI', `${fx.eq.high > 0 ? '+' : ''}${Math.round(fx.eq.high)}`]]
  }
}

export function FxView() {
  const fx = useStore((s) => s.patch.fx)
  const selected = useStore((s) => s.selectedFx)
  const setSelectedFx = useStore((s) => s.setSelectedFx)
  const mutatePatch = useStore((s) => s.mutatePatch)

  return (
    <>
      <div className="subtabs" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--ink-faint)', alignSelf: 'center' }}>
          SIGNAL PATH · SOUND → FILTER → DRIVE → CRUSH → CHORUS → DELAY → SPACE → EQ
        </span>
      </div>
      <div className="fx-grid">
        {FX_META.map((m) => {
          const on = fx[m.id].on
          return (
            <div
              key={m.id}
              className={`fx-card${selected === m.id ? ' selected' : ''}`}
              style={{ ['--fxc' as string]: m.color }}
              onClick={() => setSelectedFx(m.id)}
            >
              <div className="fx-card-head">
                <span className="nm">{m.name}</span>
                <button
                  className={`fx-led${on ? ' on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFx(m.id)
                    mutatePatch((p) => { p.fx[m.id].on = !p.fx[m.id].on }, true)
                  }}
                  title={on ? 'switch off' : 'switch on'}
                />
              </div>
              {preview(fx, m.id).map(([k, v]) => (
                <div className="pv" key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          )
        })}
        <div className="fx-card" style={{ cursor: 'default', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 8.5, color: 'var(--ink-faint)', letterSpacing: '0.12em', textAlign: 'center', lineHeight: 1.6 }}>
            SELECT A BLOCK —<br />THE FOUR KNOBS<br />SHAPE IT
          </span>
        </div>
      </div>
    </>
  )
}
