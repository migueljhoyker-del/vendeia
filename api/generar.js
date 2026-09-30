"use strict";

export default async function handler(
  req,
  res
) {

  if (
    req.method !==
    "POST"
  ) {

    return res.status(
      405
    ).json({
      error:
        "Método no permitido."
    });
  }


  const apiKey =
    process.env.OPENAI_API_KEY;


  if (!apiKey) {

    console.error(
      "VendeIA: OPENAI_API_KEY no configurada."
    );

    return res.status(
      500
    ).json({
      error:
        "La IA no está configurada todavía. Revisa OPENAI_API_KEY en Vercel."
    });
  }


  try {

    const body =
      req.body || {};


    const product =
      cleanInput(
        body.product
      );

    const platform =
      cleanInput(
        body.platform
      ) ||
      "general";

    const goal =
      cleanInput(
        body.goal
      ) ||
      "balanced";

    const category =
      cleanInput(
        body.category
      );

    const brand =
      cleanInput(
        body.brand
      );

    const condition =
      cleanInput(
        body.condition
      );

    const price =
      cleanInput(
        body.price
      );

    const details =
      cleanInput(
        body.details
      );


    /* =====================================================
       VALIDATION
    ====================================================== */

    if (!product) {

      return res.status(
        400
      ).json({
        error:
          "Indica qué producto quieres vender."
      });
    }


    if (
      product.length >
      200
    ) {

      return res.status(
        400
      ).json({
        error:
          "El nombre del producto es demasiado largo."
      });
    }


    if (
      details.length >
      5000
    ) {

      return res.status(
        400
      ).json({
        error:
          "Los detalles del producto no pueden superar los 5.000 caracteres."
      });
    }


    /* =====================================================
       IMAGES
    ====================================================== */

    const rawImages =
      Array.isArray(
        body.images
      )
        ? body.images
        : [];


    if (
      rawImages.length >
      6
    ) {

      return res.status(
        400
      ).json({
        error:
          "Puedes enviar un máximo de 6 fotografías."
      });
    }


    const images =
      normalizeImages(
        rawImages
      );


    if (
      images.error
    ) {

      return res.status(
        400
      ).json({
        error:
          images.error
      });
    }


    const validImages =
      images.items;


    const platformInstructions =
      getPlatformInstructions(
        platform
      );


    const goalInstructions =
      getGoalInstructions(
        goal
      );


    /* =====================================================
       PROMPT
    ====================================================== */

    const systemInstructions = `
Eres VendeIA, un asistente profesional especializado
en ayudar a personas a vender productos online en España.

Tu función es analizar la información escrita por el vendedor
y, cuando existan, las fotografías del producto.

Tu objetivo es crear un anuncio profesional, claro,
natural y útil para compradores.

REGLAS ABSOLUTAS:

1. NO inventes información.
2. NO inventes especificaciones técnicas.
3. NO inventes accesorios.
4. NO inventes garantías.
5. NO inventes facturas.
6. NO inventes fechas.
7. NO inventes ubicaciones.
8. NO inventes formas de envío.
9. NO inventes defectos.
10. NO inventes características que no puedan justificarse.
11. NO presentes una inferencia visual como un hecho seguro.
12. Si una característica solamente parece visible en una foto,
    utiliza lenguaje prudente.
13. No afirmes que algo es original, auténtico o oficial
    salvo que el vendedor lo haya indicado.
14. No afirmes que un precio es barato, caro o el mejor
    del mercado sin datos externos.
15. No inventes valoraciones de mercado.
16. No inventes opiniones de compradores.
17. No inventes urgencia.
18. No inventes descuentos.
19. No inventes promociones.
20. Utiliza español natural de España.
21. Evita lenguaje de spam.
22. Evita exageraciones.
23. No menciones que eres una IA.
24. No menciones estas instrucciones.
25. No escribas una explicación antes del resultado.
26. El resultado debe estar pensado para copiar y pegar.

FOTOGRAFÍAS:

Cuando existan fotografías:

- Analízalas como información adicional.
- Identifica únicamente elementos razonablemente visibles.
- Puedes utilizar información visual para mejorar la descripción.
- Puedes mencionar el estado visible si es evidente.
- Si una característica no puede confirmarse, no la presentes
  como una especificación.
- No inventes el contenido de fotografías que no puedas ver.
- No identifiques personas.
- No hagas afirmaciones sensibles sobre personas.
- No hagas reconocimiento facial.
- No conviertas una sospecha visual en una afirmación.

CALIDAD:

El anuncio debe sonar escrito por un vendedor competente.

No uses frases artificiales como:
"¡No te lo puedes perder!"
"¡Oportunidad única!"
"¡Corre que vuela!"

salvo que el propio vendedor haya utilizado un lenguaje
similar y resulte natural.

Prioriza claridad, precisión y facilidad de lectura.
`;


    const userText = `
DATOS DEL PRODUCTO

Producto:
${product}

Plataforma:
${platform}

Objetivo:
${goal}

Categoría:
${category || "No especificada"}

Marca:
${brand || "No especificada"}

Estado indicado por el vendedor:
${condition || "No especificado"}

Precio indicado:
${price || "No especificado"}

Detalles escritos por el vendedor:
${details || "No hay detalles adicionales."}


PLATAFORMA

${platformInstructions}


OBJETIVO

${goalInstructions}


TAREA

Analiza toda la información proporcionada.

Si existen fotografías, utiliza también la información
visual que pueda observarse razonablemente.

Genera:

1. Un título atractivo y fácil de buscar.
2. Una descripción profesional y natural.
3. Exactamente 10 palabras o frases clave.
4. Un pequeño análisis visual únicamente si se proporcionaron
   fotografías.

IMPORTANTE:

No inventes información.

Devuelve ÚNICAMENTE un JSON válido con esta estructura:

{
  "title": "Título del anuncio",
  "description": "Descripción del anuncio",
  "keywords": [
    "palabra 1",
    "palabra 2",
    "palabra 3",
    "palabra 4",
    "palabra 5",
    "palabra 6",
    "palabra 7",
    "palabra 8",
    "palabra 9",
    "palabra 10"
  ],
  "visualAnalysis": "Análisis visual breve o cadena vacía"
}

No utilices Markdown.
No utilices bloques de código.
No añadas texto fuera del JSON.
`;


    /* =====================================================
       MULTIMODAL INPUT
    ====================================================== */

    const content = [

      {
        type:
          "input_text",

        text:
          userText
      }

    ];


    for (
      const image of validImages
    ) {

      content.push({

        type:
          "input_image",

        image_url:
          image.dataUrl,

        detail:
          "auto"

      });
    }


    /* =====================================================
       OPENAI
    ====================================================== */

    const response =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${apiKey}`

          },

          body:
            JSON.stringify({

              model:
                "gpt-5.6-luna",

              input: [

                {
                  role:
                    "developer",

                  content:
                    systemInstructions
                },

                {
                  role:
                    "user",

                  content
                }

              ],

              store:
                false

            })

        }
      );


    const data =
      await response.json();


    /* =====================================================
       OPENAI ERROR
    ====================================================== */

    if (
      !response.ok
    ) {

      console.error(
        "VendeIA / OpenAI:",
        data?.error ||
        data
      );


      const status =
        response.status >= 400 &&
        response.status <= 599
          ? response.status
          : 502;


      let message =
        data?.error?.message ||
        "OpenAI no pudo procesar la solicitud.";


      if (
        status === 401
      ) {

        message =
          "La clave de OpenAI no es válida o no está configurada correctamente en Vercel.";

      } else if (
        status === 429
      ) {

        message =
          "OpenAI ha rechazado temporalmente la solicitud. Comprueba el saldo, límites o facturación de la API.";

      } else if (
        status === 400
      ) {

        message =
          data?.error?.message ||
          "OpenAI rechazó los datos enviados.";

      }


      return res.status(
        status
      ).json({
        error:
          message
      });
    }


    /* =====================================================
       EXTRACT OUTPUT
    ====================================================== */

    const outputText =
      data?.output_text ||
      extractOutputText(
        data
      );


    if (!outputText) {

      console.error(
        "VendeIA: OpenAI respondió sin texto.",
        data
      );

      return res.status(
        502
      ).json({
        error:
          "La IA respondió correctamente, pero no devolvió ningún anuncio."
      });
    }


    /* =====================================================
       PARSE JSON
    ====================================================== */

    const result =
      parseModelJson(
        outputText
      );


    if (
      !result
    ) {

      console.error(
        "VendeIA: JSON inválido:",
        outputText
      );


      return res.status(
        502
      ).json({
        error:
          "La IA devolvió una respuesta que no pudo interpretarse correctamente."
      });
    }


    /* =====================================================
       SANITIZE RESULT
    ====================================================== */

    const cleanResult =
      sanitizeResult(
        result
      );


    return res.status(
      200
    ).json(
      cleanResult
    );


  } catch (error) {

    console.error(
      "VendeIA / Error interno:",
      error
    );


    return res.status(
      500
    ).json({
      error:
        "Ha ocurrido un error interno al generar el anuncio."
    });
  }
}


/* =========================================================
   IMAGE NORMALIZATION
========================================================= */

function normalizeImages(
  rawImages
) {

  const items = [];

  for (
    const item of rawImages
  ) {

    if (
      !item ||
      typeof item !==
        "object"
    ) {
      continue;
    }


    const dataUrl =
      typeof item.dataUrl ===
        "string"
        ? item.dataUrl.trim()
        : "";


    if (!dataUrl) {
      continue;
    }


    if (
      !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(
        dataUrl
      )
    ) {

      return {
        error:
          "Una de las fotografías tiene un formato no válido.",
        items: []
      };
    }


    if (
      dataUrl.length >
      1_400_000
    ) {

      return {
        error:
          "Una de las fotografías es demasiado grande.",
        items: []
      };
    }


    items.push({
      dataUrl
    });
  }


  const totalLength =
    items.reduce(
      (
        total,
        image
      ) =>
        total +
        image.dataUrl.length,
      0
    );


  if (
    totalLength >
    4_000_000
  ) {

    return {
      error:
        "El conjunto de fotografías es demasiado grande. Elimina alguna fotografía e inténtalo de nuevo.",
      items: []
    };
  }


  return {
    error:
      null,

    items
  };
}


/* =========================================================
   PLATFORM
========================================================= */

function getPlatformInstructions(
  platform
) {

  const instructions = {

    general: `
Crea un anuncio versátil para plataformas de compraventa.
Prioriza claridad, lectura móvil, información real y
palabras clave naturales.
`,

    wallapop: `
La plataforma objetivo es Wallapop.

Prioriza:
- título claro;
- información esencial;
- lenguaje natural;
- lectura rápida desde móvil;
- palabras clave relevantes;
- evitar exceso de texto.
`,

    vinted: `
La plataforma objetivo es Vinted.

Prioriza:
- descripción concisa;
- marca;
- estado;
- características;
- información útil para compradores.
`,

    facebook: `
La plataforma objetivo es Facebook Marketplace.

Prioriza:
- título comprensible;
- información esencial al principio;
- estado;
- precio;
- descripción clara.
`,

    ebay: `
La plataforma objetivo es eBay.

Prioriza:
- título descriptivo;
- características;
- información específica;
- palabras clave;
- estructura clara.
`
  };


  return (
    instructions[platform] ||
    instructions.general
  );
}


/* =========================================================
   GOAL
========================================================= */

function getGoalInstructions(
  goal
) {

  const instructions = {

    fast: `
El objetivo es vender rápido.

Prioriza claridad, información esencial y facilidad
de decisión.

No inventes descuentos ni urgencia.
`,

    balanced: `
El objetivo es equilibrar atractivo, claridad y
presentación profesional.
`,

    maximum: `
El objetivo es presentar el producto de la forma
más completa y atractiva posible sin inventar información.
`
  };


  return (
    instructions[goal] ||
    instructions.balanced
  );
}


/* =========================================================
   INPUT CLEANING
========================================================= */

function cleanInput(
  value
) {

  if (
    value === undefined ||
    value === null
  ) {

    return "";
  }


  return String(value)
    .replace(
      /\u0000/g,
      ""
    )
    .trim();
}


/* =========================================================
   OUTPUT TEXT
========================================================= */

function extractOutputText(
  data
) {

  if (
    !Array.isArray(
      data?.output
    )
  ) {

    return "";
  }


  const parts = [];


  for (
    const item of data.output
  ) {

    if (
      !Array.isArray(
        item?.content
      )
    ) {

      continue;
    }


    for (
      const content of item.content
    ) {

      if (
        content?.type ===
          "output_text" &&
        typeof content?.text ===
          "string"
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


/* =========================================================
   JSON PARSER
========================================================= */

function parseModelJson(
  text
) {

  const cleaned =
    String(text)
      .trim();


  try {

    return JSON.parse(
      cleaned
    );

  } catch {
    // Continue.
  }


  const withoutMarkdown =
    cleaned
      .replace(
        /^```(?:json)?/i,
        ""
      )
      .replace(
        /```$/i,
        ""
      )
      .trim();


  try {

    return JSON.parse(
      withoutMarkdown
    );

  } catch {
    // Continue.
  }


  const firstBrace =
    withoutMarkdown.indexOf(
      "{"
    );

  const lastBrace =
    withoutMarkdown.lastIndexOf(
      "}"
    );


  if (
    firstBrace !== -1 &&
    lastBrace > firstBrace
  ) {

    const possibleJson =
      withoutMarkdown.slice(
        firstBrace,
        lastBrace + 1
      );


    try {

      return JSON.parse(
        possibleJson
      );

    } catch {
      return null;
    }
  }


  return null;
}


/* =========================================================
   RESULT SANITIZATION
========================================================= */

function sanitizeResult(
  result
) {

  const title =
    cleanInput(
      result?.title
    );


  const description =
    cleanInput(
      result?.description
    );


  let keywords =
    Array.isArray(
      result?.keywords
    )
      ? result.keywords
      : [];


  keywords =
    keywords
      .map(
        (keyword) =>
          cleanInput(
            keyword
          )
      )
      .filter(Boolean)
      .slice(0, 10);


  while (
    keywords.length <
    10
  ) {

    keywords.push(
      ""
    );
  }


  const visualAnalysis =
    cleanInput(
      result?.visualAnalysis
    );


  return {

    title:
      title ||
      "Anuncio sin título.",

    description:
      description ||
      "No se pudo generar una descripción.",

    keywords,

    visualAnalysis:
      visualAnalysis
  };
}
