document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("productForm");

  if (!form) {
    console.error("VendeIA: no se encontró #productForm");
    return;
  }

  // =========================================================
  // ELEMENTOS
  // =========================================================

  const productInput = document.getElementById("product");
  const categoryInput = document.getElementById("category");
  const brandInput = document.getElementById("brand");
  const conditionInput = document.getElementById("condition");
  const priceInput = document.getElementById("price");
  const detailsInput = document.getElementById("details");

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
  const resultStatus = document.getElementById("resultStatus");

  // =========================================================
  // CONFIGURACIÓN
  // =========================================================

  const MAX_DETAILS_LENGTH = 5000;

  // =========================================================
  // UTILIDADES
  // =========================================================

  function showState(state) {
    const states = [
      emptyState,
      loadingState,
      errorState,
      resultContent
    ];

    states.forEach((element) => {
      if (element) {
        element.hidden = element !== state;
      }
    });
  }

  function setButtonLoading(isLoading) {
    if (!generateButton) return;

    generateButton.disabled = isLoading;

    if (isLoading) {
      generateButton.dataset.originalText =
        generateButton.textContent.trim();

      generateButton.textContent = "Generando anuncio...";
      generateButton.setAttribute("aria-busy", "true");
    } else {
      const originalText =
        generateButton.dataset.originalText || "Generar anuncio";

      generateButton.textContent = originalText;
      generateButton.removeAttribute("aria-busy");
    }
  }

  function showError(message) {
    if (errorMessage) {
      errorMessage.textContent =
        message || "Ha ocurrido un error inesperado.";
    }

    showState(errorState);
  }

  function cleanText(value) {
    return String(value || "").trim();
  }

  function normalizeWhitespace(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function escapeSectionRegex(label) {
    return label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // =========================================================
  // PARSER DE RESPUESTA DE LA IA
  // =========================================================

  function parseAIResult(rawText) {
    const text = normalizeWhitespace(rawText);

    if (!text) {
      return {
        title: "",
        description: "",
        keywords: ""
      };
    }

    const titleRegex = new RegExp(
      `T[ÍI]TULO\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*DESCRIPCI[ÓO]N\\s*:|$)`,
      "i"
    );

    const descriptionRegex = new RegExp(
      `DESCRIPCI[ÓO]N\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*PALABRAS\\s+CLAVE\\s*:|$)`,
      "i"
    );

    const keywordsRegex = new RegExp(
      `PALABRAS\\s+CLAVE\\s*:\\s*([\\s\\S]*)$`,
      "i"
    );

    const titleMatch = text.match(titleRegex);
    const descriptionMatch = text.match(descriptionRegex);
    const keywordsMatch = text.match(keywordsRegex);

    let title = titleMatch
      ? titleMatch[1].trim()
      : "";

    let description = descriptionMatch
      ? descriptionMatch[1].trim()
      : "";

    let keywords = keywordsMatch
      ? keywordsMatch[1].trim()
      : "";

    // Fallback por si el modelo devuelve el contenido
    // sin utilizar exactamente el formato solicitado.
    if (!title && !description && !keywords) {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      title = lines.shift() || "";
      description = lines.join("\n");
    }

    return {
      title,
      description,
      keywords
    };
  }

  // =========================================================
  // MOSTRAR RESULTADO
  // =========================================================

  function renderResult(result) {
    if (titleResult) {
      titleResult.textContent =
        result.title || "No se ha generado un título.";
    }

    if (descriptionResult) {
      descriptionResult.textContent =
        result.description || "No se ha generado una descripción.";
    }

    if (keywordsResult) {
      keywordsResult.textContent =
        result.keywords || "No se han generado palabras clave.";
    }

    if (resultStatus) {
      resultStatus.textContent = "Anuncio generado correctamente";
    }

    showState(resultContent);
  }

  // =========================================================
  // COPIAR TEXTO
  // =========================================================

  async function copyText(text, button) {
    const value = cleanText(text);

    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);

      if (button) {
        const originalText = button.textContent;

        button.textContent = "Copiado ✓";
        button.classList.add("is-copied");

        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("is-copied");
        }, 1800);
      }

      return true;
    } catch (error) {
      // Fallback para navegadores que bloqueen clipboard API.
      try {
        const textarea = document.createElement("textarea");

        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";

        document.body.appendChild(textarea);

        textarea.focus();
        textarea.select();

        const successful = document.execCommand("copy");

        textarea.remove();

        if (successful && button) {
          const originalText = button.textContent;

          button.textContent = "Copiado ✓";
          button.classList.add("is-copied");

          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove("is-copied");
          }, 1800);
        }

        return successful;
      } catch (fallbackError) {
        console.error("VendeIA: error copiando texto", fallbackError);
        return false;
      }
    }
  }

  // =========================================================
  // BOTONES INDIVIDUALES DE COPIAR
  // =========================================================

  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetId = button.dataset.copyTarget;

      if (!targetId) return;

      const target = document.getElementById(targetId);

      if (!target) {
        console.warn(
          `VendeIA: no se encontró el elemento #${targetId}`
        );
        return;
      }

      await copyText(target.textContent, button);
    });
  });

  // =========================================================
  // COPIAR TODO
  // =========================================================

  if (copyAllButton) {
    copyAllButton.addEventListener("click", async () => {
      const title = cleanText(
        titleResult?.textContent
      );

      const description = cleanText(
        descriptionResult?.textContent
      );

      const keywords = cleanText(
        keywordsResult?.textContent
      );

      const completeText = [
        title ? `TÍTULO\n${title}` : "",
        description ? `DESCRIPCIÓN\n${description}` : "",
        keywords ? `PALABRAS CLAVE\n${keywords}` : ""
      ]
        .filter(Boolean)
        .join("\n\n");

      await copyText(completeText, copyAllButton);
    });
  }

  // =========================================================
  // VALIDACIÓN
  // =========================================================

  function validateForm() {
    const product = cleanText(productInput?.value);
    const details = cleanText(detailsInput?.value);

    if (!product) {
      productInput?.focus();

      return {
        valid: false,
        message: "Indica qué producto quieres vender."
      };
    }

    if (product.length < 2) {
      productInput?.focus();

      return {
        valid: false,
        message: "El nombre del producto es demasiado corto."
      };
    }

    if (details.length > MAX_DETAILS_LENGTH) {
      detailsInput?.focus();

      return {
        valid: false,
        message:
          `Los detalles no pueden superar los ${MAX_DETAILS_LENGTH.toLocaleString("es-ES")} caracteres.`
      };
    }

    return {
      valid: true
    };
  }

  // =========================================================
  // GENERAR ANUNCIO
  // =========================================================

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const validation = validateForm();

    if (!validation.valid) {
      showError(validation.message);
      return;
    }

    const payload = {
      product: cleanText(productInput?.value),
      category: cleanText(categoryInput?.value),
      brand: cleanText(brandInput?.value),
      condition: cleanText(conditionInput?.value),
      price: cleanText(priceInput?.value),
      details: cleanText(detailsInput?.value)
    };

    showState(loadingState);
    setButtonLoading(true);

    if (resultStatus) {
      resultStatus.textContent = "Generando...";
    }

    try {
      const response = await fetch("/api/generar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      let data;

      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error(
          "El servidor devolvió una respuesta no válida."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "No hemos podido generar el anuncio."
        );
      }

      const rawResult =
        data?.result ||
        data?.output_text ||
        data?.text ||
        "";

      if (!rawResult) {
        throw new Error(
          "La IA no devolvió ningún contenido."
        );
      }

      const parsedResult = parseAIResult(rawResult);

      if (
        !parsedResult.title &&
        !parsedResult.description &&
        !parsedResult.keywords
      ) {
        throw new Error(
          "La respuesta recibida no contiene un anuncio válido."
        );
      }

      renderResult(parsedResult);

      // Llevar al usuario al resultado en pantallas pequeñas.
      if (
        window.innerWidth < 900 &&
        resultContent
      ) {
        setTimeout(() => {
          resultContent.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }, 100);
      }

    } catch (error) {
      console.error("VendeIA:", error);

      let message =
        error?.message ||
        "No hemos podido generar el anuncio.";

      if (
        error instanceof TypeError &&
        message.toLowerCase().includes("fetch")
      ) {
        message =
          "No se ha podido conectar con VendeIA. Comprueba tu conexión e inténtalo de nuevo.";
      }

      showError(message);

    } finally {
      setButtonLoading(false);
    }
  });

  // =========================================================
  // CONTADOR DE CARACTERES
  // =========================================================

  if (detailsInput) {
    const updateCounter = () => {
      const length = detailsInput.value.length;

      let counter =
        document.getElementById("detailsCounter");

      // Si el HTML no tiene contador, no creamos elementos nuevos.
      if (!counter) return;

      counter.textContent =
        `${length.toLocaleString("es-ES")} / ${MAX_DETAILS_LENGTH.toLocaleString("es-ES")}`;

      if (length >= MAX_DETAILS_LENGTH * 0.9) {
        counter.classList.add("is-warning");
      } else {
        counter.classList.remove("is-warning");
      }
    };

    detailsInput.addEventListener(
      "input",
      updateCounter
    );

    updateCounter();
  }

  // =========================================================
  // ESTADO INICIAL
  // =========================================================

  showState(emptyState);

  console.log("VendeIA: aplicación iniciada correctamente.");
});
