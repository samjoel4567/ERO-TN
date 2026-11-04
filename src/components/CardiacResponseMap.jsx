import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster';
import { fetchRoadRoute } from '../services/routingService';

function resourceIcon(symbol, color, count, offset = 0) {
  const node = document.createElement('div');
  Object.assign(node.style, { background: color, color: '#fff', border: '2px solid #fff', borderRadius: count ? '50%' : '7px',
    width: count ? '34px' : '24px', height: count ? '34px' : '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    font: 'bold 11px system-ui', boxShadow: '0 2px 6px #0004' });
  node.textContent = count ? `${symbol}${count}` : symbol;
  return L.divIcon({ html: node, className: 'cardiac-resource-icon', iconSize: count ? [34, 34] : [24, 24],
    iconAnchor: [offset + (count ? 17 : 12), count ? 17 : 12] });
}

function positionAlong(coordinates, fraction) {
  if (!coordinates?.length) return null;
  const progress = Math.min(1, Math.max(0, fraction)) * (coordinates.length - 1);
  const index = Math.floor(progress);
  const next = coordinates[Math.min(index + 1, coordinates.length - 1)];
  return [coordinates[index][0] + (next[0] - coordinates[index][0]) * (progress - index),
    coordinates[index][1] + (next[1] - coordinates[index][1]) * (progress - index)];
}

export default function CardiacResponseMap({ incident, preview, onPick, catalog, radius = 25 }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const layers = useRef(null);
  const resourceGroups = useRef(null);
  const pickRef = useRef(onPick);
  const fitted = useRef('');
  const [routes, setRoutes] = useState({});
  const [routingLabel, setRoutingLabel] = useState('Simulation uses labelled geometric travel estimates.');
  const [visible, setVisible] = useState({ aeds: true, ambulances: true });
  pickRef.current = onPick;
  const transportKey = JSON.stringify([incident?.id, incident?.assignments?.ambulances?.map((a) => [a.id, a.latitude, a.longitude]),
    incident?.assignments?.hospitals?.map((h) => [h.id, h.latitude, h.longitude])]);

  useEffect(() => {
    // Avoid delayed zoom-transition callbacks after navigation removes the map.
    fitted.current = '';
    const map = L.map(container.current, { center: [12.9249, 80.119], zoom: 14, scrollWheelZoom: false, zoomAnimation: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    layers.current = L.layerGroup().addTo(map);
    resourceGroups.current = {
      aeds: L.markerClusterGroup({ maxClusterRadius: 40, showCoverageOnHover: false,
        iconCreateFunction: (cluster) => resourceIcon('⚡', '#047857', cluster.getChildCount(), 18) }).addTo(map),
      ambulances: L.markerClusterGroup({ maxClusterRadius: 40, showCoverageOnHover: false,
        iconCreateFunction: (cluster) => resourceIcon('+', '#c2410c', cluster.getChildCount(), -18) }).addTo(map),
    };
    map.on('click', ({ latlng }) => pickRef.current?.(latlng.lat, latlng.lng));
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!catalog || !resourceGroups.current) return;
    const { aeds, ambulances } = resourceGroups.current;
    aeds.clearLayers();
    ambulances.clearLayers();
    catalog.aeds.forEach((aed) => {
      const label = document.createElement('div');
      label.textContent = `${aed.facility_name} | MOCK AED | ${aed.availability_status} | ${aed.operational_status} | ${aed.access_note || aed.access_type}`;
      L.marker([aed.latitude, aed.longitude], { icon: resourceIcon('⚡', aed.eligible ? '#047857' : '#78716c', null, 14) })
        .bindPopup(label).bindTooltip(`${aed.facility_name} · mock AED`, { className: 'gis-tooltip', direction: 'top' }).addTo(aeds);
    });
    const bases = new Map();
    catalog.ambulances.forEach((unit) => {
      const base = bases.get(unit.base_id) || { ...unit, units: [] };
      base.units.push(unit);
      bases.set(unit.base_id, base);
    });
    bases.forEach((base) => {
      const available = base.units.filter((u) => u.availability_status === 'available');
      const label = document.createElement('div');
      label.textContent = `${base.base_name} | MOCK AMBULANCES | ${available.length} available of ${base.units.length} | ${base.units.map((u) => `${u.ambulance_type}: ${u.availability_status}`).join(', ')}`;
      L.marker([base.latitude, base.longitude], { icon: resourceIcon('+', available.length ? '#c2410c' : '#78716c', null, -14) })
        .bindPopup(label).bindTooltip(`${base.base_name} · ${available.length} mock ambulances available`, { className: 'gis-tooltip', direction: 'top' }).addTo(ambulances);
    });
  }, [catalog]);

  useEffect(() => {
    if (!mapRef.current || !resourceGroups.current) return;
    Object.entries(visible).forEach(([key, shown]) => {
      if (shown) resourceGroups.current[key].addTo(mapRef.current);
      else resourceGroups.current[key].removeFrom(mapRef.current);
    });
  }, [visible]);

  useEffect(() => {
    let cancelled = false;
    setRoutes({});
    if (!incident?.assignments?.ambulances?.length) return undefined;
    const scene = { lat: incident.report.latitude, lng: incident.report.longitude };
    const jobs = [
      ...incident.assignments.ambulances.map((a) => [a.id, { lat: a.latitude, lng: a.longitude }, scene]),
      ...incident.assignments.hospitals.map((h) => [`hospital-${h.id}`, scene, { lat: h.latitude, lng: h.longitude }]),
    ];
    setRoutingLabel('Loading ambulance road geometry; simulation ETAs remain controlled estimates.');
    Promise.all(jobs.map(async ([id, start, end]) => [id, await fetchRoadRoute(start, end)])).then((entries) => {
      if (cancelled) return;
      setRoutes(Object.fromEntries(entries));
      setRoutingLabel(`${entries.some(([, r]) => r.isFallback) ? 'Fallback geometry included' : 'OSRM road geometry'} · simulation ETAs use the shared geometric estimator.`);
    }).catch(() => { if (!cancelled) setRoutingLabel('Route service unavailable; estimated straight-line paths displayed.'); });
    return () => { cancelled = true; };
  }, [transportKey]);

  useEffect(() => {
    if (!mapRef.current || !layers.current) return;
    layers.current.clearLayers();
    const report = incident?.report;
    const scene = [report?.latitude ?? preview.latitude, report?.longitude ?? preview.longitude];
    const discoveryArea = L.circle(scene, { radius: radius * 1000, color: '#78716c', weight: 1, dashArray: '5 6', fillOpacity: 0.025 });
    discoveryArea.addTo(layers.current);
    const points = [scene];
    const marker = (point, label, color, radius = 7, filled = true) => {
      const node = document.createElement('div');
      node.textContent = label;
      L.circleMarker(point, { radius, color, fillColor: color, fillOpacity: filled ? 0.85 : 0.12, weight: 2 })
        .bindPopup(node).addTo(layers.current);
      points.push(point);
    };
    const line = (coordinates, color, dashed = false) => L.polyline(coordinates, {
      color, weight: 3, opacity: 0.65, ...(dashed ? { dashArray: '5 7' } : {}),
    }).addTo(layers.current);
    marker(scene, `${incident?.id || 'New report location'} · SIMULATED`, '#be123c', 11);
    if (incident) {
      const assignments = incident.assignments;
      (incident.nearby_aeds || []).forEach((a) => marker([a.latitude, a.longitude], `${a.facility_name} · synthetic AED`, '#059669', 6, false));
      (assignments.aeds || []).forEach((a) => marker([a.latitude, a.longitude], `${a.id} · ${a.status} · synthetic AED`, '#059669', 9));
      (assignments.responders || []).forEach((r) => {
        const start = [r.latitude, r.longitude];
        const coordinates = r.via_aed ? [start, [r.via_aed.latitude, r.via_aed.longitude], scene] : [start, scene];
        line(coordinates, '#7c3aed', true);
        const position = r.status === 'arrived' ? scene : start;
        marker(position, `${r.label} · ${r.role} · ${r.status} · synthetic`, '#7c3aed');
      });
      (assignments.ambulances || []).forEach((a) => {
        const start = [a.latitude, a.longitude];
        const coordinates = routes[a.id]?.coordinates || [start, scene];
        line(coordinates, '#d9531e', !routes[a.id]?.isRealRoadRoute);
        const departed = incident.timeline.find((e) => e.resource_id === a.id && e.status === 'en_route')?.at_seconds;
        const fraction = departed === undefined ? 0 : (incident.elapsed_seconds - departed) / Math.max(1, a.arrival_seconds - departed);
        let position = a.status === 'arrived' ? scene : positionAlong(coordinates, fraction);
        const transportStart = incident.timeline.find((e) => e.kind === 'incident' && e.status === 'TRANSPORTING')?.at_seconds;
        const hospital = assignments.hospitals?.[0];
        if (transportStart !== undefined && hospital && assignments.hospitals.length === 1) {
          position = positionAlong(routes[`hospital-${hospital.id}`]?.coordinates || [scene, [hospital.latitude, hospital.longitude]],
            (incident.elapsed_seconds - transportStart) / Math.max(1, hospital.arrival_seconds - transportStart));
        }
        marker(position || start, `${a.ambulance_type} · ${a.id} · synthetic`, '#d9531e', 9);
      });
      (assignments.hospitals || []).forEach((h) => {
        const end = [h.latitude, h.longitude];
        line(routes[`hospital-${h.id}`]?.coordinates || [scene, end], '#0284c7', !routes[`hospital-${h.id}`]?.isRealRoadRoute);
        marker(end, `${h.hospital_name} · scenario intake ${h.patients_allocated}`, '#0284c7', 9);
      });
    }
    const fitKey = `${incident?.id || ''}-${scene.join(',')}-${transportKey}-${radius}`;
    if (fitKey !== fitted.current) {
      mapRef.current.fitBounds(L.latLngBounds(points).extend(discoveryArea.getBounds()).pad(0.05), { maxZoom: 15 });
      fitted.current = fitKey;
    }
  }, [incident, preview, routes, transportKey, radius]);

  const showStatewide = () => {
    if (catalog?.aeds.length) mapRef.current?.fitBounds(L.latLngBounds(catalog.aeds.map((a) => [a.latitude, a.longitude])).pad(0.05));
  };
  const showIncident = () => {
    const scene = [incident?.report.latitude ?? preview.latitude, incident?.report.longitude ?? preview.longitude];
    mapRef.current?.fitBounds(L.circle(scene, { radius: radius * 1000 }).getBounds().pad(0.05));
  };

  return <div className="relative isolate z-0 overflow-hidden rounded-2xl border border-stone-200 bg-white">
    <div role="group" aria-label="Cardiac map resource layers" className="flex flex-wrap items-center gap-2 border-b border-stone-200 p-3 text-[11px] font-semibold">
      <button type="button" aria-pressed={visible.aeds} onClick={() => setVisible((v) => ({ ...v, aeds: !v.aeds }))} className={`rounded-lg border px-2.5 py-1.5 ${visible.aeds ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-500'}`}>⚡ AED locations ({catalog?.summary.total_aeds || 0})</button>
      <button type="button" aria-pressed={visible.ambulances} onClick={() => setVisible((v) => ({ ...v, ambulances: !v.ambulances }))} className={`rounded-lg border px-2.5 py-1.5 ${visible.ambulances ? 'border-orange-700 bg-orange-50 text-orange-800' : 'border-stone-200 text-stone-500'}`}>+ Ambulance fleet ({catalog?.summary.total_ambulances || 0})</button>
      <button type="button" disabled={!catalog} onClick={showStatewide} className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-stone-600 disabled:opacity-40">Statewide view</button>
      <button type="button" onClick={showIncident} className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-stone-600">Incident view</button>
    </div>
    <div ref={container} className="h-[360px] sm:h-[440px] w-full z-0" aria-label="Cardiac arrest simulation resource map" />
    <div className="p-3 text-[11px] text-stone-500 space-y-1">
      <p><span className="text-rose-700 font-semibold">● Incident</span> · <span className="text-burnt-600">● Ambulance</span> · <span className="text-emerald-700">● AED</span> · <span className="text-violet-700">● Responder</span> · <span className="text-sky-700">● Hospital</span></p>
      <p>Green ⚡ markers show hospital/community AEDs; orange + markers show ambulance posts. Cluster numbers count locations, and each hospital post has 2 mock vehicles. Grey markers are unavailable or inaccessible. The dashed circle marks the {radius} km discovery radius.</p>
      <p>{routingLabel} Dashed community paths are walking estimates. Hospital legs show aggregate patient allocations; vehicle movement to a hospital is shown only for a single destination. All device and responder markers are synthetic.</p>
    </div>
  </div>;
}
