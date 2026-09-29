"use strict";

/*
 * VendeIA — Frontend Controller
 * --------------------------------
 * Responsabilidades:
 * - Capturar el formulario
 * - Validar los datos
 * - Conectar con /api/generar
 * - Gestionar estados de la interfaz
 * - Procesar la respuesta de la IA
 * - Copiar resultados al portapapeles
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("productForm");
  const generateButton = document.getElementById("generateButton");

  const emptyState = document.getElementById("emptyState");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const resultContent = document.getElementById("resultContent");

  const titleResult = document.getElementById("titleResult");
  const descriptionResult = document.getElementById("descriptionResult");
  const keywordsResult = document.getElementById("keywordsResult");

  const copyAllButton = document.getElementById("copyAllButton");

  if (!form) {
    console.error("VendeIA: no se encontró #productForm");
    return;
  }

  /*
   * --------------------------------------------------
   * ESTADOS
   * --------------------------------------------------
   */

  function showState(state) {
    emptyState.hidden = state !== "empty";
    loadingState.hidden = state !== "loading";
    errorState.hidden = state !== "error";
    resultContent.hidden = state !== "result";
  }

  function setLoading(isLoading) {
    generateButton.disabled = isLoading;

    if (isLoading) {
      generateButton.dataset.originalText =
        generateButton.textContent.trim();

      generateButton.textContent = "Generando anuncio...";
    } else {
      generateButton.textContent =
        generateButton.dataset.originalText || "Generar anuncio";
    }
  }

  /*
   * --------------------------------------------------
   * DATOS DEL FORMULARIO
   * --------------------------------------------------
   */

  function getFormData() {
    return {
      product: getValue("product"),
      category: getValue("category"),
      brand: getValue("brand"),
      condition: getValue("condition"),
      price: getValue("price"),
      details: getValue("details")
    };
  }

  function getValue(id) {
    const element = document.getElementById(id);

    if (!element) {
      return "";
    }

    return element.value.trim();
  }

  /*
   * --------------------------------------------------
   * VALIDACIÓN
   * --------------------------------------------------
   */

  function validateForm(data) {
    if (!data.product) {
      return "Indica qué producto quieres vender.";
    }

    if (data.product.length < 2) {
      return "El nombre del producto es demasiado corto.";
    }

    if (data.details.length > 5000) {
      return "Los detalles del producto son demasiado largos.";
    }

    return null;
  }

  /*
   * --------------------------------------------------
   * PETICIÓN A LA API
   * --------------------------------------------------
   */

  async function generateListing(data) {
    const response = await fetch("/api/generar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("El servidor devolvió una respuesta no válida.");
    }

    if (!response.ok) {
      throw new Error(
        result?.error || "No se pudo generar el anuncio."
      );
    }

    if (!result?.result) {
      throw new Error(
        "La IA no devolvió ningún resultado."
      );
    }

    return result.result;
  }

  /*
   * --------------------------------------------------
   * PROCESAR RESPUESTA DE LA IA
   * --------------------------------------------------
   */

  function parseAIResponse(text) {
    const cleanText = String(text || "").trim();

    let title = extractSection(
      cleanText,
      ["TÍTULO:", "TITULO:", "TÍTULO", "TITULO"],
      [
        "DESCRIPCIÓN:",
        "DESCRIPCION:",
        "DESCRIPCIÓN",
        "DESCRIPCION"
      ]
    );

    let description = extractSection(
      cleanText,
      ["DESCRIPCIÓN:", "DESCRIPCION:", "DESCRIPCIÓN", "DESCRIPCION"],
      [
        "PALABRAS CLAVE:",
        "PALABRAS CLAVE",
        "PALABRAS CLAVES:",
        "PALABRAS CLAVES"
      ]
    );

    let keywords = extractSection(
      cleanText,
      [
        "PALABRAS CLAVE:",
        "PALABRAS CLAVE",
        "PALABRAS CLAVES:",
        "PALABRAS CLAVES"
      ],
      []
    );

    /*
     * Fallback:
     * Si la IA cambia ligeramente el formato,
     * seguimos mostrando algo útil.
     */

    if (!title) {
      title = "Anuncio generado";
    }

    if (!description) {
      description = cleanText;
    }

    if (!keywords) {
      keywords = "segunda mano, venta, producto";
    }

    return {
      title: cleanOutput(title),
      description: cleanOutput(description),
      keywords: cleanOutput(keywords)
    };
  }

  function extractSection(text, startMarkers, endMarkers) {
    let startIndex = -1;
    let matchedMarker = "";

    for (const marker of startMarkers) {
      const index = text.toUpperCase().indexOf(marker);

      if (index !== -1) {
        if (startIndex === -1 || index < startIndex) {
          startIndex = index;
          matchedMarker = marker;
        }
      }
    }

    if (startIndex === -1) {
      return "";
    }

    const contentStart =
      startIndex + matchedMarker.length;

    let endIndex = text.length;

    for (const marker of endMarkers) {
      const index = text
        .toUpperCase()
        .indexOf(marker, contentStart);

      if (index !== -1 && index < endIndex) {
        endIndex = index;
      }
    }

    return text
      .slice(contentStart, endIndex)
      .trim();
  }

  function cleanOutput(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /*
   * --------------------------------------------------
   * MOSTRAR RESULTADO
   * --------------------------------------------------
   */

  function renderResult(result) {
    /*
     * Usamos textContent y no innerHTML.
     * Esto evita que contenido generado por la IA
     * pueda convertirse en HTML ejecutable.
     */

    titleResult.textContent = result.title;
    descriptionResult.textContent = result.description;
    keywordsResult.textContent = result.keywords;

    showState("result");
  }

  /*
   * --------------------------------------------------
   * COPIAR AL PORTAPAPELES
   * --------------------------------------------------
   */

  async function copyText(text, button) {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);

      showCopySuccess(button);
    } catch (error) {
      console.error("VendeIA: error al copiar", error);

      fallbackCopy(text, button);
    }
  }

  function fallbackCopy(text, button) {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy");
      showCopySuccess(button);
    } catch {
      showCopyError(button);
    }

    textarea.remove();
  }

  function showCopySuccess(button) {
    if (!button) {
      return;
    }

    const originalText =
      button.dataset.originalText ||
      button.textContent;

    button.dataset.originalText = originalText;
    button.textContent = "Copiado ✓";
    button.classList.add("is-copied");

    window.setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("is-copied");
    }, 1600);
  }

  function showCopyError(button) {
    if (!button) {
      return;
    }

    const originalText =
      button.dataset.originalText ||
      button.textContent;

    button.dataset.originalText = originalText;
    button.textContent = "No se pudo copiar";

    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1600);
  }

  /*
   * --------------------------------------------------
   * COPIAR ANUNCIO COMPLETO
   * --------------------------------------------------
   */

  function getFullListing() {
    const title = titleResult.textContent.trim();
    const description = descriptionResult.textContent.trim();
    const keywords = keywordsResult.textContent.trim();

    return [
      `TÍTULO:\n${title}`,
      `DESCRIPCIÓN:\n${description}`,
      `PALABRAS CLAVE:\n${keywords}`
    ].join("\n\n");
  }

  /*
   * --------------------------------------------------
   * BOTONES DE COPIAR
   * --------------------------------------------------
   */

  function setupCopyButtons() {
    const buttons = document.querySelectorAll(
      "[data-copy-target]"
    );

    buttons.forEach((button) => {
      button.addEventListener("click", async () => {
        const targetId =
          button.dataset.copyTarget;

        const target =
          document.getElementById(targetId);

        if (!target) {
          return;
        }

        await copyText(
          target.textContent.trim(),
          button
        );
      });
    });

    if (copyAllButton) {
      copyAllButton.addEventListener(
        "click",
        async () => {
          await copyText(
            getFullListing(),
            copyAllButton
          );
        }
      );
    }
  }

  /*
   * --------------------------------------------------
   * ERROR
   * --------------------------------------------------
   */

  function showError(message) {
    errorMessage.textContent =
      message ||
      "Ha ocurrido un error inesperado.";

    showState("error");
  }

  /*
   * --------------------------------------------------
   * SUBMIT PRINCIPAL
   * --------------------------------------------------
   */

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = getFormData();

    const validationError =
      validateForm(data);

    if (validationError) {
      showError(validationError);
      return;
    }

    setLoading(true);
    showState("loading");

    try {
      const aiResponse =
        await generateListing(data);

      const result =
        parseAIResponse(aiResponse);

      renderResult(result);

    } catch (error) {
      console.error(
        "VendeIA:",
        error
      );

      showError(
        error.message ||
        "No se pudo generar el anuncio."
      );

    } finally {
      setLoading(false);
    }
  });

  /*
   * --------------------------------------------------
   * INICIALIZACIÓN
   * --------------------------------------------------
   */

  setupCopyButtons();

  showState("empty");
});
