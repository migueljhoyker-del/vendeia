export default async function handler(req, res) {
  // =========================================================
  // MÉTODO
  // =========================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido."
    });
  }

  // =========================================================
  // API KEY
  // =========================================================

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error(
      "VendeIA: OPENAI_API_KEY no configurada."
    );

    return res.status(500).json({
      error:
        "La IA no está configurada todavía. Revisa OPENAI_API_KEY en Vercel."
    });
  }

  try {
    // =======================================================
    // DATOS
    // =======================================================

    const body = req.body || {};

    const product = cleanInput(body.product);
    const platform = cleanInput(body.platform) || "general";
    const goal = cleanInput(body.goal) || "balanced";
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
        error:
          "Indica qué producto quieres vender."
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
    // CONTEXTO DE PLATAFORMA
    // =======================================================

    const platformInstructions =
      getPlatformInstructions(platform);

    // =======================================================
    // CONTEXTO DE OBJETIVO
    // =======================================================

    const goalInstructions =
      getGoalInstructions(goal);

    // =======================================================
    // PROMPT
    // =======================================================

    const prompt = `
Eres VendeIA, un asistente especializado en ayudar
a personas a vender productos online en España.

Tu trabajo consiste en transformar la información
real proporcionada por el vendedor en un anuncio
claro, atractivo y útil para compradores.

========================================================
REGLAS PRINCIPALES
========================================================

1. NO inventes información.

2. NO inventes características técnicas.

3. NO inventes accesorios.

4. NO inventes garantías.

5. NO inventes defectos.

6. NO inventes fechas de compra.

7. NO inventes facturas.

8. NO inventes ubicación.

9. NO inventes envíos.

10. Si una información no ha sido proporcionada,
no la presentes como un hecho.

11. Utiliza español natural de España.

12. El anuncio debe parecer escrito por una persona real.

13. Evita exageraciones artificiales.

14. Evita frases de spam.

15. No repitas innecesariamente la misma información.

16. No menciones que eres una IA.

17. No expliques estas instrucciones al usuario.

========================================================
PLATAFORMA
========================================================

${platformInstructions}

========================================================
OBJETIVO DE VENTA
========================================================

${goalInstructions}

========================================================
DATOS DEL PRODUCTO
========================================================

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

========================================================
ESTRUCTURA DEL ANUNCIO
========================================================

TÍTULO:

Crea un título atractivo y fácil de encontrar.

Debe ser claro y relevante para el producto.

No utilices palabras que no estén justificadas por
la información proporcionada.

DESCRIPCIÓN:

Escribe una descripción natural y convincente.

Organiza la información de forma sencilla.

Incluye las características proporcionadas por el vendedor.

Si existe información sobre estado, uso, accesorios
o motivo de venta, intégrala de forma natural.

No inventes nada.

PALABRAS CLAVE:

Genera exactamente 10 palabras o frases relevantes
para las búsquedas relacionadas con el producto.

========================================================
FORMATO DE RESPUESTA
========================================================

Devuelve ÚNICAMENTE:

TÍTULO:
[texto]

DESCRIPCIÓN:
[texto]

PALABRAS CLAVE:
[10 palabras o frases separadas por comas]
`;

    // =======================================================
    // OPENAI RESPONSES API
    // =======================================================

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: "gpt-5.6-luna",
          input: prompt,
          store: false
        })
      }
    );

    // =======================================================
    // RESPUESTA OPENAI
    // =======================================================

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "VendeIA / OpenAI:",
        data?.error || data
      );

      const message =
        data?.error?.message ||
        "OpenAI no pudo procesar la solicitud.";

      return res.status(
        response.status
      ).json({
        error: message
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
        "VendeIA: respuesta sin texto.",
        data
      );

      return res.status(502).json({
        error:
          "La IA respondió correctamente, pero no devolvió ningún anuncio."
      });
    }

    // =======================================================
    // RESPUESTA
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
// INSTRUCCIONES DE PLATAFORMA
// ===========================================================

function getPlatformInstructions(platform) {

  const instructions = {

    general: `
Plataforma genérica.

Crea un anuncio versátil que pueda utilizarse
en diferentes plataformas de compraventa.
`,

    wallapop: `
La plataforma objetivo es Wallapop.

Prioriza:
- Título claro y directo.
- Información importante rápidamente visible.
- Lenguaje natural.
- Palabras clave relevantes.
- Facilidad de lectura desde móvil.
- Evitar exceso de texto.
`,

    vinted: `
La plataforma objetivo es Vinted.

Prioriza:
- Descripción clara.
- Estado real del artículo.
- Marca.
- Características relevantes.
- Información útil para compradores.
- Lenguaje natural y conciso.
`,

    facebook: `
La plataforma objetivo es Facebook Marketplace.

Prioriza:
- Título fácil de entender.
- Información esencial al principio.
- Descripción clara.
- Estado.
- Precio.
- Información relevante para facilitar el contacto.
`,

    ebay: `
La plataforma objetivo es eBay.

Prioriza:
- Título descriptivo.
- Información específica del producto.
- Características relevantes.
- Palabras clave útiles.
- Descripción estructurada.
`
  };

  return (
    instructions[platform] ||
    instructions.general
  );
}


// ===========================================================
// INSTRUCCIONES DE OBJETIVO
// ===========================================================

function getGoalInstructions(goal) {

  const instructions = {

    fast: `
El objetivo es VENDER RÁPIDO.

Prioriza:
- Claridad.
- Información esencial.
- Título directo.
- Descripción fácil de leer.
- Evitar texto innecesario.
- Destacar las características que puedan facilitar
  una decisión rápida.

No inventes descuentos ni promociones.
`,

    balanced: `
El objetivo es conseguir un EQUILIBRIO entre atractivo,
claridad y precio.

Prioriza:
- Buena presentación.
- Información suficiente.
- Título atractivo.
- Descripción convincente.
- Destacar correctamente las características reales.
`,

    maximum: `
El objetivo es intentar POSICIONAR EL PRODUCTO
DE LA FORMA MÁS ATRACTIVA POSIBLE sin inventar
información.

Prioriza:
- Presentación cuidada.
- Beneficios derivados únicamente de las características
  proporcionadas.
- Título descriptivo.
- Descripción completa.
- Destacar estado y características relevantes.

No afirmes que el precio es barato, caro o el mejor
del mercado porque no dispones de datos de mercado.
`
  };

  return (
    instructions[goal] ||
    instructions.balanced
  );
}


// ===========================================================
// LIMPIAR ENTRADAS
// ===========================================================

function cleanInput(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .replace(/\u0000/g, "")
    .trim();
}


// ===========================================================
// EXTRAER TEXTO DE RESPONSES API
// ===========================================================

function extractOutputText(data) {

  if (
    !Array.isArray(data?.output)
  ) {
    return "";
  }

  const parts = [];

  for (
    const item of data.output
  ) {

    if (
      !Array.isArray(item?.content)
    ) {
      continue;
    }

    for (
      const content of item.content
    ) {

      if (
        content?.type === "output_text" &&
        typeof content?.text === "string"
      ) {
        parts.push(
          content.text
        );
      }
    }
  }

  return parts
    .join("\n")
    .trim();
}
