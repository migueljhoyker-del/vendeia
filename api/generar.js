const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const MAX_DETAILS = 5000;
const MAX_IMAGES = 6;
const MAX_IMAGE_DATA_URL_LENGTH = 620000;
const REQUEST_TIMEOUT_MS = 55000;

export default async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("VendeIA: OPENAI_API_KEY no configurada.");
    return res.status(500).json({
      ok: false,
      code: "MISSING_API_KEY",
      error: "La IA no está configurada todavía. Revisa OPENAI_API_KEY en Vercel."
    });
  }

  try {
    const body = normalizeBody(req.body);
    const mode = body.mode || "generate";

    validateCommon(body);

    if (mode === "generate") {
      return await handleGenerate(req, res, apiKey, body);
    }

    if (mode === "photo") {
      return await handlePhoto(req, res, apiKey, body);
    }

    if (mode === "price") {
      return await handlePrice(req, res, apiKey, body);
    }

    if (mode === "reply") {
      return await handleReply(req, res, apiKey, body);
    }

    if (mode === "listing_analysis") {
      return await handleListingAnalysis(req, res, apiKey, body);
    }

    return res.status(400).json({
      ok: false,
      code: "UNKNOWN_MODE",
      error: "Operación no reconocida."
    });
  } catch (error) {
    console.error("VendeIA / Error interno:", error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        code: error.code || "REQUEST_ERROR",
        error: error.message || "La solicitud no pudo procesarse."
      });
    }

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      error: "Ha ocurrido un error interno al procesar la solicitud."
    });
  }
}

async function handleGenerate(req, res, apiKey, body) {
  const prompt = buildGeneratePrompt(body);
  const input = buildInput(prompt, body.images);

  const result = await callOpenAI({
    apiKey,
    input,
    model: MODEL,
    maxOutputTokens: 2200
  });

  const data = parseModelJson(result.text, {
    title: "",
    description: "",
    keywords: [],
    hashtags: [],
    buyer_replies: [],
    photo_advice: [],
    quality_score: 0,
    quality_summary: ""
  });

  return res.status(200).json({
    ok: true,
    mode: "generate",
    model: MODEL,
    result: data,
    raw: result.text
  });
}

async function handlePhoto(req, res, apiKey, body) {
  if (!body.images.length) {
    throw makeError(400, "NO_IMAGES", "Adjunta al menos una fotografía para analizarla.");
  }

  const prompt = buildPhotoPrompt(body);
  const input = buildInput(prompt, body.images);

  const result = await callOpenAI({
    apiKey,
    input,
    model: MODEL,
    maxOutputTokens: 1800
  });

  const data = parseModelJson(result.text, {
    visible_product: "",
    visible_brand: "",
    visible_model: "",
    visible_features: [],
    condition_observations: [],
    possible_issues: [],
    photo_quality: 0,
    photo_strengths: [],
    photo_improvements: [],
    listing_ready: false,
    caution: ""
  });

  return res.status(200).json({
    ok: true,
    mode: "photo",
    model: MODEL,
    result: data
  });
}

async function handlePrice(req, res, apiKey, body) {
  if (!body.product) {
    throw makeError(400, "MISSING_PRODUCT", "Indica el producto para poder estudiar el precio.");
  }

  const prompt = buildPricePrompt(body);
  const input = buildInput(prompt, body.images);

  const result = await callOpenAI({
    apiKey,
    input,
    model: MODEL,
    maxOutputTokens: 2200,
    webSearch: true
  });

  const data = parseModelJson(result.text, {
    market_context: "",
    suggested_price: null,
    quick_sale_price: null,
    negotiation_floor: null,
    price_range_low: null,
    price_range_high: null,
    confidence: 0,
    recommendation: "",
    factors: [],
    sources_note: ""
  });

  return res.status(200).json({
    ok: true,
    mode: "price",
    model: MODEL,
    result: data,
    web_search_used: true
  });
}

async function handleReply(req, res, apiKey, body) {
  const question = cleanInput(body.question, 1000);

  if (!question) {
    throw makeError(400, "MISSING_QUESTION", "Escribe el mensaje del comprador.");
  }

  const prompt = buildReplyPrompt(body, question);
  const input = buildInput(prompt, body.images);

  const result = await callOpenAI({
    apiKey,
    input,
    model: MODEL,
    maxOutputTokens: 900
  });

  const data = parseModelJson(result.text, {
    response: "",
    shorter_response: "",
    firmer_response: ""
  });

  return res.status(200).json({
    ok: true,
    mode: "reply",
    model: MODEL,
    result: data
  });
}

async function handleListingAnalysis(req, res, apiKey, body) {
  const listing = cleanInput(body.listing, 8000);

  if (!listing) {
    throw makeError(400, "MISSING_LISTING", "Necesito el anuncio para poder analizarlo.");
  }

  const prompt = buildListingAnalysisPrompt(body, listing);
  const input = buildInput(prompt, body.images);

  const result = await callOpenAI({
    apiKey,
    input,
    model: MODEL,
    maxOutputTokens: 1700
  });

  const data = parseModelJson(result.text, {
    score: 0,
    verdict: "",
    strengths: [],
    weaknesses: [],
    missing_information: [],
    improved_title: "",
    improved_description: "",
    actions: []
  });

  return res.status(200).json({
    ok: true,
    mode: "listing_analysis",
    model: MODEL,
    result: data
  });
}

async function callOpenAI({
  apiKey,
  input,
  model,
  maxOutputTokens,
  webSearch = false
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const payload = {
    model,
    input,
    max_output_tokens: maxOutputTokens,
    store: false
  };

  if (webSearch) {
    payload.tools = [
      {
        type: "web_search",
        search_context_size: "medium"
      }
    ];
  }

  let response;

  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw makeError(
        504,
        "OPENAI_TIMEOUT",
        "La IA está tardando demasiado. Inténtalo de nuevo."
      );
    }

    throw makeError(
      502,
      "OPENAI_NETWORK",
      "No se pudo conectar con el servicio de IA."
    );
  } finally {
    clearTimeout(timeout);
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw makeError(
      502,
      "OPENAI_INVALID_RESPONSE",
      "El servicio de IA devolvió una respuesta no válida."
    );
  }

  if (!response.ok) {
    console.error("VendeIA / OpenAI:", data?.error || data);

    const providerMessage = cleanInput(
      data?.error?.message,
      500
    );

    if (response.status === 401) {
      throw makeError(
        502,
        "OPENAI_AUTH",
        "La clave de OpenAI no es válida o no está activa."
      );
    }

    if (response.status === 402) {
      throw makeError(
        402,
        "OPENAI_BILLING",
        "La cuenta de OpenAI necesita saldo o facturación activa para utilizar la API."
      );
    }

    if (response.status === 429) {
      throw makeError(
        429,
        "OPENAI_RATE_LIMIT",
        "OpenAI ha limitado temporalmente esta solicitud. Espera unos segundos y vuelve a intentarlo."
      );
    }

    if (response.status === 400 && /model/i.test(providerMessage)) {
      throw makeError(
        502,
        "OPENAI_MODEL",
        `El modelo configurado (${model}) no está disponible para este proyecto. Revisa OPENAI_MODEL en Vercel.`
      );
    }

    throw makeError(
      502,
      "OPENAI_PROVIDER",
      providerMessage || "OpenAI no pudo procesar la solicitud."
    );
  }

  const text = extractOutputText(data);

  if (!text) {
    console.error("VendeIA: OpenAI respondió sin output_text.", data);
    throw makeError(
      502,
      "EMPTY_AI_RESPONSE",
      "La IA respondió, pero no devolvió contenido utilizable."
    );
  }

  return {
    text,
    response: data
  };
}

function buildInput(prompt, images) {
  const content = [
    {
      type: "input_text",
      text: prompt
    }
  ];

  for (const image of images) {
    content.push({
      type: "input_image",
      image_url: image.data,
      detail: "high"
    });
  }

  return [
    {
      role: "user",
      content
    }
  ];
}

function buildGeneratePrompt(body) {
  return `
Eres VendeIA, un sistema profesional de inteligencia artificial para vendedores de segunda mano en España.

OBJETIVO:
Crear un paquete completo para publicar y vender mejor un producto, utilizando únicamente información que el vendedor haya proporcionado o que pueda observarse razonablemente en las fotografías.

REGLAS ABSOLUTAS:
- No inventes características.
- No inventes accesorios.
- No inventes garantía, factura, fecha de compra o procedencia.
- No inventes defectos que no puedan observarse.
- No conviertas una suposición visual en un hecho.
- Si una característica no está confirmada, no la afirmes.
- No afirmes que un precio es barato o caro sin datos de mercado.
- Español natural de España.
- Nada de lenguaje de spam.
- Nada de frases robóticas.
- Prioriza claridad y utilidad.
- El usuario quiere vender, pero la descripción debe ser honesta.

PLATAFORMA: ${body.platform || "general"}
OBJETIVO: ${body.goal || "balanced"}
CATEGORÍA: ${body.category || "No indicada"}
MARCA: ${body.brand || "No indicada"}
ESTADO DECLARADO: ${body.condition || "No indicado"}
PRECIO DECLARADO: ${body.price || "No indicado"}
PRODUCTO: ${body.product || "No indicado"}
DETALLES DEL VENDEDOR:
${body.details || "Sin detalles adicionales."}

FOTOGRAFÍAS:
Se han adjuntado ${body.images.length} fotografía(s). Analízalas como evidencia visual complementaria. Solo utiliza datos visibles con suficiente claridad.

GENERA:
1. Título optimizado.
2. Descripción lista para publicar.
3. Exactamente 10 palabras clave.
4. Hasta 8 hashtags relevantes, sin inventar atributos.
5. 5 respuestas preparadas para preguntas habituales de compradores.
6. Hasta 6 consejos concretos para mejorar las fotografías o el anuncio.
7. Una puntuación de calidad de 0 a 100 basada en claridad, información, confianza y presentación; no es una probabilidad de venta.
8. Un resumen corto de la calidad del anuncio.

DEVUELVE ÚNICAMENTE JSON VÁLIDO, SIN MARKDOWN, CON ESTA ESTRUCTURA:
{
  "title": "string",
  "description": "string",
  "keywords": ["string"],
  "hashtags": ["string"],
  "buyer_replies": ["string"],
  "photo_advice": ["string"],
  "quality_score": 0,
  "quality_summary": "string"
}
`;
}

function buildPhotoPrompt(body) {
  return `
Eres el analizador visual de VendeIA para anuncios de segunda mano.

Analiza cuidadosamente las fotografías adjuntas.

CONTEXTO DECLARADO POR EL VENDEDOR:
Producto: ${body.product || "No indicado"}
Marca: ${body.brand || "No indicada"}
Estado declarado: ${body.condition || "No indicado"}
Detalles: ${body.details || "Sin detalles."}

OBJETIVO:
Detectar qué información útil puede extraerse visualmente y qué debería mejorar el vendedor antes de publicar.

REGLAS:
- Describe solo lo que se pueda observar razonablemente.
- Si algo no se puede confirmar, dilo.
- No identifiques personas.
- No inventes modelo, capacidad, autenticidad o especificaciones.
- Diferencia claramente entre observación y posible problema.
- Si aparece un defecto visual, descríbelo con cautela.
- No asegures que un artículo funciona si solo se ve por fuera.
- La puntuación es de calidad fotográfica, no de valor del producto.

DEVUELVE ÚNICAMENTE JSON VÁLIDO:
{
  "visible_product": "string",
  "visible_brand": "string",
  "visible_model": "string",
  "visible_features": ["string"],
  "condition_observations": ["string"],
  "possible_issues": ["string"],
  "photo_quality": 0,
  "photo_strengths": ["string"],
  "photo_improvements": ["string"],
  "listing_ready": false,
  "caution": "string"
}
`;
}

function buildPricePrompt(body) {
  return `
Eres el módulo de estrategia de precio de VendeIA para España.

Necesitas estudiar referencias públicas actuales de Internet antes de proponer una estrategia.
Usa búsqueda web para localizar precios y referencias relevantes del producto, dando prioridad a España y a productos idénticos o equivalentes claramente comparables.

PRODUCTO: ${body.product}
MARCA: ${body.brand || "No indicada"}
CATEGORÍA: ${body.category || "No indicada"}
ESTADO: ${body.condition || "No indicado"}
PRECIO DEL VENDEDOR: ${body.price || "No indicado"}
DETALLES:
${body.details || "Sin detalles."}

REGLAS:
- No presentes una estimación como precio exacto de mercado.
- Distingue entre producto idéntico, comparable y referencia débil.
- Ten en cuenta estado, accesorios y antigüedad solo cuando estén confirmados.
- Si faltan datos para una valoración precisa, reduce la confianza.
- No inventes ventas cerradas; una página con un precio publicado no demuestra que se haya vendido a ese precio.
- El resultado es orientación para el vendedor, no una tasación profesional.

DEVUELVE ÚNICAMENTE JSON VÁLIDO:
{
  "market_context": "string",
  "suggested_price": 0,
  "quick_sale_price": 0,
  "negotiation_floor": 0,
  "price_range_low": 0,
  "price_range_high": 0,
  "confidence": 0,
  "recommendation": "string",
  "factors": ["string"],
  "sources_note": "string"
}
`;
}

function buildReplyPrompt(body, question) {
  return `
Eres el asistente de negociación de VendeIA.

PRODUCTO: ${body.product || "No indicado"}
MARCA: ${body.brand || "No indicada"}
ESTADO: ${body.condition || "No indicado"}
PRECIO: ${body.price || "No indicado"}
DETALLES:
${body.details || "Sin detalles."}

MENSAJE DEL COMPRADOR:
${question}

Redacta una respuesta breve, natural y educada en español de España.
No inventes información. Si el comprador pregunta algo que el vendedor no ha indicado, responde de forma honesta indicando que debe confirmarlo.
No aceptes una oferta concreta si el usuario no ha autorizado esa decisión.

DEVUELVE ÚNICAMENTE JSON VÁLIDO:
{
  "response": "string",
  "shorter_response": "string",
  "firmer_response": "string"
}
`;
}

function buildListingAnalysisPrompt(body, listing) {
  return `
Eres el auditor de anuncios de VendeIA.

Analiza el anuncio siguiente para mejorar su claridad, confianza, descubribilidad y capacidad de negociación.

PRODUCTO: ${body.product || "No indicado"}
PRECIO: ${body.price || "No indicado"}
PLATAFORMA: ${body.platform || "general"}

ANUNCIO:
${listing}

FOTOGRAFÍAS: ${body.images.length} adjuntadas.

REGLAS:
- No evalúes a la persona.
- No prometas ventas.
- No inventes información.
- Señala exactamente qué falta o qué puede generar dudas.
- Si propones una mejora, mantén los hechos del anuncio.

DEVUELVE ÚNICAMENTE JSON VÁLIDO:
{
  "score": 0,
  "verdict": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "missing_information": ["string"],
  "improved_title": "string",
  "improved_description": "string",
  "actions": ["string"]
}
`;
}

function parseModelJson(text, fallback) {
  const clean = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(clean);
    return mergeWithFallback(parsed, fallback);
  } catch {
    const extracted = extractFirstJsonObject(clean);

    if (extracted) {
      try {
        return mergeWithFallback(
          JSON.parse(extracted),
          fallback
        );
      } catch {
        // Continue to fallback below.
      }
    }

    return mergeWithFallback(
      { raw: clean },
      fallback
    );
  }
}

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return "";
  }

  return text.slice(start, end + 1);
}

function mergeWithFallback(value, fallback) {
  const output = {
    ...fallback
  };

  if (!value || typeof value !== "object") {
    return output;
  }

  for (const [key, fallbackValue] of Object.entries(fallback)) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      output[key] = normalizeOutputValue(
        value[key],
        fallbackValue
      );
    }
  }

  if (typeof value.raw === "string") {
    output.raw = value.raw;
  }

  return output;
}

function normalizeOutputValue(value, fallback) {
  if (Array.isArray(fallback)) {
    return Array.isArray(value)
      ? value
          .map((item) => String(item).trim())
          .filter(Boolean)
      : fallback;
  }

  if (typeof fallback === "number") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  if (typeof fallback === "boolean") {
    return Boolean(value);
  }

  if (typeof fallback === "string") {
    return typeof value === "string"
      ? value.trim()
      : fallback;
  }

  if (fallback === null) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return value ?? fallback;
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text.trim();
  }

  if (!Array.isArray(data?.output)) {
    return "";
  }

  const parts = [];

  for (const item of data.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if (
        content?.type === "output_text" &&
        typeof content?.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

function normalizeBody(rawBody) {
  const body = rawBody && typeof rawBody === "object"
    ? rawBody
    : {};

  const images = normalizeImages(body.images);

  return {
    mode: cleanInput(body.mode, 40).toLowerCase() || "generate",
    product: cleanInput(body.product, 200),
    platform: cleanInput(body.platform, 40).toLowerCase() || "general",
    goal: cleanInput(body.goal, 40).toLowerCase() || "balanced",
    category: cleanInput(body.category, 100),
    brand: cleanInput(body.brand, 150),
    condition: cleanInput(body.condition, 100),
    price: cleanInput(body.price, 80),
    details: cleanInput(body.details, MAX_DETAILS),
    question: cleanInput(body.question, 1000),
    listing: cleanInput(body.listing, 8000),
    images
  };
}

function normalizeImages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.length > MAX_IMAGES) {
    throw makeError(
      400,
      "TOO_MANY_IMAGES",
      `Puedes adjuntar como máximo ${MAX_IMAGES} fotografías.`
    );
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw makeError(400, "INVALID_IMAGE", `La fotografía ${index + 1} no es válida.`);
    }

    const data = String(item.data || "").trim();
    const type = String(item.type || "").toLowerCase();

    if (!/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(data)) {
      throw makeError(
        400,
        "INVALID_IMAGE_FORMAT",
        `La fotografía ${index + 1} debe ser JPG, PNG o WebP.`
      );
    }

    if (data.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw makeError(
        400,
        "IMAGE_TOO_LARGE",
        `La fotografía ${index + 1} es demasiado grande después de la compresión. Vuelve a seleccionarla.`
      );
    }

    return {
      data,
      type
    };
  });
}

function validateCommon(body) {
  const validModes = new Set([
    "generate",
    "photo",
    "price",
    "reply",
    "listing_analysis"
  ]);

  if (!validModes.has(body.mode)) {
    throw makeError(400, "UNKNOWN_MODE", "Operación no reconocida.");
  }

  if (body.product.length > 200) {
    throw makeError(400, "PRODUCT_TOO_LONG", "El nombre del producto es demasiado largo.");
  }

  if (body.details.length > MAX_DETAILS) {
    throw makeError(400, "DETAILS_TOO_LONG", "Los detalles no pueden superar los 5.000 caracteres.");
  }
}

function cleanInput(value, maxLength = 10000) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function makeError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function setSecurityHeaders(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
}
