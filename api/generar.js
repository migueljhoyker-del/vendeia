export default async function handler(req, res) {
  // =========================================================
  // MÉTODO HTTP
  // =========================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido."
    });
  }

  // =========================================================
  // COMPROBAR API KEY
  // =========================================================

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("VendeIA: OPENAI_API_KEY no configurada.");

    return res.status(500).json({
      error:
        "La IA no está configurada todavía. Revisa la variable OPENAI_API_KEY en Vercel."
    });
  }

  try {
    // =======================================================
    // DATOS RECIBIDOS
    // =======================================================

    const body = req.body || {};

    const product = cleanInput(body.product);
    const category = cleanInput(body.category);
    const brand = cleanInput(body.brand);
    const condition = cleanInput(body.condition);
    const price = cleanInput(body.price);
    const details = cleanInput(body.details);

    // =======================================================
    // VALIDACIÓN
    // =======================================================

    if (!product) {
      return res.status(400).json({
        error: "Indica qué producto quieres vender."
      });
    }

    if (product.length > 200) {
      return res.status(400).json({
        error:
          "El nombre del producto es demasiado largo."
      });
    }

    if (details.length > 5000) {
      return res.status(400).json({
        error:
          "Los detalles del producto no pueden superar los 5.000 caracteres."
      });
    }

    // =======================================================
    // PROMPT
    // =======================================================

    const prompt = `
Eres VendeIA, un asistente especializado en ayudar a personas
a vender productos de segunda mano en España.

Tu objetivo es crear anuncios claros, atractivos, naturales y
orientados a conseguir compradores.

REGLAS IMPORTANTES:

- No inventes características.
- No inventes accesorios.
- No inventes especificaciones técnicas.
- No inventes garantías.
- No inventes defectos.
- No inventes información que el vendedor no haya proporcionado.
- Utiliza únicamente los datos recibidos.
- El título debe ser atractivo y fácil de encontrar mediante búsquedas.
- La descripción debe sonar escrita por una persona real.
- Evita lenguaje exagerado o poco creíble.
- No utilices frases típicas de spam.
- No repitas innecesariamente información.
- Utiliza español natural de España.
- No menciones que eres una IA.
- No añadas explicaciones fuera del formato solicitado.

DATOS DEL PRODUCTO

Producto:
${product}

Categoría:
${category || "No especificada"}

Marca:
${brand || "No especificada"}

Estado:
${condition || "No especificado"}

Precio:
${price || "No especificado"}

Detalles proporcionados por el vendedor:
${details || "No se han proporcionado detalles adicionales."}

DEVUELVE EXACTAMENTE ESTE FORMATO:

TÍTULO:
[Un título optimizado para el anuncio]

DESCRIPCIÓN:
[Una descripción completa, natural y convincente basada únicamente en los datos proporcionados]

PALABRAS CLAVE:
[10 palabras o frases relevantes separadas por comas]
`;

    // =======================================================
    // LLAMADA A OPENAI
    // =======================================================

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: "gpt-5-mini",
          input: prompt,
          store: false
        })
      }
    );

    // =======================================================
    // RESPUESTA DE OPENAI
    // =======================================================

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "VendeIA / OpenAI:",
        data?.error || data
      );

      const openAIMessage =
        data?.error?.message ||
        "OpenAI no pudo procesar la solicitud.";

      return res.status(response.status).json({
        error: openAIMessage
      });
    }

    // =======================================================
    // EXTRAER TEXTO
    // =======================================================

    const result =
      data?.output_text ||
      extractOutputText(data);

    if (!result) {
      console.error(
        "VendeIA: OpenAI respondió sin texto.",
        data
      );

      return res.status(502).json({
        error:
          "La IA respondió correctamente, pero no devolvió ningún anuncio."
      });
    }

    // =======================================================
    // RESPUESTA FINAL
    // =======================================================

    return res.status(200).json({
      result: result.trim()
    });

  } catch (error) {
    console.error(
      "VendeIA / Error interno:",
      error
    );

    return res.status(500).json({
      error:
        "Ha ocurrido un error interno al generar el anuncio."
    });
  }
}


// ===========================================================
// LIMPIAR ENTRADAS
// ===========================================================

function cleanInput(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/\u0000/g, "")
    .trim();
}


// ===========================================================
// COMPATIBILIDAD CON RESPONSES API
// ===========================================================

function extractOutputText(data) {
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
