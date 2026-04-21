export const SAMPLE_STATUSES = ["NORMAL", "CAUTION", "ABNORMAL", "SEVERE"];
export const OPERATION_MODES = ["GAS", "HFO"];
export const ALLOWED_EQUIPMENT_AREAS = ["perez", "canada", "villa ocampo"];

export const PARAMETER_ALIASES = {
  desgaste: {
    fe: ["fe", "hierro", "ferro", "iron"],
    cu: ["cu", "cobre", "copper"],
    cr: ["cr", "cromo", "chromium"],
    pb: ["pb", "plomo", "lead"],
    sn: ["sn", "estanho", "tin"],
    ni: ["ni", "niquel", "nickel"],
    mo: ["mo", "molibdeno", "molybdenum"],
    ti: ["ti", "titanio", "titanium"],
    v: ["v", "vanadio", "vanadium"],
    mn: ["mn", "manganeso", "manganese"],
    cd: ["cd", "cadmio", "cadmium"],
    ag: ["ag", "prata", "silver"],
    pqi: ["pqi", "indice pq", "pq index"],
  },
  contaminantes: {
    si: ["si", "silicio", "silicon"],
    al: ["al", "aluminio", "aluminum"],
    na: ["na", "sodio", "sodium"],
    k: ["k", "potasio", "potassium"],
  },
  agua: { agua: ["agua", "water", "kf", "kf vol", "crepitacao", "crepitacao"] },
  condiciones: {
    analisis_visual: ["analisis visual", "análise visual", "visual", "macroscopia"],
    v100: ["v100", "viscosidad 100", "viscosidade 100", "viscosity 100"],
    flash: ["ponto de inflamacao", "punto de inflamacion", "flash point"],
    tan: ["tan", "tan colorimetrico", "tan colorimétrico", "a/n"],
    bn: ["bn", "tbn", "b/n"],
    hollin: ["hollin", "fuligem", "soot"],
    nitracao: ["nitracao", "nitración", "nitration"],
    oxidacao: ["oxidacao", "oxidación", "oxidation"],
    sulfatacao: ["sulfatacao", "sulfatación", "sulfation"],
  },
  aditivos: {
    p: ["p", "fosforo", "phosphorus"],
    zn: ["zn", "zinco", "zinc"],
    ca: ["ca", "calcio", "calcium"],
    mg: ["mg", "magnesio", "magnésio", "magnesium"],
    b: ["b", "boro", "boron"],
    ba: ["ba", "bario", "barium"],
  },
};

export const LIMIT_PROFILES = {
  GAS: {
    desgaste: {
      fe: { type: "max", value: 25 },
      cr: { type: "max", value: 5 },
      sn: { type: "max", value: 5 },
      pb: { type: "max", value: 5 },
      cu: { type: "max", value: 15 },
      ni: { type: "max", value: 5 },
    },
    contaminantes: {
      si: { type: "max", value: 20 },
      na: { type: "max", value: 20 },
      al: { type: "max", value: 10 },
    },
    agua: {
      valor: { type: "max", value: 0.3 },
    },
  },
  HFO: {
    desgaste: {
      fe: { type: "max", value: 50 },
      cr: { type: "max", value: 5 },
      sn: { type: "max", value: 5 },
      pb: { type: "max", value: 5 },
      cu: { type: "max", value: 10 },
      ni: { type: "custom" },
      v: { type: "custom" },
    },
    contaminantes: {
      si: { type: "outside", min: 5, max: 50 },
      na: { type: "max", value: 100 },
      al: { type: "max", value: 20 },
    },
    agua: {
      valor: { type: "max", value: 0.3 },
    },
    condiciones: {
      bn: { type: "min", value: 20 },
    },
  },
};

export const LIMIT_SUMMARY_ROWS = [
  { section: "Desgaste", parameter: "Fe", gas: "> 25 ppm", hfo: "> 50 ppm", source: "WT98Q002 / WT98Q001" },
  { section: "Desgaste", parameter: "Cr / Sn / Pb", gas: "> 5 ppm", hfo: "> 5 ppm", source: "WT98Q002 / WT98Q001" },
  { section: "Desgaste", parameter: "Cu", gas: "> 15 ppm", hfo: "> 10 ppm", source: "WT98Q002 / WT98Q001" },
  { section: "Desgaste", parameter: "Ni", gas: "> 5 ppm", hfo: "> 2 x fuel Ni", source: "WT98Q002 / WT98Q001" },
  { section: "Desgaste", parameter: "V", gas: "N/I", hfo: "> 2 x fuel V", source: "WT98Q001" },
  { section: "Contaminantes", parameter: "Si", gas: "> 20 ppm", hfo: "< 5 o > 50 ppm", source: "WT98Q002 / WT98Q001" },
  { section: "Contaminantes", parameter: "Na", gas: "> 20 ppm", hfo: "> 100 ppm", source: "WT98Q002 / WT98Q001" },
  { section: "Contaminantes", parameter: "Al", gas: "> 10 ppm", hfo: "> 20 ppm", source: "WT98Q002 / WT98Q001" },
  { section: "Agua", parameter: "Agua", gas: "> 0.3 vol-% / w-%", hfo: "> 0.3 vol-% / w-%", source: "WT98Q002 / WT98Q001" },
  { section: "Condiciones del fluido", parameter: "BN", gas: "Max. 50% depletion", hfo: "< 20 mg KOH/g", source: "WT98Q002 / WT98Q001" },
];

export function cleanValue(value) {
  return String(value || "").trim();
}

export function normalizeText(value) {
  return cleanValue(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function parseNumericResult(value) {
  const raw = cleanValue(value);
  if (!raw) return null;

  let normalized = raw.replace(/\s/g, "");
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  normalized = normalized.replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return null;
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function formatDateDayMonthYear(value) {
  const raw = cleanValue(value);
  if (!raw) return "-";

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  const localMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localMatch) return `${localMatch[1]}/${localMatch[2]}/${localMatch[3]}`;

  return raw;
}

function formatDateLike(value) {
  const raw = cleanValue(value);
  if (!raw) return "-";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return raw;
}

function normalizeOilChanged(value) {
  const raw = cleanValue(value);
  if (!raw) return "-";
  const normalized = normalizeText(raw);
  if (normalized === "notreported" || normalized === "not reported") return "-";
  return raw;
}

function getLocalizedValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const preferred = value.find((item) => item?.locale === "es" || item?.locale === "pt_BR");
    return cleanValue(preferred?.text || value[0]?.text || "");
  }
  if (typeof value === "object") return cleanValue(value.text || value.name || "");
  return cleanValue(value);
}

function getTestEntries(sample) {
  const testResults = Array.isArray(sample?.testResults) ? sample.testResults : [];
  return testResults.map((testResult) => ({
    value: cleanValue(testResult?.resultValue || testResult?.value || testResult?.resultado),
    status: cleanValue(testResult?.resultStatus || testResult?.status),
    normName: normalizeText(
      getLocalizedValue(testResult?.test?.translation?.name || testResult?.test?.name || testResult?.analise)
    ),
    normAbbr: normalizeText(
      getLocalizedValue(testResult?.test?.translation?.abbreviation || testResult?.test?.abbreviation || testResult?.abreviacao)
    ),
  }));
}

function findParameterValue(entries, aliases, fallback = "N/I") {
  const normalizedAliases = aliases.map((alias) => normalizeText(alias));

  for (const entry of entries) {
    if (!entry.value) continue;

    for (const alias of normalizedAliases) {
      if (!alias) continue;

      const byAbbr = entry.normAbbr === alias;
      let byName = false;
      if (alias.length <= 2) {
        const nameTokens = entry.normName.split(/[^a-z0-9]+/).filter(Boolean);
        byName = nameTokens.includes(alias);
      } else {
        byName = entry.normName.includes(alias);
      }

      if (byAbbr || byName) return entry.value;
    }
  }

  return fallback;
}

export function getStatusForSample(sample) {
  return sample?.validResult?.resultStatus || sample?.result || sample?.resultStatus || "UNKNOWN";
}

export function summarizeSearchResult(searchResult) {
  const results = Array.isArray(searchResult?.results) ? searchResult.results : [];
  const summary = {
    totalMatches: Number.isInteger(searchResult?.total) ? searchResult.total : results.length,
    pageCount: results.length,
    readCount: 0,
    unreadCount: 0,
    statusCount: { NORMAL: 0, CAUTION: 0, ABNORMAL: 0, SEVERE: 0, UNKNOWN: 0 },
  };

  for (const sample of results) {
    const status = getStatusForSample(sample);
    if (Object.prototype.hasOwnProperty.call(summary.statusCount, status)) summary.statusCount[status] += 1;
    else summary.statusCount.UNKNOWN += 1;

    if (sample.readingStatus === true) summary.readCount += 1;
    else if (sample.readingStatus === false) summary.unreadCount += 1;
  }

  return summary;
}

export function mapEquipmentOption(item) {
  const id = item.id;
  const tag = cleanValue(item.tagFrota);
  const serial = cleanValue(item.chassiSerie);
  const model = cleanValue(item.modelo);
  const site = cleanValue(item.obra?.nome || item.cliente?.nome);
  const firstLabel = tag || serial || `ID ${id}`;
  const label = [firstLabel, model, site].filter(Boolean).join(" | ");

  return {
    id: String(id),
    label,
    model,
    tag,
    serial,
    area: cleanValue(item.area),
    sector: cleanValue(item.setor),
    customer: cleanValue(item.cliente?.nome),
    site: cleanValue(item.obra?.nome),
    raw: item,
  };
}

export function isAllowedEquipmentArea(area) {
  const normalizedArea = normalizeText(area);
  if (!normalizedArea) return false;
  return ALLOWED_EQUIPMENT_AREAS.some((allowedArea) => normalizedArea.includes(allowedArea));
}

export function isValueOverLimit(operationMode, section, key, value) {
  const mode = OPERATION_MODES.includes(operationMode) ? operationMode : "GAS";
  const rule = LIMIT_PROFILES?.[mode]?.[section]?.[key] || null;
  if (!rule || rule.type === "custom") return false;

  const numericValue = parseNumericResult(value);
  if (typeof numericValue !== "number") return false;

  if (rule.type === "max") return numericValue > rule.value;
  if (rule.type === "min") return numericValue < rule.value;
  if (rule.type === "outside") return numericValue < rule.min || numericValue > rule.max;
  return false;
}

export function buildHistoryComparisonTable(historySamples) {
  const samples = Array.isArray(historySamples) ? historySamples.slice(0, 10) : [];

  return samples.map((sample) => {
    const entries = getTestEntries(sample);
    const collectionData = sample?.collectionData || sample?.sampleData || {};
    const fluidName =
      cleanValue(collectionData?.oil?.model?.name) ||
      cleanValue(collectionData?.oil?.model) ||
      cleanValue(collectionData?.oil?.description) ||
      "N/I";

    return {
      sampleNumber: cleanValue(sample?.sampleNumber) || "-",
      status: getStatusForSample(sample),
      sampledDate: formatDateLike(collectionData?.dateSampled || collectionData?.registrationDate),
      receivedDate: formatDateLike(sample?.receiptDate),
      resultDate: formatDateLike(sample?.resultDate || sample?.validResult?.resultDate),
      hourMeter: cleanValue(collectionData?.equipmentTime ?? sample?.equipment?.time) || "N/I",
      oilChanged: normalizeOilChanged(collectionData?.oilChanged),
      oilAdded: cleanValue(collectionData?.addedVolume) || "N/I",
      fluidName,
      desgaste: {
        fe: findParameterValue(entries, PARAMETER_ALIASES.desgaste.fe),
        cu: findParameterValue(entries, PARAMETER_ALIASES.desgaste.cu),
        cr: findParameterValue(entries, PARAMETER_ALIASES.desgaste.cr),
        pb: findParameterValue(entries, PARAMETER_ALIASES.desgaste.pb),
        sn: findParameterValue(entries, PARAMETER_ALIASES.desgaste.sn),
        ni: findParameterValue(entries, PARAMETER_ALIASES.desgaste.ni),
        mo: findParameterValue(entries, PARAMETER_ALIASES.desgaste.mo),
        ti: findParameterValue(entries, PARAMETER_ALIASES.desgaste.ti),
        v: findParameterValue(entries, PARAMETER_ALIASES.desgaste.v),
        mn: findParameterValue(entries, PARAMETER_ALIASES.desgaste.mn),
        cd: findParameterValue(entries, PARAMETER_ALIASES.desgaste.cd),
        ag: findParameterValue(entries, PARAMETER_ALIASES.desgaste.ag),
        pqi: findParameterValue(entries, PARAMETER_ALIASES.desgaste.pqi),
      },
      contaminantes: {
        si: findParameterValue(entries, PARAMETER_ALIASES.contaminantes.si),
        al: findParameterValue(entries, PARAMETER_ALIASES.contaminantes.al),
        na: findParameterValue(entries, PARAMETER_ALIASES.contaminantes.na),
        k: findParameterValue(entries, PARAMETER_ALIASES.contaminantes.k),
      },
      agua: { valor: findParameterValue(entries, PARAMETER_ALIASES.agua.agua) },
      condiciones: {
        analisisVisual: findParameterValue(entries, PARAMETER_ALIASES.condiciones.analisis_visual, sample?.validResult?.resultStatus || "Normal"),
        v100: findParameterValue(entries, PARAMETER_ALIASES.condiciones.v100),
        flash: findParameterValue(entries, PARAMETER_ALIASES.condiciones.flash, "N/H"),
        tan: findParameterValue(entries, PARAMETER_ALIASES.condiciones.tan),
        bn: findParameterValue(entries, PARAMETER_ALIASES.condiciones.bn),
        hollin: findParameterValue(entries, PARAMETER_ALIASES.condiciones.hollin),
        nitracao: findParameterValue(entries, PARAMETER_ALIASES.condiciones.nitracao),
        oxidacao: findParameterValue(entries, PARAMETER_ALIASES.condiciones.oxidacao),
        sulfatacao: findParameterValue(entries, PARAMETER_ALIASES.condiciones.sulfatacao),
      },
      aditivos: {
        p: findParameterValue(entries, PARAMETER_ALIASES.aditivos.p),
        zn: findParameterValue(entries, PARAMETER_ALIASES.aditivos.zn),
        ca: findParameterValue(entries, PARAMETER_ALIASES.aditivos.ca),
        mg: findParameterValue(entries, PARAMETER_ALIASES.aditivos.mg),
        b: findParameterValue(entries, PARAMETER_ALIASES.aditivos.b),
        ba: findParameterValue(entries, PARAMETER_ALIASES.aditivos.ba),
      },
    };
  });
}

export function buildTrendChartsData(comparisonRows) {
  const rows = Array.isArray(comparisonRows) ? comparisonRows.slice().reverse() : [];
  const labels = rows.map((row) => cleanValue(row.sampleNumber) || "-");

  const toNumericSeries = (getter) =>
    rows.map((row) => {
      const value = parseNumericResult(getter(row));
      return Number.isFinite(value) ? Number(value.toFixed(3)) : null;
    });

  const buildDatasets = (definitions) =>
    definitions
      .map((definition) => {
        const data = toNumericSeries(definition.getter);
        const hasData = data.some((item) => Number.isFinite(item));
        if (!hasData) return null;
        return {
          label: definition.label,
          data,
          borderColor: definition.color,
          backgroundColor: definition.color,
        };
      })
      .filter(Boolean);

  const charts = [
    {
      id: "desgaste",
      title: "Desgaste (ppm)",
      datasets: buildDatasets([
        { label: "Fe", color: "#003b70", getter: (row) => row.desgaste.fe },
        { label: "Cu", color: "#00bbd2", getter: (row) => row.desgaste.cu },
        { label: "Cr", color: "#00a17b", getter: (row) => row.desgaste.cr },
        { label: "Pb", color: "#ff9b42", getter: (row) => row.desgaste.pb },
        { label: "Sn", color: "#d65a31", getter: (row) => row.desgaste.sn },
        { label: "Ni", color: "#7b61ff", getter: (row) => row.desgaste.ni },
        { label: "V", color: "#cc3a8e", getter: (row) => row.desgaste.v },
      ]),
    },
    {
      id: "contaminantes",
      title: "Contaminantes (ppm)",
      datasets: buildDatasets([
        { label: "Si", color: "#003b70", getter: (row) => row.contaminantes.si },
        { label: "Al", color: "#00bbd2", getter: (row) => row.contaminantes.al },
        { label: "Na", color: "#00a17b", getter: (row) => row.contaminantes.na },
        { label: "K", color: "#ff9b42", getter: (row) => row.contaminantes.k },
      ]),
    },
    {
      id: "agua",
      title: "Agua (vol-% / w-%)",
      datasets: buildDatasets([{ label: "Agua", color: "#005e9c", getter: (row) => row.agua.valor }]),
    },
    {
      id: "condiciones",
      title: "Condiciones del Fluido",
      datasets: buildDatasets([
        { label: "V100", color: "#003b70", getter: (row) => row.condiciones.v100 },
        { label: "TAN", color: "#00bbd2", getter: (row) => row.condiciones.tan },
        { label: "BN", color: "#00a17b", getter: (row) => row.condiciones.bn },
        { label: "Hollín", color: "#ff9b42", getter: (row) => row.condiciones.hollin },
        { label: "Nitración", color: "#d65a31", getter: (row) => row.condiciones.nitracao },
        { label: "Oxidación", color: "#7b61ff", getter: (row) => row.condiciones.oxidacao },
        { label: "Sulfatación", color: "#cc3a8e", getter: (row) => row.condiciones.sulfatacao },
      ]),
    },
    {
      id: "aditivos",
      title: "Aditivos (ppm)",
      datasets: buildDatasets([
        { label: "P", color: "#003b70", getter: (row) => row.aditivos.p },
        { label: "Zn", color: "#00bbd2", getter: (row) => row.aditivos.zn },
        { label: "Ca", color: "#00a17b", getter: (row) => row.aditivos.ca },
        { label: "Mg", color: "#ff9b42", getter: (row) => row.aditivos.mg },
        { label: "B", color: "#d65a31", getter: (row) => row.aditivos.b },
        { label: "Ba", color: "#7b61ff", getter: (row) => row.aditivos.ba },
      ]),
    },
  ].filter((chart) => chart.datasets.length > 0);

  return { labels, charts };
}

