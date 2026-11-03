import React, { useEffect, useRef, useState } from 'react';
import { HeartPulse, Zap, Users, Ambulance, Clock, Play, Pause, Plus, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { cardiacRequest } from '../services/cardiacArrestService';
import CardiacResponseMap from './CardiacResponseMap';

const PRESETS = [
  { label: 'Tambaram · covered', latitude: 12.9249, longitude: 80.119, location_name: 'Demo Tambaram community incident' },
  { label: 'Coimbatore', latitude: 11.0285, longitude: 77.012, location_name: 'Demo Coimbatore civic plaza incident' },
  { label: 'Madurai', latitude: 9.986, longitude: 78.064, location_name: 'Demo Madurai gathering incident' },
  { label: 'Katpadi · no eligible AED', latitude: 12.9715, longitude: 79.1385, location_name: 'Demo Katpadi incident' },
];
const EMPTY = { ...PRESETS[0], responsive: 'unknown', breathing_status: 'unknown', victim_count: 1,
  reported_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T').slice(0, 16),
  description: 'One person collapsed, is unresponsive and gasping.' };
const TERMINAL = ['COMPLETED', 'CANCELLED'];
const button = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const secondary = `${button} bg-white border-stone-200 text-stone-700 hover:bg-stone-50`;
const primary = `${button} bg-burnt-600 border-burnt-600 text-white hover:bg-burnt-700`;
const input = 'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-burnt-400';
const minute = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(2)}m`;
const elapsed = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const asResponsive = (value) => value === 'unknown' ? null : value === 'yes';
const responsiveLabel = (value) => value === null || value === undefined ? 'Unknown' : value ? 'Responsive' : 'Unresponsive';

function Field({ label, children }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-stone-600">{label}</span>{children}</label>;
}
function Panel({ title, children, subtitle }) {
  return <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm">
    <h3 className="text-sm font-bold text-stone-900">{title}</h3>
    {subtitle && <p className="mt-1 text-xs text-stone-500">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </section>;
}
function ResourceGroup({ title, items = [], empty }) {
  return <div className="space-y-2"><h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-500">{title} · {items.length}</h4>
    {items.length ? items.map((r) => <div key={r.id} className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-xs">
      <div className="flex justify-between gap-2"><span className="font-semibold text-stone-800">{r.facility_name || r.label || r.hospital_name || `${r.ambulance_type} · ${r.base_name}`}</span>
        <span className="shrink-0 font-mono text-[10px] text-teal-700">{r.status?.replaceAll('_', ' ')}</span></div>
      <p className="mt-1 text-[10px] text-stone-500">{r.id}{r.role ? ` · ${r.role}` : ''} · {r.data_origin === 'scenario_capability_profile' ? 'Scenario capacity & capabilities' : 'Synthetic resource'}</p>
      {r.arrival_seconds != null && <p className="mt-1 text-stone-600">Projected arrival from report: {minute(r.arrival_seconds / 60)}</p>}
      {r.retrieval_assumption && <p className="mt-1 text-stone-500">{r.retrieval_assumption}</p>}
    </div>) : <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-500">{empty}</p>}
  </div>;
}

export default function CardiacArrestView() {
  const [form, setForm] = useState(EMPTY);
  const [incidents, setIncidents] = useState([]);
  const [incident, setIncident] = useState(null);
  const [creating, setCreating] = useState(true);
  const [mode, setMode] = useState('full');
  const [radius, setRadius] = useState(5);
  const [review, setReview] = useState({ responsive: 'unknown', breathing_status: 'unknown', victim_count: 1 });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const busyRef = useRef(false);
  const currentRef = useRef(null);
  currentRef.current = incident;

  function accept(next) {
    setIncident(next);
    setCreating(false);
    setIncidents((previous) => [next, ...previous.filter((item) => item.id !== next.id)]);
    localStorage.setItem('ero-cardiac-incident', next.id);
    if (TERMINAL.includes(next.status)) setPlaying(false);
  }
  async function run(label, task) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(label);
    setError('');
    try { return await task(); }
    catch (err) { setError(err.message); setPlaying(false); }
    finally { busyRef.current = false; setBusy(''); }
  }
  async function refresh() {
    await run('Loading incidents', async () => {
      const list = await cardiacRequest('/cardiac-arrest');
      setIncidents(list);
      const savedId = currentRef.current?.id || localStorage.getItem('ero-cardiac-incident');
      const saved = list.find((item) => item.id === savedId) || list[0];
      if (saved) accept(saved);
    });
    setLoaded(true);
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!incident) return;
    setReview({ responsive: incident.report.responsive === null ? 'unknown' : incident.report.responsive ? 'yes' : 'no',
      breathing_status: incident.report.breathing_status, victim_count: incident.report.victim_count });
  }, [incident?.id]);

  async function action(name, seconds = 30) {
    const selected = currentRef.current;
    if (!selected) return;
    return run(name === 'advance' ? 'Advancing simulation' : 'Updating simulation', async () => {
      accept(await cardiacRequest(`/cardiac-arrest/${selected.id}/simulate`, 'POST', { action: name, seconds }));
    });
  }
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => { if (!busyRef.current) action('advance', 10); }, 700);
    return () => clearInterval(timer);
  }, [playing]);

  async function submit(event) {
    event.preventDefault();
    const reportTime = new FormData(event.currentTarget).get('reported_at');
    await run('Saving incident', async () => {
      const { label, ...report } = form;
      accept(await cardiacRequest('/cardiac-arrest/report', 'POST', { ...report,
        latitude: Number(form.latitude), longitude: Number(form.longitude), victim_count: Number(form.victim_count),
        responsive: asResponsive(form.responsive), reported_at: `${reportTime}+05:30` }));
    });
  }
  const active = incident && !creating;
  const closed = active && TERMINAL.includes(incident.status);
  const dispatched = active && Object.hasOwn(incident.assignments, 'ambulances');
  const canReview = active && ['REPORTED', 'ASSESSED'].includes(incident.status);
  const canDisrupt = dispatched && !closed;
  const preTransport = canDisrupt && !['TRANSPORTING', 'HOSPITAL_HANDOVER'].includes(incident.status);
  const metrics = active ? incident.analytics : {};

  return <div className="space-y-5">
    <div className="rounded-2xl bg-[#171A1D] p-5 sm:p-6 text-white relative overflow-hidden">
      <div className="absolute -right-8 -top-10 h-48 w-48 rounded-full bg-rose-500/10 blur-2xl pointer-events-none" />
      <div className="relative flex flex-wrap justify-between gap-4">
        <div><div className="flex items-center gap-2 text-rose-300"><HeartPulse size={18} /><span className="text-[10px] uppercase tracking-[0.2em] font-bold">Coordinated response lab</span></div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Every response has a timeline.</h2>
          <p className="mt-2 text-sm text-stone-400 max-w-xl">Simulate ambulance dispatch, AED access and community response for a suspected cardiac arrest.</p></div>
        <div className="flex items-center gap-2 self-start"><button className={`${button} border-white/20 text-stone-200 hover:bg-white/10`} disabled={!!busy} onClick={() => { setPlaying(false); refresh(); }}><RefreshCw size={14} />Refresh</button>
          <button className={primary} disabled={!!busy} onClick={() => { setPlaying(false); setCreating(true); setError(''); }}><Plus size={14} />New report</button></div>
      </div>
      <p className="relative mt-5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold text-amber-200">SIMULATION — NOT CONNECTED TO EMERGENCY SERVICES. All AEDs, responders, notifications and event times are synthetic.</p>
    </div>

    {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle size={18} className="shrink-0" />{error}</div>}
    {!loaded && <p role="status" className="text-sm text-stone-500">Connecting to cardiac simulation backend…</p>}
    {!!incidents.length && <div className="flex flex-wrap items-center gap-3 text-xs"><label htmlFor="cardiac-history" className="font-semibold text-stone-600">Saved simulations</label>
      <select id="cardiac-history" className={`${input} max-w-lg`} disabled={!!busy} value={active ? incident.id : ''} onChange={(e) => { const selected = incidents.find((i) => i.id === e.target.value); if (selected) { setPlaying(false); accept(selected); } }}>
        <option value="">New report</option>{incidents.map((i) => <option key={i.id} value={i.id}>{i.id} · {i.report.location_name} · {i.status}</option>)}
      </select></div>}

    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-5 items-start">
      <div className="space-y-5">
        {creating ? <Panel title="Report a suspected cardiac arrest" subtitle="Unknown details are accepted. Choose a synthetic scenario or pick coordinates on the map.">
          <div className="flex flex-wrap gap-2 mb-4">{PRESETS.map((p) => <button key={p.label} className={secondary} disabled={!!busy} onClick={() => setForm((f) => ({ ...f, ...p }))}>{p.label}</button>)}</div>
          <form className="space-y-3" onSubmit={submit}>
            <Field label="Scenario location"><input className={input} required maxLength={160} value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Latitude"><input className={input} required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></Field>
              <Field label="Longitude"><input className={input} required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Reported responsiveness"><select className={input} value={form.responsive} onChange={(e) => setForm({ ...form, responsive: e.target.value })}><option value="unknown">Unknown</option><option value="no">Unresponsive</option><option value="yes">Responsive</option></select></Field>
              <Field label="Reported breathing"><select className={input} value={form.breathing_status} onChange={(e) => setForm({ ...form, breathing_status: e.target.value })}><option value="unknown">Unknown</option><option value="not_breathing">Not breathing</option><option value="abnormal">Abnormal / gasping</option><option value="normal">Normal</option></select></Field></div>
            <Field label="Reported victim count"><input className={input} type="number" required min="1" max="20" value={form.victim_count} onChange={(e) => setForm({ ...form, victim_count: e.target.value })} /></Field>
            <Field label="Simulation report time (IST)"><input className={input} name="reported_at" type="datetime-local" required value={form.reported_at || EMPTY.reported_at} onChange={(e) => setForm({ ...form, reported_at: e.target.value })} /></Field>
            <Field label="Caller description (optional)"><textarea className={input} rows={3} maxLength={4000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <button type="submit" disabled={!!busy} className={`${primary} w-full`}><HeartPulse size={16} />{busy === 'Saving incident' ? 'Saving…' : 'Create simulation report'}</button>
          </form>
        </Panel> : <Panel title={incident.report.location_name} subtitle={`${incident.id} · CARDIAC_ARREST · ${incident.report.victim_count} reported victim(s)`}>
          <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-rose-50 text-rose-700 px-3 py-1 text-[10px] font-mono font-bold">{incident.status.replaceAll('_', ' ')}</span><span className="font-mono text-xl font-bold tabular-nums">T+{elapsed(incident.elapsed_seconds)}</span></div>
          <p className="text-xs text-stone-500 mt-3">Reported {new Date(incident.report.reported_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · All metrics are simulated time from this report.</p>
          {incident.report.description && <p className="mt-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">{incident.report.description}</p>}
          <div className="mt-4 border-t border-stone-100 pt-4 space-y-3">
            <div className="flex items-center justify-between"><h4 className="text-xs font-bold">Reported information review</h4><span className="text-[10px] text-stone-500">{incident.assessment.reviewed ? 'Reviewed' : 'Awaiting review'}</span></div>
            <p className="text-xs text-stone-500">Extraction: {responsiveLabel(incident.assessment.extracted?.responsive)} · {incident.assessment.extracted?.breathing_status?.replaceAll('_', ' ')}. {incident.assessment.source === 'gemini_extraction' ? 'Gemini extraction' : 'Deterministic rules'}.</p>
            {incident.assessment.fallback_reason && <p className="text-[11px] text-stone-400">{incident.assessment.fallback_reason}</p>}
            <div className="grid grid-cols-2 gap-2"><Field label="Responsiveness"><select className={input} disabled={!canReview || !!busy} value={review.responsive} onChange={(e) => setReview({ ...review, responsive: e.target.value })}><option value="unknown">Unknown</option><option value="no">Unresponsive</option><option value="yes">Responsive</option></select></Field>
              <Field label="Breathing"><select className={input} disabled={!canReview || !!busy} value={review.breathing_status} onChange={(e) => setReview({ ...review, breathing_status: e.target.value })}>{['unknown', 'normal', 'abnormal', 'not_breathing'].map((v) => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}</select></Field></div>
            {canReview && <div className="flex flex-wrap gap-2"><button className={secondary} disabled={!!busy} onClick={() => { const extracted = incident.assessment.extracted; setReview((r) => ({ ...r, responsive: r.responsive === 'unknown' && extracted.responsive !== null ? extracted.responsive ? 'yes' : 'no' : r.responsive, breathing_status: r.breathing_status === 'unknown' ? extracted.breathing_status : r.breathing_status })); }}>Use extracted unknown fields</button>
              <button className={secondary} disabled={!!busy} onClick={() => run('Saving review', async () => accept(await cardiacRequest(`/cardiac-arrest/${incident.id}/assessment`, 'POST', { ...review, responsive: asResponsive(review.responsive) }))) }><CheckCircle2 size={14} />Save review</button></div>}
            <p className="text-[10px] text-stone-400">Extraction structures caller reports. It does not diagnose or gate dispatch.</p>
          </div>
          {canReview && <div className="space-y-3 mt-4 pt-4 border-t border-stone-100"><Field label="Coordination mode"><select className={input} value={mode} onChange={(e) => setMode(e.target.value)}><option value="baseline">A · Ambulance only</option><option value="aed">B · Ambulance + fictional AED runner</option><option value="full">C · Ambulance + AED + community responders</option></select></Field>
            <Field label="AED / responder search radius (km)"><input className={input} type="number" min="0.1" max="25" step="0.1" value={radius} onChange={(e) => setRadius(e.target.value)} /></Field>
            <button className={`${primary} w-full`} disabled={!!busy || !Number.isFinite(Number(radius)) || Number(radius) <= 0 || Number(radius) > 25} onClick={() => run('Coordinating resources', async () => accept(await cardiacRequest(`/cardiac-arrest/${incident.id}/dispatch`, 'POST', { mode, search_radius_km: Number(radius), scene_minutes: 4 }))) }><ArrowRight size={15} />{busy === 'Coordinating resources' ? 'Solving & coordinating…' : 'Dispatch simulation resources'}</button></div>}
          {canDisrupt && <div className="mt-4 space-y-3 border-t border-stone-100 pt-4"><div className="flex flex-wrap gap-2">
            <button className={primary} disabled={!!busy && !playing} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play · 10s / tick'}</button>
            <button className={secondary} disabled={!!busy || playing} onClick={() => action('advance', 30)}>+30 sec</button><button className={secondary} disabled={!!busy || playing} onClick={() => action('advance', 300)}>+5 min</button></div>
            <p className="text-[11px] text-stone-500">Advance time to simulate acceptance, travel, arrival and handover. Scene time assumption: 4 minutes.</p>
            <div className="flex flex-wrap gap-2">{[
              ['responder_decline', 'Responder declines', preTransport && incident.assignments.responders?.some((r) => r.status !== 'arrived')],
              ['road_closure', 'Road closure · +50% delay', canDisrupt],
              ['ambulance_unavailable', 'Ambulance unavailable', preTransport && incident.assignments.ambulances?.length],
              ['hospital_full', 'Hospital capacity lost', preTransport && incident.assignments.hospitals?.length],
            ].map(([name, label, allowed]) => <button key={name} className={secondary} disabled={!!busy || playing || !allowed} onClick={() => action(name)}>{label}</button>)}</div>
            <div className="flex flex-wrap gap-2"><button className={secondary} disabled={!!busy || playing || !preTransport || metrics.cpr_initiation_minutes != null || ![...incident.assignments.responders, ...incident.assignments.ambulances].some((r) => r.status === 'arrived')} onClick={() => action('cpr_started')}>Simulate CPR initiation</button>
              <button className={secondary} disabled={!!busy || playing || !preTransport || metrics.aed_use_minutes != null || !incident.assignments.aeds?.some((r) => r.status === 'delivered')} onClick={() => action('aed_use')}>Simulate AED use</button></div>
          </div>}
          {!closed && !['TRANSPORTING', 'HOSPITAL_HANDOVER'].includes(incident.status) && <button className="mt-4 text-xs text-stone-500 underline disabled:opacity-40" disabled={!!busy || playing} onClick={() => run('Closing simulation', async () => accept(await cardiacRequest(`/cardiac-arrest/${incident.id}/status`, 'PATCH', { status: 'CANCELLED' }))) }>Cancel simulation & release resources</button>}
        </Panel>}
      </div>

      <div className="space-y-5"><CardiacResponseMap incident={active ? incident : null} preview={{ latitude: Number(form.latitude) || 12.9249, longitude: Number(form.longitude) || 80.119 }} onPick={creating ? (lat, lng) => setForm((f) => ({ ...f, latitude: Number(lat.toFixed(5)), longitude: Number(lng.toFixed(5)) })) : undefined} />
        {active && <><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[
          [Ambulance, 'Ambulances', incident.assignments.ambulances?.length || 0], [Zap, 'Eligible AEDs', incident.nearby_aeds.length],
          [Users, 'Responders assigned', incident.assignments.responders?.length || 0], [HeartPulse, 'Unserved victims', metrics.unserved_victims ?? '—'],
        ].map(([Icon, label, value]) => <div key={label} className="rounded-xl border border-stone-200 bg-white p-3"><Icon size={16} className="text-burnt-600" /><p className="mt-2 text-2xl font-bold">{value}</p><p className="text-[10px] text-stone-500">{label}</p></div>)}</div>
          {incident.warnings.map((warning, i) => <p key={i} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{warning}</p>)}
          <Panel title="Resource coordination" subtitle="Nearby resources are filtered for access, operational status, training and active reservations."><div className="grid sm:grid-cols-2 gap-5">
            <ResourceGroup title="Ambulances" items={incident.assignments.ambulances} empty="Awaiting dispatch or no available ALS vehicle." />
            <ResourceGroup title="AED assignments" items={incident.assignments.aeds} empty="No AED assigned in this configuration." />
            <ResourceGroup title="Community responders" items={incident.assignments.responders} empty="No eligible responder assigned in this configuration." />
            <ResourceGroup title="Receiving hospitals" items={incident.assignments.hospitals} empty="No hospital intake reserved." />
          </div></Panel>
        </>}
      </div>
    </div>

    {active && <><Panel title="Response milestones" subtitle="Observed simulation events · minutes since report. A dash means the event has not occurred.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[
        ['Dispatch', metrics.dispatch_minutes], ['Ambulance arrival', metrics.ambulance_arrival_minutes], ['Responder arrival', metrics.responder_arrival_minutes], ['AED at scene', metrics.aed_access_minutes],
        ['CPR initiation · explicit', metrics.cpr_initiation_minutes], ['AED use · explicit', metrics.aed_use_minutes], ['First hospital arrival', metrics.hospital_arrival_minutes], ['MILP computation', metrics.solver_computation_ms == null ? null : `${metrics.solver_computation_ms.toFixed(1)} ms`],
      ].map(([label, value]) => <div key={label}><p className="text-[11px] text-stone-500">{label}</p><p className="mt-1 font-mono text-xl font-semibold">{typeof value === 'string' ? value : minute(value)}</p></div>)}</div>
    </Panel>
      {!!incident.comparison.length && <Panel title="Controlled scenario comparison" subtitle="Projected milestones from the original dispatch snapshot · same incident and availability · sample size 1 · deterministic, no random seed.">
        <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr className="border-b border-stone-200 text-stone-500">{['Configuration', 'Ambulance arrival', 'Responder arrival', 'AED at scene', 'Hospital arrival*', 'Unserved'].map((h) => <th key={h} className="p-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{incident.comparison.map((row) => <tr key={row.mode} className={`border-b border-stone-100 ${row.mode === incident.options.mode ? 'bg-orange-50' : ''}`}><td className="p-3 font-semibold whitespace-nowrap">{row.label}</td>{['ambulance_arrival_minutes', 'responder_arrival_minutes', 'aed_access_minutes', 'hospital_arrival_minutes'].map((key) => <td key={key} className="p-3 font-mono">{minute(row[key])}</td>)}<td className="p-3">{row.unserved_victims}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-[11px] text-stone-500">Time reduction vs A for the selected mode: ambulance {incident.comparison.find((r) => r.mode === incident.options.mode)?.improvement_vs_baseline_pct?.ambulance_arrival_minutes ?? '—'}%; hospital {incident.comparison.find((r) => r.mode === incident.options.mode)?.improvement_vs_baseline_pct?.hospital_arrival_minutes ?? '—'}%. AED and responder reductions are undefined because A does not model those resources.</p>
        <p className="mt-2 text-[11px] text-stone-500">*Last allocated hospital arrival from report. Mode B assumes a fictional runner starts at the scene; mode C uses an eligible CPR + AED responder. Walking at 5 km/h, distance ×1.35, facility access delay included. No CPR, shock delivery or survival benefit is inferred from arrival. Disruptions affect the actual timeline, while these initial projections remain fixed.</p>
      </Panel>}
      <Panel title="Unified incident timeline" subtitle="Incident lifecycle and resource events have independent timestamps. Every event below is simulated.">
        <ol className="space-y-0 max-h-[460px] overflow-y-auto">{[...incident.timeline].sort((a, b) => a.at_seconds - b.at_seconds).map((entry) => <li key={entry.id} className="flex gap-4 border-l-2 border-stone-100 ml-2 pb-4 pl-4 relative"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-burnt-500" /><span className="text-[11px] font-mono text-stone-400 whitespace-nowrap pt-0.5">T+{elapsed(entry.at_seconds)}</span><div><p className="text-xs font-medium text-stone-800">{entry.message}</p><p className="text-[10px] text-stone-400 mt-1">{entry.resource_id || entry.kind} · {new Date(entry.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST</p></div></li>)}</ol>
      </Panel></>}
    {busy && <div role="status" className="fixed bottom-5 right-5 z-30 rounded-xl bg-graphite-900 px-4 py-3 text-xs text-white shadow-lg flex items-center gap-2"><Clock size={14} className="animate-pulse" />{busy}…</div>}
  </div>;
}
