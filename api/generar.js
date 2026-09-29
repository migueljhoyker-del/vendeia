export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { product, category, brand, condition, price, details } = req.body;

    const prompt = `
Eres un experto en ventas de segunda mano en España.

Crea un anuncio optimizado para vender este producto:

Producto: ${product || ""}
Categoría: ${category || ""}
Marca: ${brand || ""}
Estado: ${condition || ""}
Precio: ${price || ""}
Detalles adicionales: ${details || ""}

Devuelve EXACTAMENTE este formato:

TÍTULO:
Un título atractivo, claro y optimizado para búsquedas.

DESCRIPCIÓN:
Una descripción natural, convincente y detallada.
No inventes características que el vendedor no haya proporcionado.

PALABRAS CLAVE:
10 palabras o frases relevantes para ayudar a encontrar el anuncio.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Error al contactar con OpenAI"
      });
    }

    return res.status(200).json({
      result: data.output_text
    });

  } catch (error) {
    return res.status(500).json({
      error: "Error interno del servidor"
    });
  }
}
