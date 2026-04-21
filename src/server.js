const path = require("path");
const express = require("express");
const session = require("express-session");
const { appConfig, s360Config } = require("./config");
const { S360Client, ApiError } = require("./s360");

const app = express();

const SAMPLE_STATUSES = ["NORMAL", "CAUTION", "ABNORMAL", "SEVERE"];
const OPERATION_MODES = ["GAS", "HFO"];
const ALLOWED_EQUIPMENT_AREAS = ["perez", "canada", "villa ocampo"];
const AUTO_S360_USERNAME = "amiotti@secco.com.ar";
const CATEGORY_CONFIG = [
  {
    key: "desgaste",
    label: "Desgaste",
    aliases: ["desgaste", "wear"],
  },
  {
    key: "contaminantes",
    label: "Contaminantes",
    aliases: ["contaminantes", "contaminacao", "contaminacao", "contamination"],
  },
  {
    key: "agua",
    label: "Agua",
    aliases: ["agua", "water"],
  },
  {
    key: "condiciones_fluido",
    label: "Condiciones del Fluido",
    aliases: [
      "condicoes do fluido",
      "condicoes do fluido",
      "condiciones del fluido",
      "fluid condition",
      "fluid conditions",
    ],
  },
  {
    key: "aditivos",
    label: "Aditivos",
    aliases: ["aditivos", "additive", "additives", "carga aditiva"],
  },
];

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(
  session({
    secret: appConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

function cleanValue(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return cleanValue(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getLocalizedValue(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const preferred = value.find((item) => item?.locale === "es" || item?.locale === "pt_BR");
    return cleanValue(preferred?.text || value[0]?.text || "");
  }

  if (typeof value === "object") {
    return cleanValue(value.text || value.name || "");
  }

  return cleanValue(value);
}

function parseNumericResult(value) {
  const raw = cleanValue(value);
  if (!raw) {
    return null;
  }

  let normalized = raw.replace(/\s/g, "");

  // Formato tipo 1.234,56
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  normalized = normalized.replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") {
    return null;
  }

  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveCategoryByGroupName(groupName) {
  const normalizedGroup = normalizeText(groupName);
  if (!normalizedGroup) {
    return null;
  }

  for (const config of CATEGORY_CONFIG) {
    for (const alias of config.aliases) {
      if (normalizedGroup.includes(alias)) {
        return config;
      }
    }
  }

  return null;
}

function extractTestItem(testResult) {
  const groupName = getLocalizedValue(
    testResult?.test?.testGroup?.name || testResult?.grupoanalise
  );
  const category = resolveCategoryByGroupName(groupName);
  if (!category) {
    return null;
  }

  const parameterName = getLocalizedValue(
    testResult?.test?.translation?.name || testResult?.test?.name || testResult?.analise
  );
  const abbreviation = getLocalizedValue(
    testResult?.test?.translation?.abbreviation ||
      testResult?.test?.abbreviation ||
      testResult?.abreviacao
  );
  const unit = getLocalizedValue(
    testResult?.test?.translation?.unitOfMeasure ||
      testResult?.test?.unitOfMeasure ||
      testResult?.unidademedida
  );
  const value = cleanValue(testResult?.resultValue || testResult?.value || testResult?.resultado);
  const numericValue = parseNumericResult(value);

  return {
    categoryKey: category.key,
    categoryLabel: category.label,
    groupName,
    parameterName: parameterName || abbreviation || "Parametro",
    abbreviation,
    unit,
    value,
    status: cleanValue(testResult?.resultStatus || testResult?.status),
    numericValue,
  };
}

function buildCategoryDashboard(testResults) {
  const grouped = {};
  for (const config of CATEGORY_CONFIG) {
    grouped[config.key] = {
      key: config.key,
      label: config.label,
      items: [],
    };
  }

  const list = Array.isArray(testResults) ? testResults : [];
  for (const testResult of list) {
    const extracted = extractTestItem(testResult);
    if (!extracted) {
      continue;
    }

    grouped[extracted.categoryKey].items.push(extracted);
  }

  const categories = CATEGORY_CONFIG.map((config) => {
    const category = grouped[config.key];
    category.items.sort((a, b) => {
      const byName = a.parameterName.localeCompare(b.parameterName);
      if (byName !== 0) {
        return byName;
      }
      return a.abbreviation.localeCompare(b.abbreviation);
    });
    return category;
  });

  return {
    categories,
    totalItems: categories.reduce((acc, item) => acc + item.items.length, 0),
  };
}

const PARAMETER_ALIASES = {
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
  agua: {
    agua: ["agua", "water", "kf", "kf vol", "crepitacao", "crepitação"],
  },
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

const LIMIT_PROFILES = {
  GAS: {
    desgaste: {
      fe: { type: "max", value: 25, label: "> 25 ppm" },
      cr: { type: "max", value: 5, label: "> 5 ppm" },
      sn: { type: "max", value: 5, label: "> 5 ppm" },
      pb: { type: "max", value: 5, label: "> 5 ppm" },
      cu: { type: "max", value: 15, label: "> 15 ppm" },
      ni: { type: "max", value: 5, label: "> 5 ppm" },
    },
    contaminantes: {
      si: { type: "max", value: 20, label: "> 20 ppm" },
      na: { type: "max", value: 20, label: "> 20 ppm" },
      al: { type: "max", value: 10, label: "> 10 ppm" },
    },
    agua: {
      valor: { type: "max", value: 0.3, label: "> 0.3 vol-% / w-%" },
    },
  },
  HFO: {
    desgaste: {
      fe: { type: "max", value: 50, label: "> 50 ppm" },
      cr: { type: "max", value: 5, label: "> 5 ppm" },
      sn: { type: "max", value: 5, label: "> 5 ppm" },
      pb: { type: "max", value: 5, label: "> 5 ppm" },
      cu: { type: "max", value: 10, label: "> 10 ppm" },
      ni: { type: "custom", label: "> 2 x fuel Ni" },
      v: { type: "custom", label: "> 2 x fuel V" },
    },
    contaminantes: {
      si: { type: "outside", min: 5, max: 50, label: "< 5 o > 50 ppm" },
      na: { type: "max", value: 100, label: "> 100 ppm" },
      al: { type: "max", value: 20, label: "> 20 ppm" },
    },
    agua: {
      valor: { type: "max", value: 0.3, label: "> 0.3 vol-% / w-%" },
    },
    condiciones: {
      bn: { type: "min", value: 20, label: "< 20 mg KOH/g" },
    },
  },
};

const LIMIT_SUMMARY_ROWS = [
  { section: "Desgaste", parameter: "Fe", gas: "> 25 ppm", hfo: "> 50 ppm", source: "WT98Q002 Table 2 / WT98Q001 Table 2" },
  { section: "Desgaste", parameter: "Cr / Sn / Pb", gas: "> 5 ppm", hfo: "> 5 ppm", source: "WT98Q002 Table 2 / WT98Q001 Table 2" },
  { section: "Desgaste", parameter: "Cu", gas: "> 15 ppm", hfo: "> 10 ppm", source: "WT98Q002 Table 2 / WT98Q001 Table 2" },
  { section: "Desgaste", parameter: "Ni", gas: "> 5 ppm", hfo: "> 2 x fuel Ni", source: "WT98Q002 Table 2 / WT98Q001 Table 2" },
  { section: "Desgaste", parameter: "V", gas: "N/I", hfo: "> 2 x fuel V", source: "WT98Q001 Table 2" },
  { section: "Contaminantes", parameter: "Si", gas: "> 20 ppm", hfo: "< 5 o > 50 ppm", source: "WT98Q002 Table 2 / WT98Q001 Table 2" },
  { section: "Contaminantes", parameter: "Na", gas: "> 20 ppm", hfo: "> 100 ppm", source: "WT98Q002 Table 2 / WT98Q001 Table 2" },
  { section: "Contaminantes", parameter: "Al", gas: "> 10 ppm", hfo: "> 20 ppm", source: "WT98Q002 Table 2 / WT98Q001 Table 2" },
  { section: "Agua", parameter: "Agua", gas: "> 0.3 vol-% / w-%", hfo: "> 0.3 vol-% / w-%", source: "WT98Q002 Table 1 / WT98Q001 Table 1" },
  { section: "Condiciones del fluido", parameter: "BN", gas: "Max. 50% depletion vs fresh oil", hfo: "< 20 mg KOH/g", source: "WT98Q002 Table 1 / WT98Q001 Table 1" },
];

function getTestEntries(sample) {
  const testResults = Array.isArray(sample?.testResults) ? sample.testResults : [];
  return testResults.map((testResult) => {
    const parameterName = getLocalizedValue(
      testResult?.test?.translation?.name || testResult?.test?.name || testResult?.analise
    );
    const abbreviation = getLocalizedValue(
      testResult?.test?.translation?.abbreviation ||
        testResult?.test?.abbreviation ||
        testResult?.abreviacao
    );
    return {
      value: cleanValue(
        testResult?.resultValue || testResult?.value || testResult?.resultado
      ),
      status: cleanValue(testResult?.resultStatus || testResult?.status),
      normName: normalizeText(parameterName),
      normAbbr: normalizeText(abbreviation),
    };
  });
}

function findParameterValue(entries, aliases, fallback = "N/I") {
  const normalizedAliases = aliases.map((alias) => normalizeText(alias));
  for (const entry of entries) {
    if (!entry.value) {
      continue;
    }

    for (const alias of normalizedAliases) {
      if (!alias) {
        continue;
      }

      const byAbbr = entry.normAbbr === alias;
      let byName = false;
      if (alias.length <= 2) {
        const nameTokens = entry.normName.split(/[^a-z0-9]+/).filter(Boolean);
        byName = nameTokens.includes(alias);
      } else {
        byName = entry.normName.includes(alias);
      }
      if (byAbbr || byName) {
        return entry.value;
      }
    }
  }
  return fallback;
}

function normalizeOilChanged(value) {
  const raw = cleanValue(value);
  if (!raw) {
    return "-";
  }

  const normalized = normalizeText(raw);
  if (normalized === "notreported" || normalized === "not reported") {
    return "-";
  }

  return raw;
}

function formatDateLike(value) {
  const raw = cleanValue(value);
  if (!raw) {
    return "-";
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  return raw;
}

function formatDateDayMonthYear(value) {
  const raw = cleanValue(value);
  if (!raw) {
    return "-";
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const localMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localMatch) {
    return `${localMatch[1]}/${localMatch[2]}/${localMatch[3]}`;
  }

  return raw;
}

function buildHistoryComparisonTable(historySamples) {
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
      agua: {
        valor: findParameterValue(entries, PARAMETER_ALIASES.agua.agua),
      },
      condiciones: {
        analisisVisual: findParameterValue(
          entries,
          PARAMETER_ALIASES.condiciones.analisis_visual,
          sample?.validResult?.resultStatus || "Normal"
        ),
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

function buildTrendChartsData(comparisonRows) {
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
        if (!hasData) {
          return null;
        }

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
      datasets: buildDatasets([
        { label: "Agua", color: "#005e9c", getter: (row) => row.agua.valor },
      ]),
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

  return {
    labels,
    charts,
  };
}

function getLimitRule(operationMode, section, key) {
  const mode = OPERATION_MODES.includes(operationMode) ? operationMode : "GAS";
  return LIMIT_PROFILES?.[mode]?.[section]?.[key] || null;
}

function isValueOverLimit(operationMode, section, key, value) {
  const rule = getLimitRule(operationMode, section, key);
  if (!rule || rule.type === "custom") {
    return false;
  }

  const numericValue = parseNumericResult(value);
  if (typeof numericValue !== "number") {
    return false;
  }

  if (rule.type === "max") {
    return numericValue > rule.value;
  }
  if (rule.type === "min") {
    return numericValue < rule.value;
  }
  if (rule.type === "outside") {
    return numericValue < rule.min || numericValue > rule.max;
  }

  return false;
}

function parsePositiveInt(value, fallback, { min = 1, max } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  if (parsed < min) {
    return fallback;
  }

  if (typeof max === "number") {
    return Math.min(parsed, max);
  }

  return parsed;
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function requireAuth(req, res, next) {
  // Acceso publico: no se requiere login/registro.
  return next();
}

function getErrorForUI(error) {
  if (error instanceof ApiError) {
    if (error.details?.mensagem) {
      return `S360: ${error.details.mensagem}`;
    }

    return `S360 respondio ${error.status}: ${error.message}`;
  }

  return error.message || "Error inesperado.";
}

function getDashboardFilters(req) {
  const stored = req.session.dashboardFilters || {};
  const storedAreas = Array.isArray(stored.areas)
    ? stored.areas.map((item) => cleanValue(item)).filter(Boolean)
    : cleanValue(stored.area)
      ? [cleanValue(stored.area)]
      : [];
  return {
    areas: storedAreas,
    equipmentId: stored.equipmentId || "",
    generalSearch: stored.generalSearch || "",
    sinceResultDate: stored.sinceResultDate || "",
    untilResultDate: stored.untilResultDate || "",
    resultStatus: stored.resultStatus || "ALL",
    operationMode: OPERATION_MODES.includes(stored.operationMode)
      ? stored.operationMode
      : "GAS",
    page: parsePositiveInt(stored.page, 1, { min: 1 }),
    pageSize: parsePositiveInt(stored.pageSize, 20, { min: 1, max: 50 }),
  };
}

function getFormState(req) {
  const filters = getDashboardFilters(req);
  return {
    apiBaseUrl: req.session.s360Config?.baseUrl || s360Config.defaultBaseUrl,
    apiUsername: req.session.s360Config?.username || s360Config.defaultUsername,
    apiPassword: "",
    subscriptionKey:
      req.session.s360Config?.subscriptionKey || s360Config.defaultSubscriptionKey,
    ...filters,
  };
}

function persistDashboardFilters(req) {
  const rawAreas = req.body.areas;
  const areas = Array.isArray(rawAreas)
    ? rawAreas.map((item) => cleanValue(item)).filter(Boolean)
    : cleanValue(rawAreas)
      ? [cleanValue(rawAreas)]
      : [];
  req.session.dashboardFilters = {
    areas,
    equipmentId: cleanValue(req.body.equipmentId),
    generalSearch: cleanValue(req.body.generalSearch),
    sinceResultDate: cleanValue(req.body.sinceResultDate),
    untilResultDate: cleanValue(req.body.untilResultDate),
    resultStatus: cleanValue(req.body.resultStatus) || "ALL",
    operationMode: OPERATION_MODES.includes(cleanValue(req.body.operationMode))
      ? cleanValue(req.body.operationMode)
      : "GAS",
    page: parsePositiveInt(req.body.page, 1, { min: 1 }),
    pageSize: parsePositiveInt(req.body.pageSize, 20, { min: 1, max: 50 }),
  };
}

function resolveS360Config(req) {
  const previousConfig = req.session.s360Config || {};
  const baseUrl =
    cleanValue(req.body.apiBaseUrl) || previousConfig.baseUrl || s360Config.defaultBaseUrl;
  const username =
    cleanValue(req.body.apiUsername) || previousConfig.username || s360Config.defaultUsername;
  const password =
    cleanValue(req.body.apiPassword) || previousConfig.password || s360Config.defaultPassword;

  const subscriptionKey = Object.prototype.hasOwnProperty.call(req.body, "subscriptionKey")
    ? cleanValue(req.body.subscriptionKey)
    : previousConfig.subscriptionKey || s360Config.defaultSubscriptionKey;

  if (!baseUrl || !username || !password) {
    throw new Error(
      "Completa URL base, usuario y clave de S360 para conectarte."
    );
  }

  return {
    baseUrl,
    username,
    password,
    subscriptionKey,
  };
}

function createS360ClientFromSession(req) {
  if (!req.session.s360Config) {
    const autoConfig = getAutomaticS360Config();
    if (!autoConfig) {
      throw new Error("No hay configuración automática de S360 disponible.");
    }
    req.session.s360Config = autoConfig;
    delete req.session.s360Token;
  }

  return new S360Client({
    baseUrl: req.session.s360Config.baseUrl,
    subscriptionKey: req.session.s360Config.subscriptionKey,
  });
}

function getAutomaticS360Config() {
  if (!s360Config.defaultBaseUrl || !s360Config.defaultPassword) {
    return null;
  }

  return {
    baseUrl: s360Config.defaultBaseUrl,
    username: AUTO_S360_USERNAME,
    password: s360Config.defaultPassword,
    subscriptionKey: s360Config.defaultSubscriptionKey || "",
  };
}

async function ensureEquipmentLoaded(req) {
  const autoConfig = getAutomaticS360Config();
  if (!autoConfig) {
    throw new Error("No hay configuración automática de S360 disponible.");
  }

  const needsConfigRefresh =
    !req.session.s360Config ||
    req.session.s360Config.baseUrl !== autoConfig.baseUrl ||
    req.session.s360Config.username !== autoConfig.username ||
    req.session.s360Config.subscriptionKey !== autoConfig.subscriptionKey;

  if (needsConfigRefresh) {
    req.session.s360Config = autoConfig;
    delete req.session.s360Token;
    delete req.session.equipmentOptions;
  }

  if (Array.isArray(req.session.equipmentOptions) && req.session.equipmentOptions.length > 0) {
    return req.session.equipmentOptions;
  }

  const s360Client = createS360ClientFromSession(req);
  await ensureS360Token(req, s360Client);

  const equipmentOptions = await loadAllEquipment(req, s360Client);
  req.session.equipmentOptions = equipmentOptions;

  return equipmentOptions;
}

async function loginS360AndStoreToken(req, s360Client) {
  if (!req.session.s360Config?.username || !req.session.s360Config?.password) {
    throw new Error("No hay credenciales de S360 guardadas.");
  }

  const loginResponse = await s360Client.login({
    username: req.session.s360Config.username,
    password: req.session.s360Config.password,
  });

  const token = {
    tokenType: loginResponse.token_type || "Bearer",
    accessToken: loginResponse.access_token,
  };

  req.session.s360Token = token;
  return token;
}

async function ensureS360Token(req, s360Client, force = false) {
  if (!force && req.session.s360Token?.accessToken) {
    return req.session.s360Token;
  }

  return loginS360AndStoreToken(req, s360Client);
}

async function executeWithTokenRetry(req, s360Client, callback) {
  let token = await ensureS360Token(req, s360Client);

  try {
    return await callback(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      token = await ensureS360Token(req, s360Client, true);
      return callback(token);
    }
    throw error;
  }
}

function mapEquipmentOption(item) {
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

function isAllowedEquipmentArea(area) {
  const normalizedArea = normalizeText(area);
  if (!normalizedArea) {
    return false;
  }

  return ALLOWED_EQUIPMENT_AREAS.some((allowedArea) =>
    normalizedArea.includes(allowedArea)
  );
}

async function loadAllEquipment(req, s360Client) {
  const allResults = [];
  const maxPerPage = 100;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 50) {
    const payload = {
      numeroPagina: page,
      maximoPorPagina: maxPerPage,
    };

    const response = await executeWithTokenRetry(req, s360Client, (token) =>
      s360Client.listEquipment({
        tokenType: token.tokenType,
        accessToken: token.accessToken,
        filter: payload,
      })
    );

    if (response?.codigoErro && response.codigoErro !== 0) {
      throw new Error(response.mensagem || "Error al listar equipos.");
    }

    const currentResults = Array.isArray(response?.resultados)
      ? response.resultados
      : [];

    allResults.push(...currentResults);
    totalPages = parsePositiveInt(response?.totalPaginas, page, {
      min: 1,
      max: 1000,
    });

    if (currentResults.length === 0) {
      break;
    }

    page += 1;
  }

  return allResults
    .map(mapEquipmentOption)
    .filter((item) => isAllowedEquipmentArea(item.area))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildSampleSearchFilter(req) {
  const filters = getDashboardFilters(req);
  const sessionEquipmentOptions = Array.isArray(req.session.equipmentOptions)
    ? req.session.equipmentOptions
    : [];
  const selectedAreaSet = Array.isArray(filters.areas) && filters.areas.length > 0
    ? new Set(filters.areas.map((area) => normalizeText(area)))
    : null;

  let equipmentIds = [];
  const equipmentId = Number.parseInt(filters.equipmentId, 10);

  if (Number.isInteger(equipmentId) && equipmentId > 0) {
    const selectedEquipment = sessionEquipmentOptions.find(
      (item) => String(item.id) === String(equipmentId)
    );
    if (!selectedEquipment) {
      throw new Error(
        "El equipo seleccionado no pertenece al listado habilitado (Perez, Cañada o Villa Ocampo)."
      );
    }
    if (
      selectedAreaSet &&
      !selectedAreaSet.has(normalizeText(selectedEquipment.area))
    ) {
      throw new Error("Selecciona un equipo que pertenezca a una de las áreas elegidas.");
    }
    equipmentIds = [equipmentId];
  } else if (selectedAreaSet) {
    equipmentIds = sessionEquipmentOptions
      .filter((item) => selectedAreaSet.has(normalizeText(item.area)))
      .map((item) => Number.parseInt(item.id, 10))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  if (equipmentIds.length === 0) {
    throw new Error("Selecciona un área o un equipo para buscar las muestras.");
  }

  const page = parsePositiveInt(filters.page, 1, { min: 1 });
  const pageSize = parsePositiveInt(filters.pageSize, 20, { min: 1, max: 50 });

  const payload = {
    equipmentIds,
    offset: (page - 1) * pageSize,
    max: pageSize,
    order: "resultDate",
    sort: "desc",
  };

  if (filters.generalSearch) {
    payload.generalSearch = filters.generalSearch;
  }

  if (filters.sinceResultDate) {
    payload.sinceResultDate = filters.sinceResultDate;
  }

  if (filters.untilResultDate) {
    payload.untilResultDate = filters.untilResultDate;
  }

  if (SAMPLE_STATUSES.includes(filters.resultStatus)) {
    payload.sampleResultsStatus = [filters.resultStatus];
  }

  return payload;
}

function getStatusForSample(sample) {
  return (
    sample?.validResult?.resultStatus ||
    sample?.result ||
    sample?.resultStatus ||
    "UNKNOWN"
  );
}

function summarizeSearchResult(searchResult) {
  const results = Array.isArray(searchResult?.results) ? searchResult.results : [];
  const summary = {
    totalMatches: Number.isInteger(searchResult?.total)
      ? searchResult.total
      : results.length,
    pageCount: results.length,
    readCount: 0,
    unreadCount: 0,
    statusCount: {
      NORMAL: 0,
      CAUTION: 0,
      ABNORMAL: 0,
      SEVERE: 0,
      UNKNOWN: 0,
    },
  };

  for (const sample of results) {
    const status = getStatusForSample(sample);
    if (Object.prototype.hasOwnProperty.call(summary.statusCount, status)) {
      summary.statusCount[status] += 1;
    } else {
      summary.statusCount.UNKNOWN += 1;
    }

    if (sample.readingStatus === true) {
      summary.readCount += 1;
    } else if (sample.readingStatus === false) {
      summary.unreadCount += 1;
    }
  }

  return summary;
}

function renderDashboard(req, res, data = {}) {
  const equipmentOptions = Array.isArray(req.session.equipmentOptions)
    ? req.session.equipmentOptions
    : [];

  const form = getFormState(req);
  const selectedAreas = Array.isArray(form.areas) ? form.areas : [];
  const selectedAreaSet = new Set(selectedAreas.map((area) => normalizeText(area)));
  const areaOptions = Array.from(
    new Set(equipmentOptions.map((item) => cleanValue(item.area)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const filteredEquipmentOptions = selectedAreaSet.size > 0
    ? equipmentOptions.filter(
        (item) => selectedAreaSet.has(normalizeText(item.area))
      )
    : equipmentOptions;
  const selectedEquipment =
    equipmentOptions.find((item) => item.id === String(form.equipmentId)) || null;

  const searchResult = data.searchResult || req.session.lastSearchResult || null;
  const comparisonRows = data.comparisonRows || [];
  const operationMode = OPERATION_MODES.includes(form.operationMode)
    ? form.operationMode
    : "GAS";

  res.render("dashboard", {
    form,
    equipmentOptions: filteredEquipmentOptions,
    areaOptions,
    selectedEquipment,
    connectedToS360: Boolean(req.session.s360Config),
    searchResult,
    searchMetrics: summarizeSearchResult(searchResult),
    sampleDetail: data.sampleDetail || null,
    selectedSampleNumber: data.selectedSampleNumber || null,
    historySamples: data.historySamples || [],
    comparisonRows,
    trendChartsData: buildTrendChartsData(comparisonRows),
    operationMode,
    limitSummaryRows: LIMIT_SUMMARY_ROWS,
    limitRuleLabel: (section, key) =>
      getLimitRule(operationMode, section, key)?.label || "N/I",
    overLimit: (section, key, value) =>
      isValueOverLimit(operationMode, section, key, value),
    formatDisplayDate: (value) => formatDateDayMonthYear(value),
    flash: data.flash || res.locals.flash,
  });
}

app.get("/", (req, res) => {
  return res.render("home");
});

app.get("/login", (req, res) => {
  return res.redirect("/acceso");
});

app.get("/acceso", (req, res) => {
  return res.render("login");
});

app.get("/register", (req, res) => {
  return res.redirect("/acceso");
});

app.post("/register", async (req, res) => {
  return res.redirect("/dashboard");
});

app.post("/login", async (req, res) => {
  return res.redirect("/dashboard");
});

app.post("/logout", (req, res) => {
  res.redirect("/acceso");
});

app.get("/dashboard", requireAuth, async (req, res) => {
  try {
    await ensureEquipmentLoaded(req);
  } catch (_error) {
    // Si no hay credenciales por defecto, el usuario puede conectar manualmente.
  }

  renderDashboard(req, res);
});

app.get("/dasboard", requireAuth, (req, res) => {
  return res.redirect("/dashboard");
});

app.post("/s360/connect", requireAuth, async (req, res) => {
  try {
    const config = resolveS360Config(req);
    req.session.s360Config = config;

    const s360Client = createS360ClientFromSession(req);
    await loginS360AndStoreToken(req, s360Client);

    const equipmentOptions = await loadAllEquipment(req, s360Client);
    req.session.equipmentOptions = equipmentOptions;

    const filters = getDashboardFilters(req);
    if (
      filters.equipmentId &&
      !equipmentOptions.some((item) => item.id === String(filters.equipmentId))
    ) {
      req.session.dashboardFilters = {
        ...filters,
        equipmentId: "",
      };
    }

    req.session.lastSearchResult = null;

    return renderDashboard(req, res, {
      flash: {
        type: "success",
        message: `Conexion exitosa. Equipos cargados: ${equipmentOptions.length}.`,
      },
    });
  } catch (error) {
    return renderDashboard(req, res, {
      flash: { type: "error", message: getErrorForUI(error) },
    });
  }
});

app.post("/samples/search", requireAuth, async (req, res) => {
  try {
    persistDashboardFilters(req);
    await ensureEquipmentLoaded(req);

    const s360Client = createS360ClientFromSession(req);
    const payload = buildSampleSearchFilter(req);

    const searchResult = await executeWithTokenRetry(req, s360Client, (token) =>
      s360Client.searchSampleResultsByEquipment({
        tokenType: token.tokenType,
        accessToken: token.accessToken,
        filter: payload,
      })
    );

    req.session.lastSearchResult = searchResult;

    return renderDashboard(req, res, {
      searchResult,
      flash: { type: "success", message: "Busqueda ejecutada correctamente." },
    });
  } catch (error) {
    return renderDashboard(req, res, {
      flash: { type: "error", message: getErrorForUI(error) },
    });
  }
});

app.post("/samples/view", requireAuth, async (req, res) => {
  const sampleNumber = cleanValue(req.body.sampleNumber);

  if (!sampleNumber) {
    return renderDashboard(req, res, {
      flash: { type: "error", message: "Falta numero de muestra." },
    });
  }

  try {
    await ensureEquipmentLoaded(req);
    const s360Client = createS360ClientFromSession(req);

    const sampleDetail = await executeWithTokenRetry(req, s360Client, (token) =>
      s360Client.viewSampleResultBySampleNumber({
        tokenType: token.tokenType,
        accessToken: token.accessToken,
        sampleNumber,
      })
    );

    const equipmentId = sampleDetail?.equipment?.id;

    let historySamples = [];
    let comparisonRows = [];

    if (equipmentId) {
      const historyResponse = await executeWithTokenRetry(req, s360Client, (token) =>
        s360Client.searchSampleResultsByEquipment({
          tokenType: token.tokenType,
          accessToken: token.accessToken,
          filter: {
            equipmentIds: [equipmentId],
            offset: 0,
            max: 10,
            order: "resultDate",
            sort: "desc",
          },
        })
      );

      historySamples = Array.isArray(historyResponse?.results)
        ? historyResponse.results
        : [];
      comparisonRows = buildHistoryComparisonTable(historySamples);
    }

    return renderDashboard(req, res, {
      sampleDetail,
      selectedSampleNumber: sampleNumber,
      historySamples,
      comparisonRows,
    });
  } catch (error) {
    return renderDashboard(req, res, {
      selectedSampleNumber: sampleNumber,
      flash: { type: "error", message: getErrorForUI(error) },
    });
  }
});

app.get("/samples/:sampleNumber/pdf", requireAuth, async (req, res) => {
  const sampleNumber = cleanValue(req.params.sampleNumber);
  if (!sampleNumber) {
    return res.status(400).send("Falta numero de muestra.");
  }

  try {
    await ensureEquipmentLoaded(req);
    const s360Client = createS360ClientFromSession(req);
    const pdfBuffer = await executeWithTokenRetry(req, s360Client, (token) =>
      s360Client.viewSampleResultPdf({
        tokenType: token.tokenType,
        accessToken: token.accessToken,
        sampleNumber,
      })
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="muestra-${sampleNumber}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    return renderDashboard(req, res, {
      flash: { type: "error", message: getErrorForUI(error) },
    });
  }
});

if (!process.env.VERCEL) {
  app.listen(appConfig.port, () => {
    console.log(
      `Servidor iniciado en http://localhost:${appConfig.port} (base S360: ${s360Config.defaultBaseUrl})`
    );
  });
}

module.exports = app;
