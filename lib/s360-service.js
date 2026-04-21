import { createS360Client, getAuthToken } from "./s360-client";
import {
  SAMPLE_STATUSES,
  cleanValue,
  mapEquipmentOption,
  isAllowedEquipmentArea,
  normalizeText,
  summarizeSearchResult,
  buildHistoryComparisonTable,
  buildTrendChartsData,
} from "./oil-helpers";

function parsePositiveInt(value, fallback, { min = 1, max } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min) return fallback;
  if (typeof max === "number") return Math.min(parsed, max);
  return parsed;
}

async function executeWithTokenRetry(client, callback) {
  let token = await getAuthToken(client);
  try {
    return await callback(token);
  } catch (error) {
    if (error?.status === 401) {
      token = await getAuthToken(client);
      return callback(token);
    }
    throw error;
  }
}

export async function loadEquipmentOptions() {
  const client = createS360Client();
  const allResults = [];
  const maxPerPage = 100;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 50) {
    const payload = { numeroPagina: page, maximoPorPagina: maxPerPage };

    const response = await executeWithTokenRetry(client, (token) =>
      client.listEquipment({
        tokenType: token.tokenType,
        accessToken: token.accessToken,
        filter: payload,
      })
    );

    if (response?.codigoErro && response.codigoErro !== 0) {
      throw new Error(response.mensagem || "Error al listar equipos.");
    }

    const currentResults = Array.isArray(response?.resultados) ? response.resultados : [];
    allResults.push(...currentResults);

    totalPages = parsePositiveInt(response?.totalPaginas, page, { min: 1, max: 1000 });
    if (currentResults.length === 0) break;

    page += 1;
  }

  const equipmentOptions = allResults
    .map(mapEquipmentOption)
    .filter((item) => isAllowedEquipmentArea(item.area))
    .sort((a, b) => a.label.localeCompare(b.label));

  const areaOptions = Array.from(new Set(equipmentOptions.map((item) => cleanValue(item.area)).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  );

  return { equipmentOptions, areaOptions };
}

export async function searchSamples(filters) {
  const client = createS360Client();
  const { equipmentOptions } = await loadEquipmentOptions();

  const areas = Array.isArray(filters?.areas) ? filters.areas.filter(Boolean) : [];
  const selectedAreaSet = areas.length > 0 ? new Set(areas.map((a) => normalizeText(a))) : null;

  let equipmentIds = [];
  const equipmentId = Number.parseInt(filters?.equipmentId, 10);

  if (Number.isInteger(equipmentId) && equipmentId > 0) {
    const selectedEquipment = equipmentOptions.find((item) => String(item.id) === String(equipmentId));
    if (!selectedEquipment) {
      throw new Error("El equipo seleccionado no pertenece al listado habilitado.");
    }
    if (selectedAreaSet && !selectedAreaSet.has(normalizeText(selectedEquipment.area))) {
      throw new Error("Selecciona un equipo que pertenezca a una de las áreas elegidas.");
    }
    equipmentIds = [equipmentId];
  } else if (selectedAreaSet) {
    equipmentIds = equipmentOptions
      .filter((item) => selectedAreaSet.has(normalizeText(item.area)))
      .map((item) => Number.parseInt(item.id, 10))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  if (equipmentIds.length === 0) {
    throw new Error("Selecciona un área o un equipo para buscar las muestras.");
  }

  const page = parsePositiveInt(filters?.page, 1, { min: 1 });
  const pageSize = parsePositiveInt(filters?.pageSize, 20, { min: 1, max: 50 });

  const payload = {
    equipmentIds,
    offset: (page - 1) * pageSize,
    max: pageSize,
    order: "resultDate",
    sort: "desc",
  };

  if (cleanValue(filters?.generalSearch)) payload.generalSearch = cleanValue(filters.generalSearch);
  if (cleanValue(filters?.sinceResultDate)) payload.sinceResultDate = cleanValue(filters.sinceResultDate);
  if (cleanValue(filters?.untilResultDate)) payload.untilResultDate = cleanValue(filters.untilResultDate);

  const status = cleanValue(filters?.resultStatus).toUpperCase();
  if (SAMPLE_STATUSES.includes(status)) payload.sampleResultsStatus = [status];

  const searchResult = await executeWithTokenRetry(client, (token) =>
    client.searchSampleResultsByEquipment({
      tokenType: token.tokenType,
      accessToken: token.accessToken,
      filter: payload,
    })
  );

  return {
    searchResult,
    searchMetrics: summarizeSearchResult(searchResult),
    selectedEquipment:
      equipmentId > 0 ? equipmentOptions.find((item) => String(item.id) === String(equipmentId)) || null : null,
  };
}

export async function getSampleDetail(sampleNumber) {
  const client = createS360Client();

  const sampleDetail = await executeWithTokenRetry(client, (token) =>
    client.viewSampleResultBySampleNumber({
      tokenType: token.tokenType,
      accessToken: token.accessToken,
      sampleNumber,
    })
  );

  const equipmentId = sampleDetail?.equipment?.id;
  let historySamples = [];
  let comparisonRows = [];
  let trendChartsData = { labels: [], charts: [] };

  if (equipmentId) {
    const historyResponse = await executeWithTokenRetry(client, (token) =>
      client.searchSampleResultsByEquipment({
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

    historySamples = Array.isArray(historyResponse?.results) ? historyResponse.results : [];
    comparisonRows = buildHistoryComparisonTable(historySamples);
    trendChartsData = buildTrendChartsData(comparisonRows);
  }

  return {
    sampleDetail,
    historySamples,
    comparisonRows,
    trendChartsData,
  };
}

export async function getSamplePdf(sampleNumber) {
  const client = createS360Client();

  return executeWithTokenRetry(client, (token) =>
    client.viewSampleResultPdf({
      tokenType: token.tokenType,
      accessToken: token.accessToken,
      sampleNumber,
    })
  );
}

