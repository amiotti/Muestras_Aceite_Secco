"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { formatDateDayMonthYear, isValueOverLimit, LIMIT_SUMMARY_ROWS } from "@/lib/oil-helpers";

const DEFAULT_FILTERS = {
  areas: [],
  equipmentId: "",
  resultStatus: "ALL",
  operationMode: "GAS",
  sinceResultDate: "",
  untilResultDate: "",
  generalSearch: "",
  page: 1,
  pageSize: 20,
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function DashboardClient() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [areaOptions, setAreaOptions] = useState([]);
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [flash, setFlash] = useState(null);

  const [searchResult, setSearchResult] = useState(null);
  const [searchMetrics, setSearchMetrics] = useState({
    totalMatches: 0,
    pageCount: 0,
    readCount: 0,
    unreadCount: 0,
    statusCount: { NORMAL: 0, CAUTION: 0, ABNORMAL: 0, SEVERE: 0, UNKNOWN: 0 },
  });
  const [selectedEquipment, setSelectedEquipment] = useState(null);

  const [selectedSampleNumber, setSelectedSampleNumber] = useState("");
  const [sampleDetail, setSampleDetail] = useState(null);
  const [comparisonRows, setComparisonRows] = useState([]);
  const [trendChartsData, setTrendChartsData] = useState({ labels: [], charts: [] });

  const canvasRefs = useRef({});
  const chartInstances = useRef([]);

  useEffect(() => {
    const loadEquipment = async () => {
      try {
        setIsLoadingEquipment(true);
        const response = await fetch("/api/equipment", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "No fue posible cargar equipos.");

        setEquipmentOptions(Array.isArray(data.equipmentOptions) ? data.equipmentOptions : []);
        setAreaOptions(Array.isArray(data.areaOptions) ? data.areaOptions : []);
      } catch (error) {
        setFlash({ type: "error", message: error.message });
      } finally {
        setIsLoadingEquipment(false);
      }
    };

    loadEquipment();
  }, []);

  const selectedAreaSet = useMemo(
    () => new Set((filters.areas || []).map((item) => normalizeText(item))),
    [filters.areas]
  );

  const filteredEquipmentOptions = useMemo(() => {
    if (selectedAreaSet.size === 0) return equipmentOptions;
    return equipmentOptions.filter((item) => selectedAreaSet.has(normalizeText(item.area)));
  }, [equipmentOptions, selectedAreaSet]);

  useEffect(() => {
    if (!filters.equipmentId) {
      setSelectedEquipment(null);
      return;
    }

    const current = filteredEquipmentOptions.find(
      (item) => String(item.id) === String(filters.equipmentId)
    );

    if (!current) {
      setFilters((prev) => ({ ...prev, equipmentId: "" }));
      setSelectedEquipment(null);
      return;
    }

    setSelectedEquipment(current);
  }, [filters.equipmentId, filteredEquipmentOptions]);

  useEffect(() => {
    chartInstances.current.forEach((chart) => chart.destroy());
    chartInstances.current = [];

    if (!trendChartsData?.charts?.length) return;

    trendChartsData.charts.forEach((chartData) => {
      const canvas = canvasRefs.current[chartData.id];
      if (!canvas || !chartData.datasets?.length) return;

      const chart = new Chart(canvas, {
        type: "line",
        data: {
          labels: trendChartsData.labels || [],
          datasets: chartData.datasets.map((dataset) => ({
            ...dataset,
            fill: false,
            spanGaps: true,
            tension: 0.28,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "nearest", intersect: false },
          plugins: { legend: { position: "bottom" } },
          scales: {
            x: {
              ticks: { color: "#334966" },
              grid: { color: "rgba(0, 59, 112, 0.12)" },
            },
            y: {
              ticks: { color: "#334966" },
              grid: { color: "rgba(0, 59, 112, 0.12)" },
            },
          },
        },
      });

      chartInstances.current.push(chart);
    });

    return () => {
      chartInstances.current.forEach((chart) => chart.destroy());
      chartInstances.current = [];
    };
  }, [trendChartsData]);

  const handleAreaToggle = (area) => {
    setFilters((prev) => {
      const exists = prev.areas.includes(area);
      return {
        ...prev,
        areas: exists ? prev.areas.filter((item) => item !== area) : [...prev.areas, area],
      };
    });
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    try {
      setIsSearching(true);
      setFlash(null);

      const response = await fetch("/api/samples/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Error buscando muestras.");

      setSearchResult(data.searchResult || null);
      setSearchMetrics(data.searchMetrics || searchMetrics);
      setSelectedEquipment(data.selectedEquipment || null);
      setFlash({ type: "success", message: "Búsqueda ejecutada correctamente." });
    } catch (error) {
      setFlash({ type: "error", message: error.message });
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewSample = async (sampleNumber) => {
    try {
      setIsLoadingSample(true);
      setFlash(null);
      setSelectedSampleNumber(sampleNumber);

      const response = await fetch(`/api/samples/${sampleNumber}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No fue posible ver la muestra.");

      setSampleDetail(data.sampleDetail || null);
      setComparisonRows(Array.isArray(data.comparisonRows) ? data.comparisonRows : []);
      setTrendChartsData(data.trendChartsData || { labels: [], charts: [] });
      setFlash({ type: "success", message: `Muestra ${sampleNumber} cargada.` });
    } catch (error) {
      setSampleDetail(null);
      setComparisonRows([]);
      setTrendChartsData({ labels: [], charts: [] });
      setFlash({ type: "error", message: error.message });
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <main className="container">
      <section className="brand-bar">
        <a href="/dashboard" className="brand-secco" aria-label="Secco">
          <img src="/assets/secco-logo.svg" alt="Secco logo" />
        </a>
        <div className="brand-divider" aria-hidden="true" />
        <a
          href="https://www.wartsila.com"
          target="_blank"
          rel="noreferrer"
          className="brand-wartsila"
          aria-label="Wartsila"
        >
          <img src="/assets/wartsila-logo.png" alt="Wartsila logo" />
        </a>
      </section>

      {flash ? <div className={`flash ${flash.type}`}>{flash.message}</div> : null}

      <section className="card">
        <h2>Buscar muestras por equipo</h2>

        <form className="form-grid two-cols" onSubmit={handleSearch}>
          <div className="full-width area-selector">
            <span className="area-label">Área</span>
            <details className="area-dropdown">
              <summary>Seleccionar área(s)</summary>
              <div className="area-options">
                {areaOptions.map((area) => (
                  <label className="area-option" key={area}>
                    <input
                      type="checkbox"
                      checked={filters.areas.includes(area)}
                      onChange={() => handleAreaToggle(area)}
                    />
                    <span>{area}</span>
                  </label>
                ))}
              </div>
            </details>
            <div className="area-selected-list">
              {filters.areas.length > 0 ? (
                filters.areas.map((selectedArea) => (
                  <span key={selectedArea} className="area-chip">
                    {selectedArea}
                  </span>
                ))
              ) : (
                <span className="area-chip muted">Sin áreas seleccionadas</span>
              )}
            </div>
          </div>

          <label className="full-width">
            Equipo
            <select
              value={filters.equipmentId}
              onChange={(event) => setFilters((prev) => ({ ...prev, equipmentId: event.target.value }))}
            >
              <option value="">Todos los equipos del área seleccionada</option>
              {filteredEquipmentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Estado de resultado
            <select
              value={filters.resultStatus}
              onChange={(event) => setFilters((prev) => ({ ...prev, resultStatus: event.target.value }))}
            >
              <option value="ALL">Todos</option>
              <option value="NORMAL">Normal</option>
              <option value="CAUTION">Caution</option>
              <option value="ABNORMAL">Abnormal</option>
              <option value="SEVERE">Severe</option>
            </select>
          </label>

          <label>
            Operación / Límites
            <select
              value={filters.operationMode}
              onChange={(event) => setFilters((prev) => ({ ...prev, operationMode: event.target.value }))}
            >
              <option value="GAS">Gas</option>
              <option value="HFO">HFO</option>
            </select>
          </label>

          <label>
            Fecha resultado desde
            <input
              type="date"
              value={filters.sinceResultDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, sinceResultDate: event.target.value }))}
            />
          </label>

          <label>
            Fecha resultado hasta
            <input
              type="date"
              value={filters.untilResultDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, untilResultDate: event.target.value }))}
            />
          </label>

          <label>
            Texto libre
            <input
              type="text"
              placeholder="Nro muestra, compartimento, cliente, etc."
              value={filters.generalSearch}
              onChange={(event) => setFilters((prev) => ({ ...prev, generalSearch: event.target.value }))}
            />
          </label>

          <label>
            Página
            <input
              type="number"
              min="1"
              value={filters.page}
              onChange={(event) => setFilters((prev) => ({ ...prev, page: Number(event.target.value || 1) }))}
            />
          </label>

          <label>
            Tamaño página
            <input
              type="number"
              min="1"
              max="50"
              value={filters.pageSize}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, pageSize: Number(event.target.value || 20) }))
              }
            />
          </label>

          <div className="full-width form-actions-row">
            <button type="submit" disabled={isLoadingEquipment || isSearching}>
              {isLoadingEquipment ? "Cargando equipos..." : isSearching ? "Buscando..." : "Buscar muestras"}
            </button>
          </div>
        </form>
      </section>

      {selectedEquipment ? (
        <section className="card">
          <h2>Equipo seleccionado</h2>
          <div className="stats-grid equipment-grid">
            <article className="stat-card"><span className="label">ID</span><strong>{selectedEquipment.id}</strong></article>
            <article className="stat-card"><span className="label">Modelo</span><strong>{selectedEquipment.model || "-"}</strong></article>
            <article className="stat-card"><span className="label">Tag</span><strong>{selectedEquipment.tag || "-"}</strong></article>
            <article className="stat-card"><span className="label">Serie</span><strong>{selectedEquipment.serial || "-"}</strong></article>
            <article className="stat-card"><span className="label">Área</span><strong>{selectedEquipment.area || "-"}</strong></article>
            <article className="stat-card"><span className="label">Sector</span><strong>{selectedEquipment.sector || "-"}</strong></article>
            <article className="stat-card"><span className="label">Cliente</span><strong>{selectedEquipment.customer || "-"}</strong></article>
            <article className="stat-card"><span className="label">Sitio / Obra</span><strong>{selectedEquipment.site || "-"}</strong></article>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2>Resumen de la búsqueda</h2>
        <div className="stats-grid">
          <article className="stat-card"><span className="label">Coincidencias</span><strong>{searchMetrics.totalMatches}</strong></article>
          <article className="stat-card"><span className="label">Registros en esta página</span><strong>{searchMetrics.pageCount}</strong></article>
          <article className="stat-card"><span className="label">Leídos</span><strong>{searchMetrics.readCount}</strong></article>
          <article className="stat-card"><span className="label">No leídos</span><strong>{searchMetrics.unreadCount}</strong></article>
          <article className="stat-card status-normal"><span className="label">Normal</span><strong>{searchMetrics.statusCount.NORMAL}</strong></article>
          <article className="stat-card status-caution"><span className="label">Caution</span><strong>{searchMetrics.statusCount.CAUTION}</strong></article>
          <article className="stat-card status-abnormal"><span className="label">Abnormal</span><strong>{searchMetrics.statusCount.ABNORMAL}</strong></article>
          <article className="stat-card status-severe"><span className="label">Severe</span><strong>{searchMetrics.statusCount.SEVERE}</strong></article>
        </div>
      </section>

      <section className="card">
        <h2>Resultados de muestras</h2>

        {searchResult?.results?.length ? (
          <div className="table-wrapper samples-table-wrapper">
            <table className="samples-results-table">
              <thead>
                <tr>
                  <th>Muestra</th>
                  <th>Estado</th>
                  <th>Fecha resultado</th>
                  <th>Lectura</th>
                  <th>Compartimento</th>
                  <th>Equipo</th>
                  <th>Serie</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {searchResult.results.map((item) => {
                  const status = item.validResult?.resultStatus || item.result || "UNKNOWN";
                  return (
                    <tr key={item.sampleNumber}>
                      <td>{item.sampleNumber || "-"}</td>
                      <td><span className={`status-pill ${String(status).toLowerCase()}`}>{status}</span></td>
                      <td>{formatDateDayMonthYear(item.resultDate)}</td>
                      <td>{item.readingStatus === true ? "Leído" : item.readingStatus === false ? "No leído" : "-"}</td>
                      <td>{item.compartment?.name || item.collectionData?.compartmentName || "-"}</td>
                      <td>{item.equipment?.model || "-"}</td>
                      <td>{item.equipment?.serial || item.equipment?.chassiSerie || item.equipment?.serialNumber || "-"}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary btn-compact"
                          onClick={() => handleViewSample(item.sampleNumber)}
                          disabled={isLoadingSample}
                        >
                          Ver
                        </button>
                        <a className="secondary-link btn-compact" href={`/api/samples/${item.sampleNumber}/pdf`}>
                          PDF
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subtitle">Aún no hay resultados para mostrar.</p>
        )}
      </section>

      <section className="card">
        <h2>Comparativo últimas 10 muestras del equipo</h2>

        {sampleDetail ? (
          <>
            <p className="subtitle">Muestra seleccionada: <strong>{selectedSampleNumber}</strong></p>
            <p className="subtitle">Límites aplicados: <strong>{filters.operationMode}</strong></p>
            <p className="subtitle">
              <a className="secondary-link" href={`/api/samples/${selectedSampleNumber}/pdf`}>
                Exportar muestra seleccionada a PDF
              </a>
            </p>

            {comparisonRows.length > 0 ? (
              <>
                <h3 className="section-gap-title">Datos de la Muestra</h3>
                <div className="table-wrapper">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th colSpan="8">Datos de la muestra</th>
                        <th colSpan="13">Desgaste</th>
                        <th colSpan="4">Contaminantes</th>
                        <th colSpan="1">Agua</th>
                      </tr>
                      <tr>
                        <th>Muestra</th><th>Status</th><th>Muestreo</th><th>Recibido</th><th>Resultado</th><th>Horómetro</th><th>Cambio?</th><th>Adición</th>
                        <th>Fe</th><th>Cu</th><th>Cr</th><th>Pb</th><th>Sn</th><th>Ni</th><th>Mo</th><th>Ti</th><th>V</th><th>Mn</th><th>Cd</th><th>Ag</th><th>PQI</th>
                        <th>Si</th><th>Al</th><th>Na</th><th>K</th><th>Agua</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr key={row.sampleNumber}>
                          <td>{row.sampleNumber}</td>
                          <td><span className={`status-pill ${String(row.status || "unknown").toLowerCase()}`}>{row.status}</span></td>
                          <td>{row.sampledDate}</td>
                          <td>{row.receivedDate}</td>
                          <td>{row.resultDate}</td>
                          <td>{row.hourMeter}</td>
                          <td>{row.oilChanged}</td>
                          <td>{row.oilAdded}</td>
                          <td className={isValueOverLimit(filters.operationMode, "desgaste", "fe", row.desgaste.fe) ? "limit-hit" : ""}>{row.desgaste.fe}</td>
                          <td className={isValueOverLimit(filters.operationMode, "desgaste", "cu", row.desgaste.cu) ? "limit-hit" : ""}>{row.desgaste.cu}</td>
                          <td className={isValueOverLimit(filters.operationMode, "desgaste", "cr", row.desgaste.cr) ? "limit-hit" : ""}>{row.desgaste.cr}</td>
                          <td className={isValueOverLimit(filters.operationMode, "desgaste", "pb", row.desgaste.pb) ? "limit-hit" : ""}>{row.desgaste.pb}</td>
                          <td className={isValueOverLimit(filters.operationMode, "desgaste", "sn", row.desgaste.sn) ? "limit-hit" : ""}>{row.desgaste.sn}</td>
                          <td className={isValueOverLimit(filters.operationMode, "desgaste", "ni", row.desgaste.ni) ? "limit-hit" : ""}>{row.desgaste.ni}</td>
                          <td>{row.desgaste.mo}</td><td>{row.desgaste.ti}</td>
                          <td className={isValueOverLimit(filters.operationMode, "desgaste", "v", row.desgaste.v) ? "limit-hit" : ""}>{row.desgaste.v}</td>
                          <td>{row.desgaste.mn}</td><td>{row.desgaste.cd}</td><td>{row.desgaste.ag}</td><td>{row.desgaste.pqi}</td>
                          <td className={isValueOverLimit(filters.operationMode, "contaminantes", "si", row.contaminantes.si) ? "limit-hit" : ""}>{row.contaminantes.si}</td>
                          <td className={isValueOverLimit(filters.operationMode, "contaminantes", "al", row.contaminantes.al) ? "limit-hit" : ""}>{row.contaminantes.al}</td>
                          <td className={isValueOverLimit(filters.operationMode, "contaminantes", "na", row.contaminantes.na) ? "limit-hit" : ""}>{row.contaminantes.na}</td>
                          <td>{row.contaminantes.k}</td>
                          <td className={isValueOverLimit(filters.operationMode, "agua", "valor", row.agua.valor) ? "limit-hit" : ""}>{row.agua.valor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3>Condiciones del fluido / Aditivos</h3>
                <div className="table-wrapper">
                  <table className="comparison-table">
                    <thead>
                      <tr><th colSpan="11">Condiciones del fluido</th><th colSpan="6">Aditivos</th></tr>
                      <tr>
                        <th>Muestra</th><th>Fluido</th><th>Análisis visual</th><th>Viscosidad 100°C</th><th>Punto de inflamación</th><th>TAN</th><th>BN</th><th>Hollín-FTIR</th><th>Nitración-FTIR</th><th>Oxidación-FTIR</th><th>Sulfatación-FTIR</th>
                        <th>P</th><th>Zn</th><th>Ca</th><th>Mg</th><th>B</th><th>Ba</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr key={`cond-${row.sampleNumber}`}>
                          <td>{row.sampleNumber}</td>
                          <td>{row.fluidName}</td>
                          <td>{row.condiciones.analisisVisual}</td>
                          <td>{row.condiciones.v100}</td>
                          <td>{row.condiciones.flash}</td>
                          <td>{row.condiciones.tan}</td>
                          <td className={isValueOverLimit(filters.operationMode, "condiciones", "bn", row.condiciones.bn) ? "limit-hit" : ""}>{row.condiciones.bn}</td>
                          <td>{row.condiciones.hollin}</td>
                          <td>{row.condiciones.nitracao}</td>
                          <td>{row.condiciones.oxidacao}</td>
                          <td>{row.condiciones.sulfatacao}</td>
                          <td>{row.aditivos.p}</td><td>{row.aditivos.zn}</td><td>{row.aditivos.ca}</td><td>{row.aditivos.mg}</td><td>{row.aditivos.b}</td><td>{row.aditivos.ba}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {trendChartsData?.charts?.length ? (
                  <>
                    <h3>Gráficas de tendencia (últimas 10 muestras)</h3>
                    <div className="trend-grid">
                      {trendChartsData.charts.map((chart) => (
                        <article className="trend-card" key={chart.id}>
                          <h4>{chart.title}</h4>
                          <div className="trend-canvas-wrap">
                            <canvas ref={(el) => { canvasRefs.current[chart.id] = el; }} id={`trend-chart-${chart.id}`} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <p className="subtitle">No fue posible armar la comparación para este equipo.</p>
            )}

            <details>
              <summary>Ver JSON completo</summary>
              <pre>{JSON.stringify(sampleDetail, null, 2)}</pre>
            </details>
          </>
        ) : (
          <p className="subtitle">
            Selecciona una muestra para ver la tabla comparativa y las gráficas de últimas 10 muestras del equipo.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Pestaña: Límites (resumen)</h2>
        <div className="table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Sección</th>
                <th>Parámetro</th>
                <th>Límite GAS</th>
                <th>Límite HFO</th>
                <th>Fuente</th>
              </tr>
            </thead>
            <tbody>
              {LIMIT_SUMMARY_ROWS.map((row) => (
                <tr key={`${row.section}-${row.parameter}`}>
                  <td>{row.section}</td>
                  <td>{row.parameter}</td>
                  <td>{row.gas}</td>
                  <td>{row.hfo}</td>
                  <td>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

