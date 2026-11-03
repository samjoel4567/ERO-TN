import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

import {
  Layers,
  MapPin,
  Compass,
  Crosshair,
  Info,
  Navigation,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Truck,
  Eye,
  EyeOff,
  Database,
  Copy,
  Check
} from 'lucide-react';
import {
  VERIFIED_HOSPITALS,
  VERIFIED_SETTLEMENTS,
  VERIFIED_DISTRICT_FLEET,
  BENCHMARK_INCIDENTS
} from '../data/mockData';
import { calculateHaversineKm } from '../data/scenarioData';

const HOSPITAL_ACCESS_GAP_KM = 25;

export default function GisMap({
  selectedIncident,
  selectedDistrictFleet,
  selectedHospital,
  simulationState,
  onMapClick,
  onSelectIncident,
  onSelectDistrictFleet,
  onSelectHospital,
  missionData, // Stage 3 mission data for dynamic single-incident simulation
  discoveryData
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Layer groups refs
  const layerGroupsRef = useRef({
    hospitals: null,
    settlements: null,
    fleet: L.layerGroup(),
    incidents: L.layerGroup(),
    routes: L.layerGroup(),
    simulation: L.layerGroup(),
    selectionPin: L.layerGroup(),
    mission: L.layerGroup(),
    discovery: L.layerGroup(),
    vulnerability: L.layerGroup()
  });

  const [visibleLayers, setVisibleLayers] = useState({
    hospitals: true,
    settlements: false, // Default false so initial view is clean and snappy
    vulnerability: true,
    fleet: true,
    incidents: true,
    routes: true
  });

  const [mapCoordHover, setMapCoordHover] = useState({ lat: 10.9, lng: 78.7 });
  const [zoomLevel, setZoomLevel] = useState(7.2);
  const [activeFeatureInfo, setActiveFeatureInfo] = useState(null);
  const [selectedMapCoord, setSelectedMapCoord] = useState(null);
  const [isCopiedCoord, setIsCopiedCoord] = useState(false);
  const vulnerabilitySettlements = useMemo(() => VERIFIED_SETTLEMENTS.map((settlement) => {
    let nearestHospitalKm = Infinity;
    for (const hospital of VERIFIED_HOSPITALS) {
      const distanceKm = calculateHaversineKm(settlement.lat, settlement.lng, hospital.lat, hospital.lng);
      if (distanceKm < nearestHospitalKm) nearestHospitalKm = distanceKm;
    }
    return { ...settlement, nearestHospitalKm: Number(nearestHospitalKm.toFixed(1)) };
  }).filter((settlement) => settlement.nearestHospitalKm > HOSPITAL_ACCESS_GAP_KM), []);

  // 1. Initialize Map with OpenStreetMap Standard Raster Tiles
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centered at latitude 10.9 and longitude 78.7 (exact center of Tamil Nadu)
    const map = L.map(mapContainerRef.current, {
      center: [10.9, 78.7],
      zoom: 7.2,
      minZoom: 6,
      maxZoom: 18,
      zoomControl: false
    });

    // 1. Basemap: OpenStreetMap standard raster tiles (NO CARTO / NO API KEY REQUIRED)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Coordinate hover tracker
    map.on('mousemove', (e) => {
      setMapCoordHover({
        lat: Number(e.latlng.lat.toFixed(4)),
        lng: Number(e.latlng.lng.toFixed(4))
      });
    });

    map.on('zoomend', () => {
      setZoomLevel(Number(map.getZoom().toFixed(1)));
    });

    // Map selection click: captures coordinates on the map
    map.on('click', (e) => {
      const lat = Number(e.latlng.lat.toFixed(4));
      const lng = Number(e.latlng.lng.toFixed(4));
      setSelectedMapCoord({ lat, lng });
      if (onMapClick) {
        onMapClick(lat, lng);
      }
    });

    // Setup MarkerClusterGroup for Hospitals (Teal cluster styling)
    layerGroupsRef.current.hospitals = L.markerClusterGroup({
      maxClusterRadius: 38,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background:#0F766E; color:#FFFFFF; border:2px solid #FFFFFF; border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:bold; box-shadow:0 3px 8px rgba(0,0,0,0.3);">${count}</div>`,
          className: 'custom-hospital-cluster',
          iconSize: [34, 34]
        });
      }
    });

    // Setup MarkerClusterGroup for Settlements (Stone cluster styling)
    layerGroupsRef.current.settlements = L.markerClusterGroup({
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background:#292524; color:#F5F5F4; border:2px solid #D6D3D1; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:bold; box-shadow:0 3px 8px rgba(0,0,0,0.3);">${count}</div>`,
          className: 'custom-settlement-cluster',
          iconSize: [32, 32]
        });
      }
    });

    // Add static groups
    layerGroupsRef.current.fleet.addTo(map);
    layerGroupsRef.current.incidents.addTo(map);
    layerGroupsRef.current.routes.addTo(map);
    layerGroupsRef.current.simulation.addTo(map);
    layerGroupsRef.current.selectionPin.addTo(map);
    layerGroupsRef.current.mission.addTo(map);
    layerGroupsRef.current.discovery.addTo(map);
    layerGroupsRef.current.vulnerability.addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Plot 339 Verified Hospitals Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    const cluster = layerGroupsRef.current.hospitals;
    if (!map || !cluster) return;

    cluster.clearLayers();

    if (visibleLayers.hospitals) {
      VERIFIED_HOSPITALS.forEach((hosp) => {
        // Distinct Teal Medical Pin for Hospitals
        const hospIcon = L.divIcon({
          className: 'hospital-marker-icon',
          html: `
            <div style="position:relative; width:22px; height:22px; cursor:pointer;" title="${hosp.name}">
              <div style="width:22px; height:22px; border-radius:5px; background:#0F766E; border:1.5px solid #FFFFFF; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.35);">
                <span style="color:white; font-size:10px; font-weight:900; font-family:'Inter',sans-serif;">H</span>
              </div>
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        const marker = L.marker([hosp.lat, hosp.lng], { icon: hospIcon });

        // Tooltip on Hover
        marker.bindTooltip(`
          <div>
            <strong>${hosp.name}</strong><br/>
            <span style="color:#14B8A6; font-weight:600;">${hosp.type || 'Hospital Facility'}</span> • ${hosp.district}
          </div>
        `, { direction: 'top', offset: [0, -12], className: 'gis-tooltip' });

        // Popup on Click
        const popupContent = `
          <div style="padding:4px 2px; font-family:'Inter',sans-serif; min-width:230px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
              <span style="font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:bold; color:#14B8A6; text-transform:uppercase;">
                ${hosp.type || 'Hospital Facility'}
              </span>
              <span style="background:#0F766E; color:#FFFFFF; font-size:9px; font-weight:bold; padding:1px 5px; border-radius:3px;">
                Verified ID: ${hosp.id}
              </span>
            </div>
            <div style="font-size:12px; font-weight:bold; color:#FFFFFF; margin-bottom:3px; line-height:1.2;">
              ${hosp.name}
            </div>
            <div style="font-size:11px; color:#D1D5DB; margin-bottom:4px;">
              District: <strong style="color:#FFFFFF;">${hosp.district}</strong>
            </div>
            ${
              hosp.address
                ? `<div style="font-size:10px; color:#9CA3AF; margin-bottom:4px; line-height:1.3;">Address: ${hosp.address} ${hosp.pin ? `(PIN: ${hosp.pin})` : ''}</div>`
                : ''
            }
            <div style="font-size:10px; color:#9CA3AF; border-top:1px solid #374151; padding-top:4px; margin-top:4px; display:flex; justify-content:space-between;">
              <span>Confidence: <strong style="color:#10B981;">${hosp.confidence || 'Medium'}</strong></span>
              <span>[${hosp.lat}, ${hosp.lng}]</span>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          setActiveFeatureInfo({ type: 'hospital', data: hosp });
          if (onSelectHospital) onSelectHospital(hosp);
        });

        cluster.addLayer(marker);
      });

      if (!map.hasLayer(cluster)) {
        cluster.addTo(map);
      }
    } else {
      if (map.hasLayer(cluster)) {
        map.removeLayer(cluster);
      }
    }
  }, [visibleLayers.hospitals]);

  // 3. Plot 2,391 Verified Settlements Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    const cluster = layerGroupsRef.current.settlements;
    if (!map || !cluster) return;

    cluster.clearLayers();

    if (visibleLayers.settlements) {
      VERIFIED_SETTLEMENTS.forEach((settlement) => {
        const settleMarker = L.circleMarker([settlement.lat, settlement.lng], {
          radius: 3.5,
          color: '#44403C',
          weight: 1,
          fillColor: '#78716C',
          fillOpacity: 0.75
        });

        // Tooltip on Hover
        settleMarker.bindTooltip(`
          <div>
            <strong>${settlement.name}</strong> ${settlement.nativeName ? `(${settlement.nativeName})` : ''}<br/>
            <span style="color:#A8A29E;">Taluk: ${settlement.taluk} • ${settlement.district}</span>
          </div>
        `, { direction: 'top', offset: [0, -6], className: 'gis-tooltip' });

        const popupContent = `
          <div style="padding:4px 2px; font-family:'Inter',sans-serif; min-width:210px;">
            <div style="font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:bold; color:#A8A29E; text-transform:uppercase;">
              LGD Village Code: ${settlement.code}
            </div>
            <div style="font-size:12px; font-weight:bold; color:#FFFFFF; margin:2px 0;">
              ${settlement.name} ${settlement.nativeName ? `(${settlement.nativeName})` : ''}
            </div>
            <div style="font-size:11px; color:#D1D5DB;">
              District: <strong>${settlement.district}</strong> • Taluk: ${settlement.taluk}
            </div>
            <div style="font-size:10px; color:#9CA3AF; border-top:1px solid #374151; padding-top:4px; margin-top:4px; display:flex; justify-content:space-between;">
              <span>Confidence: <strong>${settlement.confidence}</strong></span>
              <span>[${settlement.lat}, ${settlement.lng}]</span>
            </div>
          </div>
        `;

        settleMarker.bindPopup(popupContent);
        settleMarker.on('click', () => {
          setActiveFeatureInfo({ type: 'settlement', data: settlement });
        });

        cluster.addLayer(settleMarker);
      });

      if (!map.hasLayer(cluster)) {
        cluster.addTo(map);
      }
    } else {
      if (map.hasLayer(cluster)) {
        map.removeLayer(cluster);
      }
    }
  }, [visibleLayers.settlements]);

  // Potential access gap markers use mapped community and facility coordinates.
  // Ambulance bases are not mapped in the source data, so proximity is explicitly unknown.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupsRef.current.vulnerability;
    if (!map || !group) return;
    group.clearLayers();
    if (!visibleLayers.vulnerability) return;
    vulnerabilitySettlements.forEach((settlement) => {
      const marker = L.circleMarker([settlement.lat, settlement.lng], {
        radius: 8, color: '#991B1B', weight: 3, fillColor: '#F97316', fillOpacity: 0.95
      });
      marker.bindTooltip(`${settlement.name} · potential access gap`, { direction: 'top', className: 'gis-tooltip' });
      marker.bindPopup(`<div style="font-family:Inter,sans-serif;min-width:220px;color:#F3F4F6;background:#171A1D;padding:4px;">
        <strong style="font-size:13px;color:#FFFFFF;">Potential access gap: ${settlement.name}</strong><br/>
        <span style="font-size:11px;color:#D6D3D1;">${settlement.district} · ${settlement.taluk}</span><br/>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #44403C;font-size:11px;color:#FDE68A;">Nearest mapped hospital: ${settlement.nearestHospitalKm} km straight-line distance (screening threshold: ${HOSPITAL_ACCESS_GAP_KM} km).</div>
        <div style="margin-top:5px;font-size:10px;color:#E7E5E4;">Ambulance proximity is UNKNOWN. Available fleet data contains district totals, not dispatch base or vehicle GPS coordinates. This point signals a hospital access screening gap, not proof that no ambulance serves the area.</div>
      </div>`, { maxWidth: 300 });
      marker.on('click', () => setActiveFeatureInfo({ type: 'vulnerability', data: settlement }));
      marker.addTo(group);
    });
  }, [visibleLayers.vulnerability, vulnerabilitySettlements]);

  // 4. Plot 38 District-Level Ambulance Fleet Markers (Verified totals by district)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupsRef.current.fleet;
    if (!map || !group) return;

    group.clearLayers();

    if (visibleLayers.fleet) {
      VERIFIED_DISTRICT_FLEET.forEach((fleetRecord) => {
        const isSelected = selectedDistrictFleet?.district === fleetRecord.district;

        // Distinct Charcoal & Burnt-Orange Badge showing verified district fleet count
        const fleetIcon = L.divIcon({
          className: 'district-fleet-marker',
          html: `
            <div style="position:relative; width:36px; height:36px; cursor:pointer;" title="${fleetRecord.district}: ${fleetRecord.totalAmbulances} Ambulances">
              <div style="width:36px; height:36px; border-radius:8px; background:#181B1E; border:2px solid #D9531E; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.4); ${
                isSelected ? 'outline:3px solid #F97316;' : ''
              }">
                <span style="color:#FB923C; font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:800; line-height:1;">${fleetRecord.totalAmbulances}</span>
                <span style="color:#9CA3AF; font-size:7px; font-weight:700; text-transform:uppercase; margin-top:1px;">108</span>
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const marker = L.marker([fleetRecord.lat, fleetRecord.lng], { icon: fleetIcon });

        // Tooltip on Hover
        marker.bindTooltip(`
          <div>
            <strong>${fleetRecord.district} District Fleet</strong><br/>
            <span style="color:#FB923C; font-weight:bold;">${fleetRecord.totalAmbulances} Ambulances (108 Fleet)</span><br/>
            <span style="color:#9CA3AF; font-size:10px;">HQ: ${fleetRecord.lat}°N, ${fleetRecord.lng}°E</span>
          </div>
        `, { direction: 'top', offset: [0, -18], className: 'gis-tooltip' });

        // Popup showing full district-level ambulance counts by type per dataset
        const popupContent = `
          <div style="padding:6px 2px; font-family:'Inter',sans-serif; min-width:250px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:bold; color:#FB923C; text-transform:uppercase;">
                District Fleet Aggregate
              </span>
              <span style="background:#D9531E; color:#FFFFFF; font-size:9px; font-weight:bold; padding:1px 5px; border-radius:3px;">
                Verified TNHSP
              </span>
            </div>
            <div style="font-size:13px; font-weight:bold; color:#FFFFFF; margin-bottom:6px;">
              ${fleetRecord.district} District HQ
            </div>

            <div style="background:#22262B; border:1px solid #2C3238; border-radius:6px; padding:6px; margin-bottom:6px;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:10px; font-family:'JetBrains Mono',monospace;">
                <div>ALS (Adv Life Support): <strong style="color:#FFFFFF;">${fleetRecord.als}</strong></div>
                <div>BLS (Basic Life): <strong style="color:#FFFFFF;">${fleetRecord.bls}</strong></div>
                <div>NLS (Neonatal): <strong style="color:#FFFFFF;">${fleetRecord.nls}</strong></div>
                <div>VVIP Ambulances: <strong style="color:#FFFFFF;">${fleetRecord.vvip}</strong></div>
                <div>FR Bikes (Urban): <strong style="color:#FFFFFF;">${fleetRecord.frBikes}</strong></div>
                <div style="color:#10B981; font-weight:bold;">Total 108 Fleet: ${fleetRecord.totalAmbulances}</div>
              </div>
            </div>

            <div style="font-size:10px; color:#9CA3AF; line-height:1.3; border-top:1px solid #374151; padding-top:4px;">
              <strong>Coordinate Source:</strong> District Headquarters center (${fleetRecord.lat}°N, ${fleetRecord.lng}°E).
              <br/>
              <strong>Data Scope:</strong> District total only (TNHSP DWA). Station-level GPS locations are not published in public releases. Individual ambulance coordinates are not invented.
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          setActiveFeatureInfo({ type: 'fleet', data: fleetRecord });
          if (onSelectDistrictFleet) onSelectDistrictFleet(fleetRecord);
        });

        group.addLayer(marker);
      });
    }
  }, [visibleLayers.fleet, selectedDistrictFleet]);

  // 5. Plot Benchmark Incidents & Routes (Only if missionData is not active)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const incGroup = layerGroupsRef.current.incidents;
    const routeGroup = layerGroupsRef.current.routes;
    if (!map || !incGroup || !routeGroup) return;

    incGroup.clearLayers();
    routeGroup.clearLayers();

    // If active custom mission is provided, let mission layer handle it
    if (missionData) return;

    // Incidents
    if (visibleLayers.incidents) {
      BENCHMARK_INCIDENTS.forEach((inc) => {
        const isCritical = inc.severity === 'CRITICAL';
        const isSelected = selectedIncident?.id === inc.id;

        const icon = L.divIcon({
          className: 'incident-marker-icon',
          html: `
            <div style="position:relative; width:34px; height:34px; cursor:pointer;" title="${inc.title}">
              <div style="position:absolute; inset:0; border-radius:50%; background:${
                isCritical ? '#DC2626' : '#D97706'
              }; opacity:0.3; animation:beacon-ping 1.5s infinite;"></div>
              <div style="position:absolute; inset:4px; border-radius:50%; background:${
                isCritical ? '#DC2626' : '#D97706'
              }; border:2px solid #FFFFFF; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.4); ${
            isSelected ? 'outline:3px solid #D9531E;' : ''
          }">
                <span style="color:white; font-size:11px; font-weight:bold; font-family:'JetBrains Mono',monospace;">!</span>
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const marker = L.marker([inc.lat, inc.lng], { icon });

        // Tooltip on Hover
        marker.bindTooltip(`
          <div>
            <strong>[${inc.id}] ${inc.title}</strong><br/>
            <span style="color:${isCritical ? '#EF4444' : '#F59E0B'}; font-weight:bold;">${inc.severity} [ILLUSTRATIVE SCENARIO]</span>
          </div>
        `, { direction: 'top', offset: [0, -18], className: 'gis-tooltip' });

        const popupContent = `
          <div style="padding:4px 2px; font-family:'Inter',sans-serif; min-width:240px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
              <span style="font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:bold; color:#FB923C;">${inc.id}</span>
              <span style="background:${isCritical ? '#DC2626' : '#D97706'}; color:white; font-size:9px; font-weight:bold; padding:1px 5px; border-radius:3px;">
                ${inc.severity} [SCENARIO]
              </span>
            </div>
            <div style="font-size:12px; font-weight:bold; color:#FFFFFF; margin-bottom:3px;">${inc.title}</div>
            <div style="font-size:11px; color:#D1D5DB;">District: ${inc.district} • Casualties: ${inc.casualtyEstimate}</div>
            <div style="font-size:10px; color:#9CA3AF; margin-top:4px; border-top:1px solid #374151; padding-top:4px;">
              Target Hospital: <strong>${inc.targetHospitalName}</strong>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          setActiveFeatureInfo({ type: 'incident', data: inc });
          if (onSelectIncident) onSelectIncident(inc);
        });

        incGroup.addLayer(marker);
      });
    }

    // Routes
    if (visibleLayers.routes) {
      BENCHMARK_INCIDENTS.forEach((inc) => {
        const isSelected = selectedIncident?.id === inc.id;
        if (inc.routeWaypoints && inc.routeWaypoints.length > 1) {
          const polyline = L.polyline(inc.routeWaypoints, {
            color: isSelected ? '#D9531E' : '#78716C',
            weight: isSelected ? 4 : 2,
            opacity: isSelected ? 0.95 : 0.5,
            dashArray: isSelected ? '6, 6' : '3, 6'
          });

          polyline.bindTooltip(`
            <div>
              <strong>Route: ${inc.id} Transit Corridor</strong><br/>
              <span style="color:#FB923C;">To: ${inc.targetHospitalName}</span> [SCENARIO GEOMETRY]
            </div>
          `, { sticky: true, className: 'gis-tooltip' });

          routeGroup.addLayer(polyline);
        }
      });
    }
  }, [visibleLayers.incidents, visibleLayers.routes, selectedIncident, missionData]);

  // 6. Stage 3 Single-Incident Mission Layers (Incident, Base, Hospital, OSRM Road Routes, Animated Vehicle)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const missionGroup = layerGroupsRef.current.mission;
    if (!map || !missionGroup) return;

    missionGroup.clearLayers();

    if (!missionData) return;

    const { incident, ambulance, hospital, routes, simulationState, hospitalDecisionAudit } = missionData;

    // 1. Plot Custom Mission Incident Marker
    if (incident && incident.lat && incident.lng) {
      const isCritical = incident.severity === 'CRITICAL';
      const isHigh = incident.severity === 'HIGH';
      const color = isCritical ? '#DC2626' : isHigh ? '#D97706' : '#EA580C';

      const incIcon = L.divIcon({
        className: 'sim-incident-marker',
        html: `
          <div style="position:relative; width:40px; height:40px; cursor:pointer;" title="${incident.title}">
            <div style="position:absolute; inset:0; border-radius:50%; background:${color}; opacity:0.35; animation:beacon-ping 1.3s infinite;"></div>
            <div style="position:absolute; inset:4px; border-radius:50%; background:${color}; border:2px solid #FFFFFF; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
              <span style="color:white; font-size:12px; font-weight:bold;">⚠️</span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const incMarker = L.marker([incident.lat, incident.lng], { icon: incIcon });
      incMarker.bindTooltip(`
        <div>
          <strong>[MISSION INCIDENT] ${incident.title}</strong><br/>
          <span style="color:${color}; font-weight:bold;">${incident.type} • ${incident.severity}</span><br/>
          <span>Total Casualties: ${incident.totalCasualties} (${incident.criticalCasualties} critical)</span>
        </div>
      `, { direction: 'top', offset: [0, -20], className: 'gis-tooltip' });

      incMarker.bindPopup(`
        <div style="padding:6px 2px; font-family:'Inter',sans-serif; min-width:240px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:bold; color:${color}; text-transform:uppercase;">
              ${incident.type}
            </span>
            <span style="background:${color}; color:white; font-size:9px; font-weight:bold; padding:1px 6px; border-radius:3px;">
              ${incident.severity}
            </span>
          </div>
          <div style="font-size:13px; font-weight:bold; color:#FFFFFF; margin-bottom:4px;">
            ${incident.title}
          </div>
          <div style="font-size:11px; color:#D1D5DB; margin-bottom:6px;">
            Total Casualties: <strong style="color:#FFFFFF;">${incident.totalCasualties}</strong> (${incident.criticalCasualties} critical)
          </div>
          ${incident.description ? `<p style="font-size:10px; color:#9CA3AF; margin-bottom:6px; line-height:1.3;">${incident.description}</p>` : ''}
          <div style="font-size:10px; color:#9CA3AF; border-top:1px solid #374151; padding-top:4px;">
            Coordinates: [${incident.lat.toFixed(4)}°N, ${incident.lng.toFixed(4)}°E]
          </div>
        </div>
      `);

      missionGroup.addLayer(incMarker);
    }

    // 2. Plot Ambulance Base Marker
    if (ambulance && ambulance.lat && ambulance.lng) {
      const baseIcon = L.divIcon({
        className: 'sim-base-marker',
        html: `
          <div style="position:relative; width:34px; height:34px; cursor:pointer;" title="${ambulance.baseName}">
            <div style="width:34px; height:34px; border-radius:8px; background:#1E293B; border:2px solid #38BDF8; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.5);">
              <span style="font-size:11px;">🏬</span>
              <span style="color:#38BDF8; font-family:'JetBrains Mono',monospace; font-size:7px; font-weight:800; line-height:1;">DEPOT</span>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const baseMarker = L.marker([ambulance.lat, ambulance.lng], { icon: baseIcon });
      baseMarker.bindTooltip(`
        <div>
          <strong>${ambulance.baseName}</strong><br/>
          <span style="color:#38BDF8;">Assigned: ${ambulance.callsign} (${ambulance.type})</span><br/>
          <span style="color:#94A3B8; font-size:9px;">[SCENARIO ASSUMED BASE]</span>
        </div>
      `, { direction: 'top', offset: [0, -18], className: 'gis-tooltip' });

      baseMarker.bindPopup(`
        <div style="padding:6px 2px; font-family:'Inter',sans-serif; min-width:240px;">
          <div style="font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:bold; color:#38BDF8; text-transform:uppercase; margin-bottom:2px;">
            Scenario Ambulance Depot
          </div>
          <div style="font-size:13px; font-weight:bold; color:#FFFFFF; margin-bottom:4px;">
            ${ambulance.baseName}
          </div>
          <div style="font-size:11px; color:#D1D5DB; margin-bottom:4px;">
            Assigned Vehicle: <strong style="color:#FFFFFF;">${ambulance.callsign}</strong> (${ambulance.type})
          </div>
          <div style="font-size:10px; color:#9CA3AF; line-height:1.3; border-top:1px solid #374151; padding-top:4px;">
            <strong>Data Note:</strong> Illustrative scenario base location. Official 108 records report district-level counts only.
          </div>
        </div>
      `);

      missionGroup.addLayer(baseMarker);
    }

    // 3. Highlight Selected Hospital
    if (hospital && hospital.lat && hospital.lng) {
      const hospHighlightIcon = L.divIcon({
        className: 'sim-hosp-highlight',
        html: `
          <div style="position:relative; width:36px; height:36px; cursor:pointer;" title="Destination Hospital: ${hospital.name}">
            <div style="position:absolute; inset:0; border-radius:8px; border:2.5px solid #14B8A6; animation:beacon-ping 1.6s infinite; opacity:0.7;"></div>
            <div style="position:absolute; inset:3px; border-radius:6px; background:#0F766E; border:2px solid #FFFFFF; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.5);">
              <span style="color:white; font-size:10px; font-weight:900;">H</span>
              <span style="color:#99F6E4; font-family:'JetBrains Mono',monospace; font-size:6px; font-weight:800; line-height:1;">${hospitalDecisionAudit?.source === 'OPERATOR SELECTION' ? 'OVERRIDE' : 'TARGET'}</span>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const hospMarker = L.marker([hospital.lat, hospital.lng], { icon: hospHighlightIcon });
      hospMarker.bindTooltip(`
        <div>
        <strong>[${hospitalDecisionAudit?.source || 'DESTINATION HOSPITAL'}] ${hospital.name}</strong><br/>
          <span style="color:#2DD4BF;">${hospital.type || 'Hospital Facility'} • ${hospital.district}</span>
        </div>
      `, { direction: 'top', offset: [0, -18], className: 'gis-tooltip' });

      hospMarker.bindPopup(`
        <div style="padding:6px 2px; font-family:'Inter',sans-serif; min-width:240px;">
          <div style="font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:bold; color:#2DD4BF; text-transform:uppercase; margin-bottom:2px;">
            Destination Hospital
          </div>
          <div style="font-size:13px; font-weight:bold; color:#FFFFFF; margin-bottom:4px;">
            ${hospital.name}
          </div>
          <div style="font-size:11px; color:#D1D5DB; margin-bottom:4px;">
            District: <strong style="color:#FFFFFF;">${hospital.district}</strong> • ${hospital.type || 'Hospital'}
          </div>
          ${hospital.address ? `<div style="font-size:10px; color:#9CA3AF; margin-bottom:4px;">Address: ${hospital.address}</div>` : ''}
          <div style="font-size:10px; color:#9CA3AF; border-top:1px solid #374151; padding-top:4px;">
            Coordinates: [${hospital.lat}, ${hospital.lng}]
          </div>
        </div>
      `);

      missionGroup.addLayer(hospMarker);
    }

    // 4. Plot Calculated Road Routes (Leg 1 & Leg 2)
    if (routes) {
      if (routes.leg1?.coordinates?.length > 1) {
        const validCoords1 = routes.leg1.coordinates.filter(
          (pt) => Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])
        );
        if (validCoords1.length > 1) {
          const polyLeg1 = L.polyline(validCoords1, {
            color: '#D9531E',
            weight: 4,
            opacity: 0.9,
            dashArray: '6, 6'
          });
          polyLeg1.bindTooltip(`
            <div>
              <strong>Leg 1: Base to Incident Scene</strong><br/>
              <span>Distance: ${routes.leg1.distanceKm} km • ~${routes.leg1.durationMins}m</span><br/>
              <span style="color:#FB923C; font-size:9px;">${routes.leg1.source}</span>
            </div>
          `, { sticky: true, className: 'gis-tooltip' });
          missionGroup.addLayer(polyLeg1);
        }
      }

      if (routes.leg2?.coordinates?.length > 1) {
        const validCoords2 = routes.leg2.coordinates.filter(
          (pt) => Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])
        );
        if (validCoords2.length > 1) {
          const polyLeg2 = L.polyline(validCoords2, {
            color: '#0F766E',
            weight: 4,
            opacity: 0.9
          });
          polyLeg2.bindTooltip(`
            <div>
              <strong>Leg 2: Incident to Hospital</strong><br/>
              <span>Distance: ${routes.leg2.distanceKm} km • ~${routes.leg2.durationMins}m</span><br/>
              <span style="color:#2DD4BF; font-size:9px;">${routes.leg2.source}</span>
            </div>
          `, { sticky: true, className: 'gis-tooltip' });
          missionGroup.addLayer(polyLeg2);
        }
      }
    }

    // 5. Plot Moving Vehicle & Traveled Trail
    if (simulationState?.currentVehiclePos && typeof simulationState.currentVehiclePos.lat === 'number' && !isNaN(simulationState.currentVehiclePos.lat) && typeof simulationState.currentVehiclePos.lng === 'number' && !isNaN(simulationState.currentVehiclePos.lng)) {
      const pos = simulationState.currentVehiclePos;
      const vehicleIcon = L.divIcon({
        className: 'sim-moving-ambulance',
        html: `
          <div style="position:relative; width:40px; height:40px;">
            <div style="position:absolute; inset:0; border-radius:50%; background:#D9531E; opacity:0.4; animation:beacon-ping 1.1s infinite;"></div>
            <div style="position:absolute; inset:4px; border-radius:8px; background:#181B1E; border:2px solid #D9531E; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(217,83,30,0.6);">
              <span style="font-size:12px; line-height:1;">🚑</span>
              <span style="color:#FB923C; font-family:'JetBrains Mono',monospace; font-size:7px; font-weight:800; line-height:1; margin-top:1px;">
                ${simulationState.callsign ? simulationState.callsign.split('-')[0] : 'AMB'}
              </span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const vehMarker = L.marker([pos.lat, pos.lng], { icon: vehicleIcon });
      vehMarker.bindTooltip(`
        <div>
          <strong>${simulationState.callsign || 'Ambulance'} (En Route)</strong><br/>
          <span style="color:#FB923C;">Phase: ${simulationState.currentPhase || 'In Transit'}</span>
        </div>
      `, { direction: 'top', offset: [0, -20], className: 'gis-tooltip' });

      missionGroup.addLayer(vehMarker);

      if (simulationState.traveledWaypoints && simulationState.traveledWaypoints.length > 1) {
        const validTrail = simulationState.traveledWaypoints.filter(
          (pt) => Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])
        );
        if (validTrail.length > 1) {
          const trail = L.polyline(validTrail, {
            color: '#D9531E',
            weight: 5,
            opacity: 0.95
          });
          missionGroup.addLayer(trail);
        }
      }
    }

    // Fit map bounds to show complete mission if routes exist
    if (routes && routes.leg1?.coordinates && routes.leg2?.coordinates && !simulationState?.isPlaying) {
      const allCoords = [...routes.leg1.coordinates, ...routes.leg2.coordinates].filter(
        (pt) => Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])
      );
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    } else if (incident && !simulationState?.isPlaying && incident.lat && incident.lng) {
      map.flyTo([incident.lat, incident.lng], 10, { duration: 1.0 });
    }
  }, [missionData]);

  // 7. Progressive candidate routes from actual routing results (or explicitly labeled fallback).
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupsRef.current.discovery;
    if (!map || !group) return;
    group.clearLayers();
    if (!discoveryData) return;

    const bestHospital = discoveryData.hospitals?.filter((candidate) => candidate.eligible)
      .sort((a, b) => a.route?.durationMins - b.route?.durationMins)[0];

    discoveryData.hospitals?.forEach((candidate) => {
      const isBest = bestHospital?.id === candidate.id;
      const isEligible = candidate.eligibility === 'ELIGIBLE';
      const isUnsuitable = candidate.eligibility === 'INELIGIBLE';
      const route = candidate.route;

      if (route?.coordinates?.length > 1) {
        // Animate candidate route lines spreading from the incident:
        // - Best eligible hospital: bright red, glowing pulse, weight 6
        // - Eligible alternatives: highlighted teal, weight 3.5, dashed
        // - Ineligible / unsuitable: muted stone grey, weight 2, dotted
        const polylineColor = isBest ? '#DC2626' : isEligible ? '#0D9488' : '#78716C';
        const polylineWeight = isBest ? 6 : isEligible ? 3.5 : 2;
        const polylineOpacity = isBest ? 1.0 : isEligible ? 0.8 : 0.4;
        const polylineDash = isBest ? null : isEligible ? '6, 6' : '3, 8';
        const polylineClass = isBest ? 'recommended-route-glow' : 'candidate-route-spread';

        L.polyline(route.coordinates, {
          color: polylineColor,
          weight: polylineWeight,
          opacity: polylineOpacity,
          dashArray: polylineDash,
          className: polylineClass
        }).bindTooltip(`
          <div style="font-family:'Inter',sans-serif;">
            <div style="font-size:10px; font-weight:bold; color:${isBest ? '#EF4444' : isEligible ? '#2DD4BF' : '#A8A29E'}; text-transform:uppercase;">
              ${isBest ? '★ SYSTEM RECOMMENDATION: NEAREST APPROPRIATE' : isEligible ? 'ELIGIBLE ALTERNATIVE' : 'UNSUITABLE FACILITY'}
            </div>
            <strong>${candidate.name}</strong><br/>
            <span>Road Distance: <b>${route.distanceKm} km</b> · ETA: <b>${route.durationMins} min</b></span><br/>
            ${isUnsuitable ? `<span style="color:#F87171;">Rejection: ${candidate.rejectionReason}</span><br/>` : ''}
            <span style="color:#9CA3AF; font-size:9px;">${route.isFallback ? 'Geometric fallback estimate' : 'Verified OSRM road geometry'}</span>
          </div>
        `, { sticky: true, className: 'gis-tooltip' }).addTo(group);
      }

      // Hospital Node Marker on the Discovery Layer
      if (candidate.lat && candidate.lng) {
        if (isBest) {
          // Highlight Recommended Hospital with pulsing red ring
          const recIcon = L.divIcon({
            className: 'rec-hosp-marker',
            html: `
              <div style="position:relative; width:38px; height:38px; cursor:pointer;" title="${candidate.name}">
                <div style="position:absolute; inset:0; border-radius:50%; background:#DC2626; opacity:0.5; animation:beacon-ping 1.2s infinite;"></div>
                <div style="position:absolute; inset:3px; border-radius:8px; background:#DC2626; border:2.5px solid #FFFFFF; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(220,38,38,0.7);">
                  <span style="color:white; font-size:11px; font-weight:900;">H</span>
                  <span style="color:#FEE2E2; font-family:'JetBrains Mono',monospace; font-size:6px; font-weight:900; line-height:1;">REC</span>
                </div>
              </div>
            `,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
          });
          L.marker([candidate.lat, candidate.lng], { icon: recIcon })
            .bindTooltip(`
              <div>
                <strong style="color:#EF4444;">★ SYSTEM RECOMMENDATION: NEAREST APPROPRIATE</strong><br/>
                <strong>${candidate.name}</strong><br/>
                <span>${route ? `${route.durationMins} min · ${route.distanceKm} km` : ''}</span><br/>
                <span style="color:#10B981; font-size:10px;">Passed all mandatory clinical checks & capacity</span>
              </div>
            `, { direction: 'top', offset: [0, -18], className: 'gis-tooltip' })
            .addTo(group);
        } else {
          // Alternative or Ineligible markers
          L.circleMarker([candidate.lat, candidate.lng], {
            radius: isEligible ? 7 : 5,
            color: isEligible ? '#0F766E' : isUnsuitable ? '#991B1B' : '#57534E',
            weight: isEligible ? 2.5 : 1.5,
            fillColor: isEligible ? '#14B8A6' : isUnsuitable ? '#78716C' : '#A8A29E',
            fillOpacity: isEligible ? 0.95 : 0.65
          }).bindTooltip(`
            <div>
              <strong>${candidate.name}</strong><br/>
              <span style="color:${isEligible ? '#2DD4BF' : '#F87171'}; font-weight:bold;">${candidate.eligibility}</span><br/>
              ${candidate.rejectionReason ? `<span style="color:#D1D5DB; font-size:10px;">${candidate.rejectionReason}</span><br/>` : ''}
              ${route ? `<span style="font-size:10px;">${route.durationMins} min · ${route.distanceKm} km</span>` : ''}
            </div>
          `, { className: 'gis-tooltip' }).addTo(group);
        }
      }
    });

    discoveryData.ambulances?.forEach((candidate, index) => {
      const best = discoveryData.ambulances.filter((a) => a.available && a.suitable)
        .sort((a, b) => a.route?.durationMins - b.route?.durationMins)[0]?.id === candidate.id;
      if (candidate.route?.coordinates?.length > 1) {
        L.polyline(candidate.route.coordinates, {
          color: best ? '#EA580C' : '#44403C',
          weight: best ? 4 : 1.5,
          opacity: best ? 0.9 : 0.35,
          dashArray: best ? '8, 5' : '3, 7'
        }).bindTooltip(`
          <div>
            <strong>${candidate.id} (${candidate.type})</strong><br/>
            <span>${candidate.route.distanceKm} km · ~${candidate.route.durationMins} min</span><br/>
            <span style="color:#FB923C; font-size:9px;">${candidate.baseName}</span>
          </div>
        `, { className: 'gis-tooltip' }).addTo(group);
      }
      L.circleMarker([candidate.lat, candidate.lng], {
        radius: best ? 8 : 5,
        color: best ? '#EA580C' : '#292524',
        weight: 2,
        fillColor: best ? '#FB923C' : (index % 2 ? '#78716C' : '#44403C'),
        fillOpacity: 0.95
      }).bindTooltip(`${candidate.id} · ${candidate.baseName}${best ? ' · RECOMMENDED AMBULANCE' : ''}`, { className: 'gis-tooltip' }).addTo(group);
    });
  }, [discoveryData]);

  // 8. Handle User Map Selection Pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    const pinGroup = layerGroupsRef.current.selectionPin;
    if (!map || !pinGroup) return;

    pinGroup.clearLayers();

    if (selectedMapCoord) {
      const pinIcon = L.divIcon({
        className: 'selected-coord-pin',
        html: `
          <div style="position:relative; width:34px; height:34px;">
            <div style="position:absolute; inset:0; border-radius:50%; border:2px dashed #D9531E; animation:beacon-ping 1.8s infinite; opacity:0.8;"></div>
            <div style="position:absolute; inset:5px; border-radius:50%; background:#D9531E; border:2px solid #FFFFFF; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.5);">
              <span style="color:white; font-size:12px; font-weight:bold;">📍</span>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const pinMarker = L.marker([selectedMapCoord.lat, selectedMapCoord.lng], { icon: pinIcon });

      pinMarker.bindPopup(`
        <div style="padding:4px 2px; font-family:'Inter',sans-serif; min-width:200px;">
          <div style="font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:bold; color:#FB923C; text-transform:uppercase;">
            Captured Map Coordinate
          </div>
          <div style="font-size:12px; font-weight:bold; color:#FFFFFF; margin:3px 0;">
            ${selectedMapCoord.lat}°N, ${selectedMapCoord.lng}°E
          </div>
          <div style="font-size:10px; color:#9CA3AF; line-height:1.3;">
            Selected via 2D GIS map click. Available for scenario incident positioning and spatial routing.
          </div>
        </div>
      `).openPopup();

      pinGroup.addLayer(pinMarker);
    }
  }, [selectedMapCoord]);

  // Pan to selected item
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedIncident) {
      map.flyTo([selectedIncident.lat, selectedIncident.lng], 10, { duration: 1.2 });
    }
  }, [selectedIncident]);

  const toggleLayer = (key) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const resetToTamilNadu = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([10.9, 78.7], 7.2, { duration: 1 });
  };

  const handleCopyCoord = () => {
    if (!selectedMapCoord) return;
    const text = `${selectedMapCoord.lat}, ${selectedMapCoord.lng}`;
    navigator.clipboard?.writeText(text);
    setIsCopiedCoord(true);
    setTimeout(() => setIsCopiedCoord(false), 1500);
  };

  return (
    <div className="relative w-full h-[580px] rounded-xl border border-ivory-border overflow-hidden bg-ivory-200 shadow-xs flex flex-col">
      {/* Top Map Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Telemetry Coordinates Box */}
        <div className="bg-graphite-900 border border-graphite-border px-3 py-1.5 rounded-lg text-xs text-stone-100 shadow-md flex items-center gap-3 pointer-events-auto" style={{ backgroundColor: '#171A1D', color: '#F5F5F4' }}>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-burnt-400 font-semibold">
            <Compass className="w-3.5 h-3.5 text-burnt-500 animate-spin-slow" />
            <span>TAMIL NADU GIS</span>
          </div>
          <span className="text-graphite-700">|</span>
          <div className="font-mono text-[11px] text-stone-300">
            {mapCoordHover.lat}°N, {mapCoordHover.lng}°E
          </div>
          <span className="text-graphite-700">|</span>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-tealops-800/80 text-tealops-200 border border-tealops-700 font-mono">
            OSM Standard Raster
          </span>
        </div>

        {/* Right Layer Toggles Bar */}
        <div className="flex items-center gap-1.5 bg-graphite-900 border border-graphite-border p-1 rounded-lg shadow-md pointer-events-auto" style={{ backgroundColor: '#171A1D', color: '#F5F5F4' }}>
          {/* Hospitals Toggle */}
          <button
            onClick={() => toggleLayer('hospitals')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
              visibleLayers.hospitals
                ? 'bg-tealops-700 text-white shadow-xs'
                : 'text-stone-400 hover:text-white'
            }`}
            title="Toggle 339 Mapped Hospitals Layer"
          >
            <span className="w-2 h-2 rounded-full bg-tealops-300" />
            <span>Hospitals (339)</span>
          </button>

          {/* Settlements Toggle */}
          <button
            onClick={() => toggleLayer('settlements')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
              visibleLayers.settlements
                ? 'bg-stone-600 text-white shadow-xs'
                : 'text-stone-400 hover:text-white'
            }`}
            title="Toggle 2,391 Village Settlement Coordinates Layer"
          >
            <span className="w-2 h-2 rounded-full bg-stone-300" />
            <span>Settlements (2,391)</span>
          </button>

          {/* Potential Hospital Access Gaps */}
          <button
            onClick={() => toggleLayer('vulnerability')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
              visibleLayers.vulnerability ? 'bg-critical-700 text-white shadow-xs' : 'text-stone-300 hover:text-white'
            }`}
            title={`Toggle settlements more than ${HOSPITAL_ACCESS_GAP_KM} km from a mapped hospital; ambulance proximity is unknown`}
            aria-pressed={visibleLayers.vulnerability}
          >
            <span className="w-2 h-2 rounded-full bg-orange-300" />
            <span>Potential Gaps ({vulnerabilitySettlements.length})</span>
          </button>

          {/* District Ambulance Fleet Toggle */}
          <button
            onClick={() => toggleLayer('fleet')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
              visibleLayers.fleet
                ? 'bg-burnt-600 text-white shadow-xs'
                : 'text-stone-400 hover:text-white'
            }`}
            title="Toggle 38 District Ambulance Fleet Totals (1,353)"
          >
            <span className="w-2 h-2 rounded-full bg-burnt-300" />
            <span>Fleet (38 Districts)</span>
          </button>

          {/* Incidents Toggle */}
          <button
            onClick={() => toggleLayer('incidents')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
              visibleLayers.incidents
                ? 'bg-critical-600 text-white shadow-xs'
                : 'text-stone-400 hover:text-white'
            }`}
            title="Toggle Benchmark Incidents Layer"
          >
            <span className="w-2 h-2 rounded-full bg-critical-300" />
            <span>Incidents</span>
          </button>

          {/* Routes Toggle */}
          <button
            onClick={() => toggleLayer('routes')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
              visibleLayers.routes
                ? 'bg-graphite-700 text-white shadow-xs'
                : 'text-stone-400 hover:text-white'
            }`}
            title="Toggle Highway Transit Corridors Layer"
          >
            <Navigation className="w-3 h-3" />
            <span>Routes</span>
          </button>

          {/* Reset to TN Center Button */}
          <button
            onClick={resetToTamilNadu}
            className="p-1.5 rounded text-stone-400 hover:text-white hover:bg-graphite-800 transition-colors ml-1"
            title="Recenter Map to Tamil Nadu (10.9°N, 78.7°E)"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Selected Coordinate Indicator Bar (When user clicks map) */}
      {selectedMapCoord && (
        <div className="absolute top-14 left-3 z-[1000] bg-graphite-900/95 backdrop-blur-xs border border-burnt-500/50 px-3 py-1.5 rounded-lg text-xs text-stone-200 shadow-xl flex items-center gap-3 animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-burnt-500 animate-ping shrink-0" />
          <div>
            <span className="text-[9px] uppercase font-bold text-burnt-400 block font-mono">Map Coordinate Selected</span>
            <span className="font-mono text-white text-xs font-bold">{selectedMapCoord.lat}°N, {selectedMapCoord.lng}°E</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleCopyCoord}
              className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-700 text-stone-300 text-[10px] font-mono border border-graphite-700 flex items-center gap-1 transition-colors"
              title="Copy latitude and longitude to clipboard"
            >
              {isCopiedCoord ? <Check className="w-3 h-3 text-tealops-400" /> : <Copy className="w-3 h-3 text-stone-400" />}
              <span>{isCopiedCoord ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => setSelectedMapCoord(null)}
              className="px-1.5 py-0.5 rounded bg-graphite-800 hover:bg-graphite-700 text-stone-400 hover:text-white text-[10px] border border-graphite-700 transition-colors"
              title="Clear selected coordinate pin"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Leaflet Map DOM Canvas */}
      <div
        ref={mapContainerRef}
        id="pals-leaflet-map"
        className="w-full h-full z-0 cursor-crosshair"
      />

      {/* Selected Feature Card Drawer (When clicking a hospital, settlement, or fleet record) */}
      {activeFeatureInfo && (
        <div className="absolute bottom-10 left-3 z-[1000] max-w-sm w-full bg-graphite-900/95 backdrop-blur-sm border border-graphite-border rounded-xl p-3.5 text-xs text-stone-200 shadow-xl animate-in fade-in duration-150">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-burnt-400">
              {activeFeatureInfo.type === 'hospital' && 'Hospital Facility Inspector'}
              {activeFeatureInfo.type === 'fleet' && 'District Ambulance Record'}
              {activeFeatureInfo.type === 'settlement' && 'Village Settlement Record'}
              {activeFeatureInfo.type === 'incident' && 'Benchmark Incident File'}
            </span>
            <button
              onClick={() => setActiveFeatureInfo(null)}
              className="text-stone-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>

          {activeFeatureInfo.type === 'hospital' && (
            <div className="mt-1.5 space-y-1">
              <h4 className="text-sm font-bold text-white leading-tight">{activeFeatureInfo.data.name}</h4>
              <p className="text-[11px] text-tealops-300 font-semibold">{activeFeatureInfo.data.type || 'Hospital'}</p>
              <p className="text-[11px] text-stone-400">District: {activeFeatureInfo.data.district} {activeFeatureInfo.data.pin ? `(PIN: ${activeFeatureInfo.data.pin})` : ''}</p>
              {activeFeatureInfo.data.address && (
                <p className="text-[10px] text-stone-400 leading-snug">Address: {activeFeatureInfo.data.address}</p>
              )}
              <div className="mt-2 pt-1.5 border-t border-graphite-border flex justify-between text-[10px] text-stone-400 font-mono">
                <span>Confidence: <strong className="text-tealops-300">{activeFeatureInfo.data.confidence || 'Medium'}</strong></span>
                <span>[{activeFeatureInfo.data.lat}, {activeFeatureInfo.data.lng}]</span>
              </div>
            </div>
          )}

          {activeFeatureInfo.type === 'fleet' && (
            <div className="mt-1.5 space-y-1">
              <h4 className="text-sm font-bold text-white">{activeFeatureInfo.data.district} District HQ</h4>
              <div className="grid grid-cols-3 gap-1.5 my-2 font-mono text-[11px]">
                <div className="p-1.5 bg-graphite-950 rounded border border-graphite-800">
                  <span className="text-[9px] text-stone-400 block">ALS</span>
                  <strong className="text-white">{activeFeatureInfo.data.als}</strong>
                </div>
                <div className="p-1.5 bg-graphite-950 rounded border border-graphite-800">
                  <span className="text-[9px] text-stone-400 block">BLS</span>
                  <strong className="text-white">{activeFeatureInfo.data.bls}</strong>
                </div>
                <div className="p-1.5 bg-graphite-950 rounded border border-graphite-800">
                  <span className="text-[9px] text-stone-400 block">TOTAL</span>
                  <strong className="text-tealops-300">{activeFeatureInfo.data.totalAmbulances}</strong>
                </div>
              </div>
              <p className="text-[10px] text-stone-400">FR Bikes: {activeFeatureInfo.data.frBikes} | NLS: {activeFeatureInfo.data.nls} | VVIP: {activeFeatureInfo.data.vvip}</p>
              <div className="mt-2 pt-1.5 border-t border-graphite-border text-[9px] text-stone-400 leading-tight space-y-0.5">
                <p><strong>Coordinate Source:</strong> District Headquarters center (${activeFeatureInfo.data.lat}°N, ${activeFeatureInfo.data.lng}°E).</p>
                <p><strong>Aggregation:</strong> District-level total. Station-level GPS locations are not published in public releases. Individual ambulance coordinates are not invented.</p>
              </div>
            </div>
          )}

          {activeFeatureInfo.type === 'settlement' && (
            <div className="mt-1.5 space-y-1">
              <h4 className="text-sm font-bold text-white">{activeFeatureInfo.data.name}</h4>
              <p className="text-[11px] text-stone-300">{activeFeatureInfo.data.nativeName}</p>
              <p className="text-[11px] text-stone-400">District: {activeFeatureInfo.data.district} • Taluk: {activeFeatureInfo.data.taluk}</p>
              <div className="mt-2 pt-1.5 border-t border-graphite-border flex justify-between text-[10px] text-stone-400 font-mono">
                <span>LGD Code: {activeFeatureInfo.data.code}</span>
                <span>[{activeFeatureInfo.data.lat}, {activeFeatureInfo.data.lng}]</span>
              </div>
            </div>
          )}

          {activeFeatureInfo.type === 'incident' && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">{activeFeatureInfo.data.title}</h4>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-critical-900 text-critical-200 border border-critical-700">
                  {activeFeatureInfo.data.severity}
                </span>
              </div>
              <p className="text-[11px] text-stone-300">{activeFeatureInfo.data.type} • {activeFeatureInfo.data.district}</p>
              <p className="text-[11px] text-stone-400">Estimated Casualties: {activeFeatureInfo.data.casualtyEstimate}</p>
              <p className="text-[11px] text-tealops-300">Target Hospital: {activeFeatureInfo.data.targetHospitalName}</p>
              <div className="mt-2 pt-1.5 border-t border-graphite-border text-[9px] text-amber-300 italic">
                Illustrative benchmark scenario for response simulation and algorithm evaluation.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Technical Status Bar */}
      <div className="absolute bottom-2 left-3 z-[1000] pointer-events-none">
        <div className="bg-graphite-900 border border-graphite-border px-3 py-1.5 rounded-lg text-[11px] text-stone-100 shadow-md flex items-center gap-3 pointer-events-auto" style={{ backgroundColor: '#171A1D', color: '#F5F5F4' }}>
          <span className="text-burnt-400 font-bold font-mono">DATASET VALIDATION:</span>
          <span>339 Hospitals Mapped</span>
          <span className="text-graphite-700">•</span>
          <span>2,391 Village Coordinates</span>
          <span className="text-graphite-700">•</span>
          <span>1,353 Fleet across 38 Districts</span>
          <span className="text-graphite-700">|</span>
          <span className="text-orange-200">{vulnerabilitySettlements.length} communities &gt;{HOSPITAL_ACCESS_GAP_KM} km from mapped hospitals • ambulance proximity unknown</span>
          <span className="text-graphite-700">|</span>
          <span className="text-tealops-300 font-mono">Zoom: {zoomLevel}x</span>
        </div>
      </div>
    </div>
  );
}
