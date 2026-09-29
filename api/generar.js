export default async function handler(req, res) {
  // --------------------------------------------------
  // 1. Solo permitimos peticiones POST
  // --------------------------------------------------
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  // --------------------------------------------------
  // 2. Comprobamos que existe la API Key
  // --------------------------------------------------
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "La API de IA no está configurada correctamente."
    });
  }

  try {
    // --------------------------------------------------
    // 3. Recibimos los datos del formulario
    // --------------------------------------------------
    const {
      product,
      category,
      brand,
      condition,
      price,
      details
    } = req.body || {};

    // --------------------------------------------------
    // 4. Limpieza y límites básicos
    // --------------------------------------------------
    const cleanProduct = String(product || "").trim();
    const cleanCategory = String(category || "").trim();
    const cleanBrand = String(brand || "").trim();
    const cleanCondition = String(condition || "").trim();
    const cleanPrice = String(price || "").trim();
    const cleanDetails = String(details || "").trim();

    // --------------------------------------------------
    // 5. Validación
    // --------------------------------------------------
    if (!cleanProduct) {
      return res.status(400).json({
        error: "Indica qué producto quieres anunciar."
      });
    }

    if (cleanProduct.length > 150) {
      return res.status(400).json({
        error: "El nombre del producto es demasiado largo."
      });
    }

    if (cleanBrand.length > 100) {
      return res.status(400).json({
        error: "La marca es demasiado larga."
      });
    }

    if (cleanDetails.length > 5000) {
      return res.status(400).json({
        error: "Los detalles son demasiado largos. Máximo 5000 caracteres."
      });
    }

    // --------------------------------------------------
    // 6. Instrucciones para VendeIA
    // --------------------------------------------------
    const instructions = `
Eres VendeIA, un asistente experto en creación y optimización
de anuncios para plataformas de compraventa de segunda mano
en España.

Tu objetivo es ayudar al vendedor a crear un anuncio:

- Claro
- Natural
- Profesional
- Persuasivo
- Fácil de encontrar mediante búsquedas
- Orientado a conseguir contactos y ventas
- Sin inventar información
- Sin exageraciones engañosas

REGLAS IMPORTANTES:

1. Utiliza únicamente la información proporcionada por el usuario.
2. Nunca inventes características, accesorios, medidas, potencia,
   garantía, estado, funcionamiento o cualquier otro dato.
3. Si un dato no está disponible, simplemente no lo menciones.
4. No utilices lenguaje excesivamente publicitario.
5. Evita frases genéricas como "producto increíble" o "oportunidad única"
   salvo que estén justificadas por los datos.
6. El título debe ser claro y contener las palabras más importantes.
7. La descripción debe ser fácil de leer.
8. Organiza la descripción cuando sea útil.
9. Destaca el estado real del producto.
10. Si el vendedor proporciona un motivo de venta, puedes utilizarlo
    de forma natural.
11. Las palabras clave deben estar relacionadas directamente con el producto.
12. No repitas innecesariamente las mismas palabras.
13. Escribe en español de España.
14. No incluyas emojis salvo que aporten realmente valor.
15. No inventes hashtags.

FORMATO OBLIGATORIO DE RESPUESTA:

TÍTULO:
[un único título optimizado]

DESCRIPCIÓN:
[descripción completa del anuncio]

PALABRAS CLAVE:
[10 palabras o frases separadas por comas]
`;

    // --------------------------------------------------
    // 7. Datos del producto
    // --------------------------------------------------
    const userInput = `
DATOS DEL PRODUCTO

Producto:
${cleanProduct}

Categoría:
${cleanCategory || "No indicada"}

Marca:
${cleanBrand || "No indicada"}

Estado:
${cleanCondition || "No indicado"}

Precio:
${cleanPrice ? `${cleanPrice} €` : "No indicado"}

Detalles proporcionados por el vendedor:
${cleanDetails || "No se han proporcionado detalles adicionales."}
`;

    // --------------------------------------------------
    // 8. Petición a OpenAI
    // --------------------------------------------------
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          instructions,
          input: userInput,
          max_output_tokens: 1200
        })
      }
    );

    // --------------------------------------------------
    // 9. Procesamos la respuesta de OpenAI
    // --------------------------------------------------
    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);

      if (response.status === 401) {
        return res.status(500).json({
          error: "La clave de OpenAI no es válida."
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          error: "La API de IA no está disponible temporalmente o no hay saldo suficiente."
        });
      }

      return res.status(500).json({
        error:
          data?.error?.message ||
          "No se pudo generar el anuncio."
      });
    }

    // --------------------------------------------------
    // 10. Extraemos el texto generado
    // --------------------------------------------------
    const result = data.output_text;

    if (!result || typeof result !== "string") {
      console.error("Respuesta inesperada de OpenAI:", data);

      return res.status(500).json({
        error: "La IA no devolvió un resultado válido."
      });
    }

    // --------------------------------------------------
    // 11. Respondemos al frontend
    // --------------------------------------------------
    return res.status(200).json({
      result: result.trim()
    });

  } catch (error) {
    console.error("Error interno:", error);

    return res.status(500).json({
      error: "Ha ocurrido un error interno al generar el anuncio."
    });
  }
}
