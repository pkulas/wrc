import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'

function App() {
  // State for Wind Rhytm calculator
  const [wrCooldown, setWrCooldown] = useState<number>(0.5) // seconds
  const [wrBonus, setWrBonus] = useState<number>(40) // percent 40..100
  const [cdr, setCdr] = useState<number>(0) // percent 0+
  const [castSpeed, setCastSpeed] = useState<number>(0) // percent 0+
  const [additionalCastSpeed, setAdditionalCastSpeed] = useState<number>(0) // percent 0+

  // Load initial values from URL query params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    const wr = params.get('cooldown')
    const wrNum = wr !== null ? Number(wr) : null
    if (wrNum !== null && [0.5, 0.6, 0.7, 0.8].includes(wrNum)) {
      setWrCooldown(wrNum)
    }

    const wrb = params.get('wrBonus')
    const wrbNum = wrb !== null ? Number(wrb) : null
    if (wrbNum !== null && !Number.isNaN(wrbNum)) {
      setWrBonus(Math.max(0, Math.min(100, Math.floor(wrbNum))))
    }

    const cdrParam = params.get('cdr')
    const cdrNum = cdrParam !== null ? Number(cdrParam) : null
    if (cdrNum !== null && !Number.isNaN(cdrNum)) {
      setCdr(Math.max(0, Math.min(999, cdrNum)))
    }

    const cs = params.get('castSpeed')
    const csNum = cs !== null ? Number(cs) : null
    if (csNum !== null && !Number.isNaN(csNum)) {
      setCastSpeed(Math.max(0, Math.min(999, csNum)))
    }

    const acs = params.get('additionalCastSpeed')
    const acsNum = acs !== null ? Number(acs) : null
    if (acsNum !== null && !Number.isNaN(acsNum)) {
      setAdditionalCastSpeed(Math.max(0, Math.min(999, acsNum)))
    }
  }, [])

  // Reflect current values into the URL (preserve hash) whenever they change
  // Skip the first run to avoid overwriting query params on initial load
  const didSkipFirstSyncRef = useRef<boolean>(false)
  useEffect(() => {
    if (!didSkipFirstSyncRef.current) {
      didSkipFirstSyncRef.current = true
      return
    }

    const params = new URLSearchParams()
    params.set('cooldown', String(wrCooldown))
    params.set('wrBonus', String(wrBonus))
    params.set('cdr', String(cdr))
    params.set('castSpeed', String(castSpeed))
    params.set('additionalCastSpeed', String(additionalCastSpeed))

    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`
    window.history.replaceState(null, '', newUrl)
  }, [wrCooldown, wrBonus, cdr, castSpeed, additionalCastSpeed])

  const wrCastRate = useMemo(() => {
    const wrPct = Math.max(0, Math.min(100, wrBonus)) / 100 // clamp 0..100
    const cdrPct = Math.max(0, cdr) / 100
    const finalCsPct = Math.round(castSpeed * (1 + additionalCastSpeed / 100)) / 100 // final cast speed = cast speed % * (1 + additional cast speed), rounded to full numbers
    const denom = (1 + (wrPct * finalCsPct)) * (1 + cdrPct)
    if (denom === 0) return Infinity
    return wrCooldown / denom
  }, [wrCooldown, wrBonus, cdr, castSpeed, additionalCastSpeed])

  // Server tick rate support (30 ticks per second)
  const tickHz = 30
  const tickSeconds = 1 / tickHz
  const wrCastRateLimited = useMemo(() => {
    if (!Number.isFinite(wrCastRate)) return Infinity
    // Limited by tick rate: snap up to the next tick (ceil) so the action cannot complete faster than a tick boundary
    return Math.ceil(wrCastRate / tickSeconds) * tickSeconds
  }, [wrCastRate])

  // Helper to compute raw and limited times for given inputs
  const computeTimes = (
    cooldown: number,
    bonusPct: number,
    cdrPctVal: number,
    castSpeedPctVal: number,
    additionalCastSpeedPctVal: number = additionalCastSpeed
  ) => {
    const wrPct = Math.max(0, Math.min(100, bonusPct)) / 100
    const cdrPct = Math.max(0, cdrPctVal) / 100
    const finalCsPct = Math.round(castSpeedPctVal * (1 + additionalCastSpeedPctVal / 100)) / 100 // final cast speed = cast speed % * (1 + additional cast speed), rounded to full numbers
    const denom = (1 + (wrPct * finalCsPct)) * (1 + cdrPct)
    const raw = denom === 0 ? Infinity : cooldown / denom
    const limited = !Number.isFinite(raw) ? Infinity : Math.ceil(raw / tickSeconds) * tickSeconds
    return { raw, limited }
  }

  // Generate next breakpoints for a single parameter by scanning future values
  function genBreakpoints(
    which: 'wrBonus' | 'cdr' | 'castSpeed',
    startExclusive: number,
    endInclusive: number
  ) {
    const currentLimited = wrCastRateLimited
    if (!Number.isFinite(currentLimited)) return [] as { value: number; raw: number; limited: number }[]

    const rows: { value: number; raw: number; limited: number }[] = []
    let bestLimited = currentLimited

    for (let v = Math.floor(startExclusive) + 1; v <= endInclusive; v++) {
      const { raw, limited } = computeTimes(
        wrCooldown,
        which === 'wrBonus' ? v : wrBonus,
        which === 'cdr' ? v : cdr,
        which === 'castSpeed' ? v : castSpeed
      )

      // Only record the first value that achieves a strictly better limited time
      if (limited < bestLimited) {
        rows.push({ value: v, raw, limited })
        bestLimited = limited
        // Stop if we hit the theoretical floor (one tick)
        if (bestLimited <= tickSeconds) break
      }
    }

    return rows
  }

  const bpWrBonus = useMemo(() => genBreakpoints('wrBonus', wrBonus, 100), [wrBonus, wrCooldown, cdr, castSpeed, additionalCastSpeed, wrCastRateLimited])
  // Limit CDR table to max 100%
  const bpCdr = useMemo(() => genBreakpoints('cdr', cdr, 100), [wrBonus, wrCooldown, cdr, castSpeed, additionalCastSpeed, wrCastRateLimited])
  // Limit Cast Speed table to max 300%
  const bpCastSpeed = useMemo(() => genBreakpoints('castSpeed', castSpeed, 300), [wrBonus, wrCooldown, cdr, castSpeed, additionalCastSpeed, wrCastRateLimited])

  return (
    <main className="container">
      {/* Wind Rhytm Calculator Only */}
      <div className="section" id="calculator">
        <h5>Wind Rhytm Cast Rate Calculator</h5>
        <div className="inputs-container">
          {/* Wind Rhytm Cooldown */}
          <div className="input-row">
            <label>Wind Rhytm Cooldown (seconds):</label>
            <select
              className="input-control"
              value={wrCooldown}
              onChange={(e) => setWrCooldown(parseFloat(e.target.value))}
            >
              <option value={0.5}>0.5</option>
              <option value={0.6}>0.6</option>
              <option value={0.7}>0.7</option>
              <option value={0.8}>0.8</option>
            </select>
          </div>

          {/* Wind Rhytm bonus */}
          <div className="input-row">
            <label>Wind Rhytm bonus (%):</label>
            <input
              className="input-control"
              type="number"
              min={40}
              max={100}
              step={1}
              value={wrBonus}
              onChange={(e) => {
                const v = e.target.value === '' ? 0 : Number(e.target.value)
                setWrBonus(Math.max(0, Math.min(100, Math.floor(v))))
              }}
            />
          </div>

          {/* Cooldown Rate */}
          <div className="input-row">
            <label>Cooldown Rate (%):</label>
            <input
              className="input-control"
              type="number"
              min={0}
              max={999}
              step={0.01}
              value={cdr}
              onChange={(e) => {
                const v = e.target.value === '' ? 0 : Number(e.target.value)
                setCdr(Math.max(0, Math.min(999, v)))
              }}
            />
          </div>

          {/* Cast speed bonus */}
          <div className="input-row">
            <label>Cast speed bonus (%):</label>
            <input
              className="input-control"
              type="number"
              min={0}
              max={999}
              step={0.01}
              value={castSpeed}
              onChange={(e) => {
                const v = e.target.value === '' ? 0 : Number(e.target.value)
                setCastSpeed(Math.max(0, Math.min(999, v)))
              }}
            />
          </div>

          {/* Additional Cast speed bonus */}
          <div className="input-row">
            <label>Additional cast speed bonus (%):</label>
            <input
              className="input-control"
              type="number"
              min={0}
              max={999}
              step={0.01}
              value={additionalCastSpeed}
              onChange={(e) => {
                const v = e.target.value === '' ? 0 : Number(e.target.value)
                setAdditionalCastSpeed(Math.max(0, Math.min(999, v)))
              }}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <span className="card-title">Your current wind rhytm cast rate:</span>
            <p>
              {Number.isFinite(wrCastRate) && Number.isFinite(wrCastRateLimited)
                ? `${wrCastRateLimited.toFixed(5)} s (${wrCastRate.toFixed(5)} s)`
                : '—'}
            </p>
            <p className="grey-text">
              Cast Speed: {castSpeed}% (base) → {Math.round(castSpeed * (1 + additionalCastSpeed / 100))}% (final)
            </p>
            <p className="grey-text">
              based on calc: {wrCooldown} / (1 + ({wrBonus}% × {Math.round(castSpeed * (1 + additionalCastSpeed / 100))}%)) / (1 + {cdr}%)
            </p>
            <p className="grey-text">
              Tick rate: {tickHz} Hz (tick = {tickSeconds.toFixed(5)} s). Value is limited up to the next tick.
            </p>
          </div>
        </div>

        {/* Next Breakpoints */}
        <div className="section" id="breakpoints">
          <h6>Your next breakpoints:</h6>

          {/* Wind Rhytm bonus table */}
          {bpWrBonus.length > 0 && (
            <div className="card">
              <div className="card-content">
                <span className="card-title">Breakpoints for Wind Rhytm bonus (%)</span>
                <table className="striped">
                  <thead>
                    <tr>
                      <th>Bonus %</th>
                      <th>Server cast time (s)</th>
                      <th>Raw cast time (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bpWrBonus.map((r) => (
                      <tr key={`wrb-${r.value}`}>
                        <td>{r.value}</td>
                        <td>{r.limited.toFixed(5)}</td>
                        <td>{Number.isFinite(r.raw) ? r.raw.toFixed(5) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cooldown Rate table (limited to 100) */}
          {bpCdr.length > 0 && (
            <div className="card">
              <div className="card-content">
                <span className="card-title">Breakpoints for Cooldown Rate (%)</span>
                <table className="striped">
                  <thead>
                    <tr>
                      <th>CDR %</th>
                      <th>Server cast time (s)</th>
                      <th>Raw cast time (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bpCdr.map((r) => (
                      <tr key={`cdr-${r.value}`}>
                        <td>{r.value}</td>
                        <td>{r.limited.toFixed(5)}</td>
                        <td>{Number.isFinite(r.raw) ? r.raw.toFixed(5) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cast speed bonus table (limited to 200) */}
          {bpCastSpeed.length > 0 && (
            <div className="card">
              <div className="card-content">
                <span className="card-title">Breakpoints for Cast speed bonus (%)</span>
                <table className="striped">
                  <thead>
                    <tr>
                      <th>Cast speed %</th>
                      <th>Server cast time (s)</th>
                      <th>Raw cast time (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bpCastSpeed.map((r) => (
                      <tr key={`cs-${r.value}`}>
                        <td>{r.value}</td>
                        <td>{r.limited.toFixed(5)}</td>
                        <td>{Number.isFinite(r.raw) ? r.raw.toFixed(5) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* If no improvements across any inputs, show nothing per requirements (i.e., don't render tables). We keep section header only. */}
        </div>
      </div>
    </main>
  )
}

export default App
