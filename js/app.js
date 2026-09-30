"use strict";

/*
=========================================================
 VENDEIA — FRONTEND APPLICATION
 js/app.js
=========================================================

 Responsabilidades:
 - Capturar el formulario
 - Validar datos
 - Enviar datos a /api/generar
 - Gestionar estados de carga/error/resultado
 - Mostrar título, descripción y palabras clave
 - Copiar resultados
 - Contador de caracteres
 - Manejo robusto de errores
 - Compatibilidad con navegadores modernos
=========================================================
*/


/* =========================================================
   CONFIGURACIÓN
========================================================= */

const API_ENDPOINT = "/api/generar";
const MAX_DETAILS_LENGTH = 5000;


/* =========================================================
   ELEMENTOS DEL DOM
========================================================= */

const productForm =
  document.getElementById("productForm");

const productInput =
  document.getElementById("product");

const platformInput =
  document.getElementById("platform");

const goalInput =
  document.getElementById("goal");

const categoryInput =
  document.getElementById("category");

const brandInput =
  document.getElementById("brand");

const conditionInput =
  document.getElementById("condition");

const priceInput =
  document.getElementById("price");

const detailsInput =
  document.getElementById("details");

const detailsCounter =
  document.getElementById("detailsCounter");

const generateButton =
  document.getElementById("generateButton");

const emptyState =
  document.getElementById("emptyState");

const loadingState =
  document.getElementById("loadingState");

const errorState =
  document.getElementById("errorState");

const errorMessage =
  document.getElementById("errorMessage");

const resultStatus =
  document.getElementById("resultStatus");

const resultContent =
  document.getElementById("resultContent");

const titleResult =
  document.getElementById("titleResult");

const descriptionResult =
  document.getElementById("descriptionResult");

const keywordsResult =
  document.getElementById("keywordsResult");

const copyAllButton =
  document.getElementById("copyAllButton");


/* =========================================================
   UTILIDADES
========================================================= */

function cleanText(value) {

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


function escapeHtml(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function setElementVisible(element, visible) {

  if (!element) {
    return;
  }

  element.hidden = !visible;
}


function setLoading(isLoading) {

  if (!generateButton) {
    return;
  }

  generateButton.disabled = isLoading;

  if (isLoading) {

    generateButton.dataset.originalText =
      generateButton.innerHTML;

    generateButton.innerHTML =
      `
        <span class="button-icon" aria-hidden="true">
          ◌
        </span>
        Generando anuncio...
      `;

  } else {

    if (
      generateButton.dataset.originalText
    ) {

      generateButton.innerHTML =
        generateButton.dataset.originalText;

    } else {

      generateButton.innerHTML =
        `
          <span class="button-icon" aria-hidden="true">
            ✦
          </span>
          Generar anuncio
          <span class="button-arrow" aria-hidden="true">
            →
          </span>
        `;
    }
  }
}


function showEmptyState() {

  setElementVisible(
    emptyState,
    true
  );

  setElementVisible(
    loadingState,
    false
  );

  setElementVisible(
    errorState,
    false
  );

  setElementVisible(
    resultContent,
    false
  );

  if (resultStatus) {
    resultStatus.textContent =
      "ESPERANDO DATOS";
  }
}


function showLoadingState() {

  setElementVisible(
    emptyState,
    false
  );

  setElementVisible(
    loadingState,
    true
  );

  setElementVisible(
    errorState,
    false
  );

  setElementVisible(
    resultContent,
    false
  );

  if (resultStatus) {
    resultStatus.textContent =
      "GENERANDO";
  }
}


function showErrorState(message) {

  setElementVisible(
    emptyState,
    false
  );

  setElementVisible(
    loadingState,
    false
  );

  setElementVisible(
    errorState,
    true
  );

  setElementVisible(
    resultContent,
    false
  );

  if (errorMessage) {
    errorMessage.textContent =
      message;
  }

  if (resultStatus) {
    resultStatus.textContent =
      "ERROR";
  }
}


function showResultState() {

  setElementVisible(
    emptyState,
    false
  );

  setElementVisible(
    loadingState,
    false
  );

  setElementVisible(
    errorState,
    false
  );

  setElementVisible(
    resultContent,
    true
  );

  if (resultStatus) {
    resultStatus.textContent =
      "GENERADO";
  }
}


/* =========================================================
   VALIDACIÓN
========================================================= */

function validateForm(payload) {

  if (!payload.product) {

    return {
      valid: false,
      message:
        "Indica qué producto quieres vender."
    };

  }


  if (
    payload.product.length > 200
  ) {

    return {
      valid: false,
      message:
        "El nombre del producto es demasiado largo."
    };

  }


  if (
    payload.details.length >
    MAX_DETAILS_LENGTH
  ) {

    return {
      valid: false,
      message:
        `Los detalles no pueden superar los ${MAX_DETAILS_LENGTH.toLocaleString("es-ES")} caracteres.`
    };

  }


  return {
    valid: true,
    message: ""
  };
}


/* =========================================================
   CONSTRUCCIÓN DEL PAYLOAD
========================================================= */

function buildPayload() {

  return {

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
}


/* =========================================================
   LLAMADA A LA API
========================================================= */

async function generateListing(payload) {

  const response =
    await fetch(
      API_ENDPOINT,
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

  } catch (error) {

    throw new Error(
      "El servidor devolvió una respuesta que no se pudo interpretar."
    );

  }


  if (!response.ok) {

    const serverMessage =
      data?.error ||
      data?.message ||
      "No se pudo generar el anuncio.";

    throw new Error(
      serverMessage
    );
  }


  const result =
    data?.result ||
    data?.output_text ||
    data?.text ||
    "";


  if (
    typeof result !== "string" ||
    !result.trim()
  ) {

    throw new Error(
      "La IA respondió, pero no devolvió contenido."
    );

  }


  return result.trim();
}


/* =========================================================
   PARSER DE LA RESPUESTA
========================================================= */

function parseGeneratedListing(text) {

  const normalized =
    String(text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();


  let title = "";
  let description = "";
  let keywords = "";


  const titleMatch =
    normalized.match(
      /T[ÍI]TULO\s*:\s*([\s\S]*?)(?=\n\s*DESCRIPCI[ÓO]N\s*:|$)/i
    );


  const descriptionMatch =
    normalized.match(
      /DESCRIPCI[ÓO]N\s*:\s*([\s\S]*?)(?=\n\s*PALABRAS\s+CLAVE\s*:|$)/i
    );


  const keywordsMatch =
    normalized.match(
      /PALABRAS\s+CLAVE\s*:\s*([\s\S]*?)$/i
    );


  if (titleMatch) {
    title =
      titleMatch[1].trim();
  }


  if (descriptionMatch) {
    description =
      descriptionMatch[1].trim();
  }


  if (keywordsMatch) {
    keywords =
      keywordsMatch[1].trim();
  }


  /*
   ---------------------------------------------------------
   FALLBACK
   ---------------------------------------------------------
   Si el modelo no respeta exactamente el formato,
   mostramos igualmente la respuesta en lugar de perderla.
  */

  if (!title) {

    const firstLine =
      normalized
        .split("\n")
        .map(line => line.trim())
        .find(Boolean);

    title =
      firstLine || "Anuncio generado";

  }


  if (!description) {

    description =
      normalized;

  }


  return {
    title,
    description,
    keywords
  };
}


/* =========================================================
   PALABRAS CLAVE
========================================================= */

function renderKeywords(value) {

  if (!keywordsResult) {
    return;
  }


  keywordsResult.innerHTML = "";


  const keywords =
    String(value || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);


  if (!keywords.length) {

    const fallback =
      document.createElement("span");

    fallback.className =
      "keyword";

    fallback.textContent =
      "Sin palabras clave";

    keywordsResult.appendChild(
      fallback
    );

    return;
  }


  keywords
    .slice(0, 20)
    .forEach(keyword => {

      const element =
        document.createElement("span");

      element.className =
        "keyword";

      element.textContent =
        keyword;

      keywordsResult.appendChild(
        element
      );

    });
}


/* =========================================================
   MOSTRAR RESULTADO
========================================================= */

function renderResult(parsed) {

  if (titleResult) {

    titleResult.textContent =
      parsed.title;

  }


  if (descriptionResult) {

    descriptionResult.textContent =
      parsed.description;

  }


  renderKeywords(
    parsed.keywords
  );


  showResultState();

  scrollToResult();
}


/* =========================================================
   SCROLL RESULTADO
========================================================= */

function scrollToResult() {

  /*
   En escritorio no forzamos desplazamiento.
   En móvil sí llevamos al usuario al resultado.
  */

  if (
    window.innerWidth > 760
  ) {
    return;
  }


  const resultPanel =
    document.querySelector(
      ".result-panel"
    );


  if (!resultPanel) {
    return;
  }


  setTimeout(() => {

    resultPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }, 120);
}


/* =========================================================
   COPIAR TEXTO
========================================================= */

async function copyText(text) {

  const clean =
    String(text || "").trim();


  if (!clean) {

    return false;

  }


  /*
   Clipboard API moderna
  */

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {

    try {

      await navigator.clipboard.writeText(
        clean
      );

      return true;

    } catch (error) {

      /*
       Continuamos con fallback.
      */

    }

  }


  /*
   Fallback para navegadores
   que no permitan Clipboard API.
  */

  const textarea =
    document.createElement("textarea");

  textarea.value =
    clean;

  textarea.style.position =
    "fixed";

  textarea.style.left =
    "-9999px";

  textarea.style.top =
    "-9999px";

  textarea.setAttribute(
    "readonly",
    ""
  );

  document.body.appendChild(
    textarea
  );

  textarea.select();

  let copied = false;

  try {

    copied =
      document.execCommand(
        "copy"
      );

  } catch (error) {

    copied = false;

  }

  document.body.removeChild(
    textarea
  );

  return copied;
}


/* =========================================================
   FEEDBACK DE COPIA
========================================================= */

function setCopiedFeedback(
  button,
  originalText
) {

  if (!button) {
    return;
  }


  button.textContent =
    "Copiado";


  button.dataset.copying =
    "true";


  setTimeout(() => {

    button.textContent =
      originalText;

    button.dataset.copying =
      "false";

  }, 1400);
}


/* =========================================================
   COPIAR ELEMENTO
========================================================= */

async function handleCopyButton(button) {

  if (!button) {
    return;
  }


  const targetId =
    button.dataset.copyTarget;


  if (!targetId) {
    return;
  }


  const target =
    document.getElementById(
      targetId
    );


  if (!target) {
    return;
  }


  const text =
    target.innerText ||
    target.textContent ||
    "";


  const originalText =
    button.dataset.originalText ||
    button.textContent ||
    "Copiar";


  button.dataset.originalText =
    originalText;


  const success =
    await copyText(
      text
    );


  if (success) {

    setCopiedFeedback(
      button,
      originalText
    );

  }

}


/* =========================================================
   COPIAR TODO
========================================================= */

async function copyEntireListing() {

  const title =
    titleResult?.innerText ||
    titleResult?.textContent ||
    "";


  const description =
    descriptionResult?.innerText ||
    descriptionResult?.textContent ||
    "";


  const keywords =
    Array.from(
      keywordsResult?.querySelectorAll(
        ".keyword"
      ) || []
    )
      .map(
        element =>
          element.textContent.trim()
      )
      .filter(Boolean)
      .join(", ");


  if (
    !title &&
    !description
  ) {

    return;

  }


  const completeText =
    [
      "TÍTULO:",
      title,
      "",
      "DESCRIPCIÓN:",
      description,
      "",
      "PALABRAS CLAVE:",
      keywords
    ]
      .join("\n")
      .trim();


  const success =
    await copyText(
      completeText
    );


  if (!copyAllButton) {
    return;
  }


  const originalText =
    copyAllButton.dataset.originalText ||
    copyAllButton.textContent ||
    "Copiar todo";


  copyAllButton.dataset.originalText =
    originalText;


  if (success) {

    setCopiedFeedback(
      copyAllButton,
      originalText
    );

  }
}


/* =========================================================
   CONTADOR DE CARACTERES
========================================================= */

function updateDetailsCounter() {

  if (
    !detailsInput ||
    !detailsCounter
  ) {
    return;
  }


  const length =
    detailsInput.value.length;


  detailsCounter.textContent =
    `${length.toLocaleString("es-ES")} / ${MAX_DETAILS_LENGTH.toLocaleString("es-ES")}`;


  if (
    length >=
    MAX_DETAILS_LENGTH
  ) {

    detailsCounter.style.color =
      "#ff667a";

  } else if (
    length >=
    MAX_DETAILS_LENGTH * 0.9
  ) {

    detailsCounter.style.color =
      "#f6c85f";

  } else {

    detailsCounter.style.color =
      "";

  }
}


/* =========================================================
   SUBMIT PRINCIPAL
========================================================= */

async function handleFormSubmit(event) {

  event.preventDefault();


  const payload =
    buildPayload();


  const validation =
    validateForm(
      payload
    );


  if (!validation.valid) {

    showErrorState(
      validation.message
    );

    if (productInput) {

      productInput.focus();

    }

    return;

  }


  /*
   Guardamos los datos para poder
   utilizarlos posteriormente si
   añadimos nuevas funciones.
  */

  window.VendeIA =
    window.VendeIA || {};

  window.VendeIA.lastPayload =
    payload;


  setLoading(true);

  showLoadingState();


  try {

    const response =
      await generateListing(
        payload
      );


    const parsed =
      parseGeneratedListing(
        response
      );


    window.VendeIA.lastResult =
      parsed;


    renderResult(
      parsed
    );


  } catch (error) {

    console.error(
      "VendeIA:",
      error
    );


    showErrorState(
      error?.message ||
      "No se pudo generar el anuncio. Inténtalo de nuevo."
    );

  } finally {

    setLoading(false);

  }
}


/* =========================================================
   BOTÓN REINTENTAR
========================================================= */

function setupRetryButton() {

  const retryButton =
    document.querySelector(
      "[data-retry]"
    );


  if (!retryButton) {
    return;
  }


  retryButton.addEventListener(
    "click",
    () => {

      if (!productForm) {
        return;
      }


      productForm.requestSubmit();

    }
  );
}


/* =========================================================
   BOTONES DE COPIAR
========================================================= */

function setupCopyButtons() {

  const buttons =
    document.querySelectorAll(
      "[data-copy-target]"
    );


  buttons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        handleCopyButton(
          button
        );

      }
    );

  });


  if (copyAllButton) {

    copyAllButton.addEventListener(
      "click",
      copyEntireListing
    );

  }
}


/* =========================================================
   EVENTOS DEL FORMULARIO
========================================================= */

function setupForm() {

  if (!productForm) {

    console.error(
      "VendeIA: no se encontró #productForm."
    );

    return;

  }


  productForm.addEventListener(
    "submit",
    handleFormSubmit
  );


  if (detailsInput) {

    detailsInput.addEventListener(
      "input",
      updateDetailsCounter
    );

  }


  updateDetailsCounter();

}


/* =========================================================
   ATAJO DE TECLADO
========================================================= */

function setupKeyboardShortcuts() {

  document.addEventListener(
    "keydown",
    event => {

      /*
       Ctrl + Enter / Cmd + Enter
       genera el anuncio.
      */

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key === "Enter"
      ) {

        if (
          productForm &&
          !generateButton?.disabled
        ) {

          event.preventDefault();

          productForm.requestSubmit();

        }

      }

    }
  );

}


/* =========================================================
   PREVENIR DOBLE ENVÍO
========================================================= */

function setupButtonProtection() {

  if (!generateButton) {
    return;
  }


  generateButton.addEventListener(
    "click",
    event => {

      if (
        generateButton.disabled
      ) {

        event.preventDefault();

      }

    }
  );

}


/* =========================================================
   INICIALIZACIÓN
========================================================= */

function initVendeIA() {

  console.log(
    "VendeIA: aplicación iniciada."
  );


  setupForm();

  setupCopyButtons();

  setupRetryButton();

  setupKeyboardShortcuts();

  setupButtonProtection();


  /*
   Estado inicial
  */

  showEmptyState();

}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initVendeIA
  );

} else {

  initVendeIA();

}
