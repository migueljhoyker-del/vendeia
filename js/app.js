document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("productForm");

  if (!form) {
    console.error("VendeIA: no se encontró #productForm");
    return;
  }

  // =========================================================
  // ELEMENTOS DEL FORMULARIO
  // =========================================================

  const productInput = document.getElementById("product");
  const platformInput = document.getElementById("platform");
  const goalInput = document.getElementById("goal");
  const categoryInput = document.getElementById("category");
  const brandInput = document.getElementById("brand");
  const conditionInput = document.getElementById("condition");
  const priceInput = document.getElementById("price");
  const detailsInput = document.getElementById("details");

  const generateButton = document.getElementById("generateButton");

  // =========================================================
  // ESTADOS DEL RESULTADO
  // =========================================================

  const emptyState = document.getElementById("emptyState");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const resultContent = document.getElementById("resultContent");

  const titleResult = document.getElementById("titleResult");
  const descriptionResult =
    document.getElementById("descriptionResult");
  const keywordsResult =
    document.getElementById("keywordsResult");

  const copyAllButton =
    document.getElementById("copyAllButton");

  const resultStatus =
    document.getElementById("resultStatus");

  const detailsCounter =
    document.getElementById("detailsCounter");

  // =========================================================
  // CONFIGURACIÓN
  // =========================================================

  const MAX_DETAILS_LENGTH = 5000;

  // =========================================================
  // ESTADOS VISUALES
  // =========================================================

  function showState(state) {
    const states = [
      emptyState,
      loadingState,
      errorState,
      resultContent
    ];

    states.forEach((element) => {
      if (!element) return;

      element.hidden = element !== state;
    });
  }

  function setButtonLoading(isLoading) {
    if (!generateButton) return;

    if (isLoading) {
      if (!generateButton.dataset.originalText) {
        generateButton.dataset.originalText =
          generateButton.textContent.trim();
      }

      generateButton.disabled = true;
      generateButton.textContent =
        "Generando anuncio...";
      generateButton.setAttribute(
        "aria-busy",
        "true"
      );

    } else {
      generateButton.disabled = false;

      generateButton.textContent =
        generateButton.dataset.originalText ||
        "✦ Generar anuncio";

      generateButton.removeAttribute(
        "aria-busy"
      );
    }
  }

  function showError(message) {
    if (errorMessage) {
      errorMessage.textContent =
        message ||
        "Ha ocurrido un error inesperado.";
    }

    if (resultStatus) {
      resultStatus.textContent = "Error";
    }

    showState(errorState);
  }

  // =========================================================
  // LIMPIEZA DE DATOS
  // =========================================================

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\r\n/g, "\n")
      .trim();
  }

  // =========================================================
  // PARSER DE LA RESPUESTA DE LA IA
  // =========================================================

  function parseAIResult(rawText) {
    const text = normalizeText(rawText);

    if (!text) {
      return {
        title: "",
        description: "",
        keywords: ""
      };
    }

    const titleMatch = text.match(
      /T[ÍI]TULO\s*:\s*([\s\S]*?)(?=\n\s*DESCRIPCI[ÓO]N\s*:|$)/i
    );

    const descriptionMatch = text.match(
      /DESCRIPCI[ÓO]N\s*:\s*([\s\S]*?)(?=\n\s*PALABRAS\s+CLAVE\s*:|$)/i
    );

    const keywordsMatch = text.match(
      /PALABRAS\s+CLAVE\s*:\s*([\s\S]*)$/i
    );

    let title =
      titleMatch?.[1]?.trim() || "";

    let description =
      descriptionMatch?.[1]?.trim() || "";

    let keywords =
      keywordsMatch?.[1]?.trim() || "";

    // Fallback si la IA no respetase el formato.
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
        result.title ||
        "No se ha generado un título.";
    }

    if (descriptionResult) {
      descriptionResult.textContent =
        result.description ||
        "No se ha generado una descripción.";
    }

    if (keywordsResult) {
      keywordsResult.textContent =
        result.keywords ||
        "No se han generado palabras clave.";
    }

    if (resultStatus) {
      resultStatus.textContent =
        "Generado correctamente";
    }

    showState(resultContent);
  }

  // =========================================================
  // COPIAR TEXTO
  // =========================================================

  async function copyText(text, button) {
    const value = cleanText(text);

    if (!value) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(value);

      showCopiedState(button);

      return true;

    } catch (error) {
      // Fallback para navegadores donde Clipboard API
      // no esté disponible.

      try {
        const textarea =
          document.createElement("textarea");

        textarea.value = value;

        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";

        document.body.appendChild(textarea);

        textarea.focus();
        textarea.select();

        const copied =
          document.execCommand("copy");

        textarea.remove();

        if (copied) {
          showCopiedState(button);
        }

        return copied;

      } catch (fallbackError) {
        console.error(
          "VendeIA: no se pudo copiar.",
          fallbackError
        );

        return false;
      }
    }
  }

  function showCopiedState(button) {
    if (!button) return;

    const originalText =
      button.dataset.originalCopyText ||
      button.textContent;

    button.dataset.originalCopyText =
      originalText;

    button.textContent =
      "Copiado ✓";

    button.classList.add("is-copied");

    window.setTimeout(() => {
      button.textContent =
        button.dataset.originalCopyText;

      button.classList.remove(
        "is-copied"
      );
    }, 1800);
  }

  // =========================================================
  // BOTONES DE COPIAR INDIVIDUALES
  // =========================================================

  document
    .querySelectorAll("[data-copy-target]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        async () => {

          const targetId =
            button.dataset.copyTarget;

          if (!targetId) return;

          const target =
            document.getElementById(
              targetId
            );

          if (!target) {
            console.warn(
              `VendeIA: no existe #${targetId}`
            );

            return;
          }

          await copyText(
            target.textContent,
            button
          );
        }
      );
    });

  // =========================================================
  // COPIAR ANUNCIO COMPLETO
  // =========================================================

  if (copyAllButton) {

    copyAllButton.addEventListener(
      "click",
      async () => {

        const title =
          cleanText(
            titleResult?.textContent
          );

        const description =
          cleanText(
            descriptionResult?.textContent
          );

        const keywords =
          cleanText(
            keywordsResult?.textContent
          );

        const completeText = [
          title
            ? `TÍTULO\n${title}`
            : "",

          description
            ? `DESCRIPCIÓN\n${description}`
            : "",

          keywords
            ? `PALABRAS CLAVE\n${keywords}`
            : ""
        ]
          .filter(Boolean)
          .join("\n\n");

        await copyText(
          completeText,
          copyAllButton
        );
      }
    );
  }

  // =========================================================
  // CONTADOR DE DETALLES
  // =========================================================

  function updateDetailsCounter() {
    if (!detailsInput || !detailsCounter) {
      return;
    }

    const length =
      detailsInput.value.length;

    detailsCounter.textContent =
      `${length.toLocaleString("es-ES")} / ${MAX_DETAILS_LENGTH.toLocaleString("es-ES")}`;

    if (
      length >=
      MAX_DETAILS_LENGTH * 0.9
    ) {
      detailsCounter.classList.add(
        "is-warning"
      );
    } else {
      detailsCounter.classList.remove(
        "is-warning"
      );
    }
  }

  if (detailsInput) {
    detailsInput.addEventListener(
      "input",
      updateDetailsCounter
    );

    updateDetailsCounter();
  }

  // =========================================================
  // VALIDACIÓN
  // =========================================================

  function validateForm() {
    const product =
      cleanText(
        productInput?.value
      );

    const details =
      cleanText(
        detailsInput?.value
      );

    if (!product) {
      productInput?.focus();

      return {
        valid: false,
        message:
          "Indica qué producto quieres vender."
      };
    }

    if (product.length < 2) {
      productInput?.focus();

      return {
        valid: false,
        message:
          "El nombre del producto es demasiado corto."
      };
    }

    if (
      details.length >
      MAX_DETAILS_LENGTH
    ) {
      detailsInput?.focus();

      return {
        valid: false,
        message:
          "Los detalles no pueden superar los 5.000 caracteres."
      };
    }

    return {
      valid: true
    };
  }

  // =========================================================
  // ENVIAR FORMULARIO
  // =========================================================

  form.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const validation =
        validateForm();

      if (!validation.valid) {
        showError(
          validation.message
        );

        return;
      }

      // =====================================================
      // PAYLOAD
      // =====================================================

      const payload = {
        product:
          cleanText(
            productInput?.value
          ),

        platform:
          cleanText(
            platformInput?.value
          ) || "general",

        goal:
          cleanText(
            goalInput?.value
          ) || "balanced",

        category:
          cleanText(
            categoryInput?.value
          ),

        brand:
          cleanText(
            brandInput?.value
          ),

        condition:
          cleanText(
            conditionInput?.value
          ),

        price:
          cleanText(
            priceInput?.value
          ),

        details:
          cleanText(
            detailsInput?.value
          )
      };

      console.log(
        "VendeIA payload:",
        payload
      );

      // =====================================================
      // ESTADO CARGANDO
      // =====================================================

      showState(
        loadingState
      );

      setButtonLoading(true);

      if (resultStatus) {
        resultStatus.textContent =
          "Generando...";
      }

      // =====================================================
      // API
      // =====================================================

      try {

        const response =
          await fetch(
            "/api/generar",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "Accept":
                  "application/json"
              },

              body:
                JSON.stringify(
                  payload
                )
            }
          );

        let data = null;

        try {
          data =
            await response.json();
        } catch {
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

        // ===================================================
        // PROCESAR RESULTADO
        // ===================================================

        const parsedResult =
          parseAIResult(
            rawResult
          );

        if (
          !parsedResult.title &&
          !parsedResult.description &&
          !parsedResult.keywords
        ) {
          throw new Error(
            "La respuesta recibida no contiene un anuncio válido."
          );
        }

        renderResult(
          parsedResult
        );

        // ===================================================
        // SCROLL EN MÓVIL
        // ===================================================

        if (
          window.innerWidth < 900 &&
          resultContent
        ) {
          window.setTimeout(
            () => {
              resultContent.scrollIntoView(
                {
                  behavior:
                    "smooth",

                  block:
                    "start"
                }
              );
            },
            100
          );
        }

      } catch (error) {

        console.error(
          "VendeIA:",
          error
        );

        let message =
          error?.message ||
          "No hemos podido generar el anuncio.";

        if (
          error instanceof TypeError &&
          message
            .toLowerCase()
            .includes("fetch")
        ) {
          message =
            "No se ha podido conectar con VendeIA. Comprueba tu conexión e inténtalo de nuevo.";
        }

        showError(message);

      } finally {

        setButtonLoading(
          false
        );
      }
    }
  );

  // =========================================================
  // ESTADO INICIAL
  // =========================================================

  showState(emptyState);

  console.log(
    "VendeIA: aplicación iniciada correctamente."
  );
});
  console.log("VendeIA: aplicación iniciada correctamente.");
});
