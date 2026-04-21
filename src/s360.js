class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function buildUrl(baseUrl, path) {
  const sanitizedBase = String(baseUrl || "").replace(/\/+$/, "");
  return `${sanitizedBase}${path}`;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  try {
    return await response.text();
  } catch (_error) {
    return null;
  }
}

function getErrorMessage(body, fallback) {
  if (!body) {
    return fallback;
  }

  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  if (typeof body === "object") {
    return body.mensagem || body.message || fallback;
  }

  return fallback;
}

class S360Client {
  constructor({ baseUrl, subscriptionKey }) {
    this.baseUrl = baseUrl;
    this.subscriptionKey = subscriptionKey || "";
  }

  createHeaders(extra = {}) {
    const headers = { ...extra };
    if (this.subscriptionKey) {
      headers["Ocp-Apim-Subscription-Key"] = this.subscriptionKey;
    }
    return headers;
  }

  async postJson(path, body, headers = {}) {
    const response = await fetch(buildUrl(this.baseUrl, path), {
      method: "POST",
      headers: this.createHeaders({
        "Content-Type": "application/json",
        ...headers,
      }),
      body: JSON.stringify(body),
    });

    const responseBody = await parseResponseBody(response);
    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(
          responseBody,
          `Error ${response.status} al llamar ${path}.`
        ),
        response.status,
        responseBody
      );
    }

    return responseBody;
  }

  async getJson(path, headers = {}) {
    const response = await fetch(buildUrl(this.baseUrl, path), {
      method: "GET",
      headers: this.createHeaders(headers),
    });

    const responseBody = await parseResponseBody(response);
    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(
          responseBody,
          `Error ${response.status} al llamar ${path}.`
        ),
        response.status,
        responseBody
      );
    }

    return responseBody;
  }

  async getBinary(path, headers = {}) {
    const response = await fetch(buildUrl(this.baseUrl, path), {
      method: "GET",
      headers: this.createHeaders(headers),
    });

    if (!response.ok) {
      const responseBody = await parseResponseBody(response);
      throw new ApiError(
        getErrorMessage(
          responseBody,
          `Error ${response.status} al llamar ${path}.`
        ),
        response.status,
        responseBody
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async login({ username, password }) {
    const responseBody = await this.postJson("/api/login", {
      username,
      password,
    });

    if (!responseBody || !responseBody.access_token) {
      throw new ApiError(
        "La API no devolvio access_token en el login.",
        500,
        responseBody
      );
    }

    return responseBody;
  }

  async listSampleResults({ tokenType, accessToken, filter }) {
    return this.postJson("/api/v3/resultadoAmostra/list", filter, {
      Authorization: `${tokenType || "Bearer"} ${accessToken}`,
    });
  }

  async listEquipment({ tokenType, accessToken, filter }) {
    return this.postJson("/api/v1/equipamento/list", filter, {
      Authorization: `${tokenType || "Bearer"} ${accessToken}`,
    });
  }

  async searchSampleResultsByEquipment({ tokenType, accessToken, filter }) {
    return this.postJson("/api/v1/sampleResult/search", filter, {
      Authorization: `${tokenType || "Bearer"} ${accessToken}`,
    });
  }

  async viewSampleResult({ tokenType, accessToken, sampleNumber }) {
    const encodedSampleNumber = encodeURIComponent(String(sampleNumber));
    return this.getJson(
      `/api/v3/resultadoAmostra/view?numeroAmostra=${encodedSampleNumber}`,
      {
        Authorization: `${tokenType || "Bearer"} ${accessToken}`,
      }
    );
  }

  async viewSampleResultBySampleNumber({
    tokenType,
    accessToken,
    sampleNumber,
  }) {
    const encodedSampleNumber = encodeURIComponent(String(sampleNumber));
    return this.getJson(`/api/v1/sampleResult/view/${encodedSampleNumber}`, {
      Authorization: `${tokenType || "Bearer"} ${accessToken}`,
    });
  }

  async viewSampleResultPdf({ tokenType, accessToken, sampleNumber }) {
    const encodedSampleNumber = encodeURIComponent(String(sampleNumber));
    return this.getBinary(
      `/api/v1/resultadoAmostra/viewPdf?numeroAmostra=${encodedSampleNumber}`,
      {
        Authorization: `${tokenType || "Bearer"} ${accessToken}`,
      }
    );
  }
}

module.exports = {
  S360Client,
  ApiError,
};
