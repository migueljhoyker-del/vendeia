(() => {
  "use strict";

  const API_ENDPOINT = "/api/generar";
  const MAX_DETAILS = 5000;
  const MAX_IMAGES = 6;
  const TARGET_IMAGE_BYTES = 420 * 1024;
  const MAX_IMAGE_SIDE = 1600;

  const state = {
    images: [],
    lastPayload: null,
    lastResult: null,
    generating: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindNavigation();
    bindForm();
    bindImages();
    bindCopyButtons();
    bindFeatureActions();
    bindReplyGenerator();
    bindRetry();
    bindKeyboardShortcut();
    bindCounters();
    updateYear();
  }

  function cacheElements() {
    elements.form = $("#productForm");
    elements.product = $("#product");
    elements.platform = $("#platform");
    elements.goal = $("#goal");
    elements.category = $("#category");
    elements.brand = $("#brand");
    elements.condition = $("#condition");
    elements.price = $("#price");
    elements.details = $("#details");
    elements.detailsCounter = $("#detailsCounter");
    elements.generateButton = $("#generateButton");
    elements.uploadButton = $("#uploadButton");
    elements.images = $("#images");
    elements.imagePreviewGrid = $("#imagePreviewGrid");
    elements.photoUploader = $("#photoUploader");
    elements.uploadNote = $("#uploadNote");
    elements.emptyState = $("#emptyState");
    elements.loadingState = $("#loadingState");
    elements.errorState = $("#errorState");
    elements.errorMessage = $("#errorMessage");
    elements.resultStatus = $("#resultStatus");
    elements.resultContent = $("#resultContent");
    elements.titleResult = $("#titleResult");
    elements.descriptionResult = $("#descriptionResult");
    elements.keywordsResult = $("#keywordsResult");
    elements.hashtagsResult = $("#hashtagsResult");
    elements.buyerRepliesResult = $("#buyerRepliesResult");
    elements.photoAdviceResult = $("#photoAdviceResult");
    elements.qualityScore = $("#qualityScore span");
    elements.qualitySummary = $("#qualitySummary");
    elements.buyerQuestion = $("#buyerQuestion");
    elements.replyButton = $("#replyButton");
    elements.customReplyResult = $("#customReplyResult");
    elements.copyHashtagsButton = $("#copyHashtagsButton");
    elements.copyAllButton = $("#copyAllButton");
    elements.advancedResult = $("#advancedResult");
    elements.toast = $("#toast");
  }

  function bindNavigation() {
    $$("a[href^='#']").forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("href");
        if (!targetId || targetId === "#") return;
        const target = $(targetId);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function bindForm() {
    elements.form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await generateFullKit();
    });
  }

  function bindImages() {
    elements.uploadButton?.addEventListener("click", () => {
      elements.images?.click();
    });

    elements.images?.addEventListener("change", async () => {
      await addImageFiles([...elements.images.files]);
      elements.images.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      elements.photoUploader?.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.photoUploader.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      elements.photoUploader?.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.photoUploader.classList.remove("dragover");
      });
    });

    elements.photoUploader?.addEventListener("drop", async (event) => {
      const files = [...(event.dataTransfer?.files || [])];
      await addImageFiles(files);
    });
  }

  function bindCopyButtons() {
    $$("[data-copy-target]").forEach((button) => {
      button.addEventListener("click", async () => {
        const targetId = button.dataset.copyTarget;
        const target = document.getElementById(targetId);
        if (!target) return;
        await copyText(target.innerText || target.textContent || "");
        flashButton(button, "Copiado");
      });
    });

    elements.copyHashtagsButton?.addEventListener("click", async () => {
      const hashtags = getCurrentHashtags().join(" ");
      await copyText(hashtags);
      flashButton(elements.copyHashtagsButton, "Copiados");
    });

    elements.copyAllButton?.addEventListener("click", async () => {
      const text = buildCompleteListingText();
      await copyText(text);
      flashButton(elements.copyAllButton, "Anuncio copiado");
    });
  }

  function bindFeatureActions() {
    $$("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.action;
        await runFeatureAction(action, button);
      });
    });
  }

  function bindReplyGenerator() {
    elements.replyButton?.addEventListener("click", async () => {
      await generateBuyerReply();
    });

    elements.buyerQuestion?.addEventListener("keydown", async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        await generateBuyerReply();
      }
    });
  }

  function bindRetry() {
    $$("[data-retry]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (state.lastPayload) {
          await generateFullKit(state.lastPayload);
        } else {
          await generateFullKit();
        }
      });
    });
  }

  function bindKeyboardShortcut() {
    elements.form?.addEventListener("keydown", async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        if (event.target?.tagName === "TEXTAREA") {
          event.preventDefault();
          await generateFullKit();
        }
      }
    });
  }

  function bindCounters() {
    elements.details?.addEventListener("input", updateDetailsCounter);
    updateDetailsCounter();
  }

  function updateDetailsCounter() {
    const count = elements.details?.value.length || 0;
    if (elements.detailsCounter) {
      elements.detailsCounter.textContent = `${count} / ${MAX_DETAILS}`;
    }
  }

  function updateYear() {
    const year = $("#currentYear");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  async function addImageFiles(files) {
    if (!files.length) return;

    const available = MAX_IMAGES - state.images.length;

    if (available <= 0) {
      showToast(`Ya tienes ${MAX_IMAGES} fotografías.`, "error");
      return;
    }

    const selected = files.slice(0, available);

    if (files.length > available) {
      showToast(`Solo se han añadido ${available} fotografías.`, "error");
    }

    for (const file of selected) {
      if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
        showToast(`${file.name}: formato no compatible. Usa JPG, PNG o WebP.`, "error");
        continue;
      }

      try {
        const compressed = await compressImage(file);
        state.images.push(compressed);
      } catch (error) {
        console.error(error);
        showToast(`No se pudo procesar ${file.name}.`, "error");
      }
    }

    renderImagePreviews();
  }

  async function compressImage(file) {
    const sourceUrl = URL.createObjectURL(file);

    try {
      const image = await loadImage(sourceUrl);
      const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas no disponible");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      let quality = 0.86;
      let blob = await canvasToBlob(canvas, quality);

      while (blob.size > TARGET_IMAGE_BYTES && quality > 0.45) {
        quality -= 0.07;
        blob = await canvasToBlob(canvas, quality);
      }

      if (blob.size > TARGET_IMAGE_BYTES) {
        const scale = 0.78;
        const smallerCanvas = document.createElement("canvas");
        smallerCanvas.width = Math.max(1, Math.round(width * scale));
        smallerCanvas.height = Math.max(1, Math.round(height * scale));
        const smallerContext = smallerCanvas.getContext("2d", { alpha: false });
        smallerContext.fillStyle = "#ffffff";
        smallerContext.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
        smallerContext.drawImage(image, 0, 0, smallerCanvas.width, smallerCanvas.height);
        blob = await canvasToBlob(smallerCanvas, 0.74);
      }

      if (blob.size > TARGET_IMAGE_BYTES) {
        throw new Error("Imagen demasiado grande");
      }

      const data = await blobToDataUrl(blob);

      return {
        data,
        type: "image/jpeg",
        name: file.name,
        preview: data,
        bytes: blob.size
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo leer la imagen"));
      image.src = url;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("No se pudo comprimir la imagen"));
          return;
        }
        resolve(blob);
      }, "image/jpeg", quality);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo convertir la imagen"));
      reader.readAsDataURL(blob);
    });
  }

  function renderImagePreviews() {
    if (!elements.imagePreviewGrid) return;

    elements.imagePreviewGrid.innerHTML = "";

    state.images.forEach((image, index) => {
      const item = document.createElement("div");
      item.className = "image-preview";
      item.innerHTML = `
        <img src="${image.preview}" alt="Fotografía ${index + 1}" loading="lazy">
        <span class="image-index">${index + 1}</span>
        <button class="image-remove" type="button" aria-label="Eliminar fotografía ${index + 1}" data-image-index="${index}">×</button>
      `;
      elements.imagePreviewGrid.appendChild(item);
    });

    $$("[data-image-index]", elements.imagePreviewGrid).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.imageIndex);
        state.images.splice(index, 1);
        renderImagePreviews();
      });
    });

    if (elements.uploadNote) {
      elements.uploadNote.textContent = state.images.length
        ? `${state.images.length} fotografía(s) preparada(s) para la IA.`
        : "Las imágenes se comprimen en tu navegador antes de enviarse.";
    }
  }

  async function generateFullKit(existingPayload = null) {
    if (state.generating) return;

    const payload = existingPayload || buildPayload("generate");

    if (!payload.product) {
      showFieldError(elements.product, "Indica qué producto quieres vender.");
      return;
    }

    clearFieldError(elements.product);
    state.lastPayload = payload;
    state.generating = true;
    setLoading(true, "Generando");

    try {
      const response = await requestApi(payload);
      const result = response.result || {};
      state.lastResult = result;
      renderFullResult(result);
      showResultState("result");
      elements.resultStatus.textContent = "Generado";
      scrollResultIntoView();
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
      state.generating = false;
    }
  }

  async function runFeatureAction(action, button) {
    if (state.generating) return;

    const payload = buildPayload(action);

    if (action === "photo" && !payload.images.length) {
      showToast("Adjunta al menos una fotografía para analizarla.", "error");
      return;
    }

    if (action === "price" && !payload.product) {
      showToast("Indica primero qué producto estás vendiendo.", "error");
      return;
    }

    if (action === "listing_analysis") {
      payload.listing = buildCompleteListingText();
      if (!payload.listing.trim()) {
        showToast("Genera primero el anuncio que quieres auditar.", "error");
        return;
      }
    }

    state.generating = true;
    setActionLoading(button, true);
    showAdvancedLoading(action);

    try {
      const response = await requestApi(payload);
      renderAdvancedResult(action, response.result || {});
    } catch (error) {
      renderAdvancedError(error.message);
    } finally {
      state.generating = false;
      setActionLoading(button, false);
    }
  }

  async function generateBuyerReply() {
    if (state.generating) return;

    const question = cleanText(elements.buyerQuestion?.value);

    if (!question) {
      showToast("Pega primero la pregunta del comprador.", "error");
      elements.buyerQuestion?.focus();
      return;
    }

    const payload = buildPayload("reply");
    payload.question = question;
    state.generating = true;
    setActionLoading(elements.replyButton, true);

    try {
      const response = await requestApi(payload);
      const result = response.result || {};
      const reply = result.response || result.shorter_response || "";
      elements.customReplyResult.textContent = reply;
      elements.customReplyResult.classList.remove("hidden");
      showToast("Respuesta generada.", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      state.generating = false;
      setActionLoading(elements.replyButton, false);
    }
  }

  function buildPayload(mode) {
    return {
      mode,
      product: cleanText(elements.product?.value),
      platform: cleanText(elements.platform?.value) || "general",
      goal: cleanText(elements.goal?.value) || "balanced",
      category: cleanText(elements.category?.value),
      brand: cleanText(elements.brand?.value),
      condition: cleanText(elements.condition?.value),
      price: cleanText(elements.price?.value),
      details: cleanText(elements.details?.value).slice(0, MAX_DETAILS),
      images: state.images.map((image) => ({
        data: image.data,
        type: image.type
      }))
    };
  }

  async function requestApi(payload) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 65000);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        throw new Error("El servidor devolvió una respuesta no válida.");
      }

      if (!response.ok || !data?.ok) {
        throw new Error(formatApiError(data, response.status));
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("La solicitud tardó demasiado. Inténtalo de nuevo.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function formatApiError(data, status) {
    if (data?.code === "OPENAI_BILLING" || status === 402) {
      return "La cuenta de OpenAI necesita saldo o facturación activa. La web está preparada; falta activar el uso de la API.";
    }

    if (data?.code === "OPENAI_AUTH") {
      return "La clave de OpenAI no es válida o no está activa en Vercel.";
    }

    if (data?.error) return String(data.error);
    return `No se pudo completar la operación (HTTP ${status}).`;
  }

  function renderFullResult(result) {
    elements.titleResult.textContent = result.title || "Sin título generado";
    elements.descriptionResult.textContent = result.description || "Sin descripción generada.";
    renderChips(elements.keywordsResult, result.keywords, "No se generaron palabras clave.");
    renderChips(elements.hashtagsResult, result.hashtags, "No se generaron hashtags.");
    renderReplies(result.buyer_replies);
    renderBulletList(elements.photoAdviceResult, result.photo_advice);

    const score = clamp(Number(result.quality_score) || 0, 0, 100);
    if (elements.qualityScore) elements.qualityScore.textContent = String(score);
    if (elements.qualitySummary) elements.qualitySummary.textContent = result.quality_summary || "Evaluación del contenido generado.";
  }

  function renderChips(container, values, emptyText) {
    if (!container) return;
    const list = Array.isArray(values) ? values.filter(Boolean) : [];
    container.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("span");
      empty.className = "keyword";
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }

    list.forEach((value) => {
      const chip = document.createElement("span");
      chip.className = "keyword";
      chip.textContent = String(value);
      container.appendChild(chip);
    });
  }

  function renderReplies(values) {
    if (!elements.buyerRepliesResult) return;
    elements.buyerRepliesResult.innerHTML = "";
    const list = Array.isArray(values) ? values.filter(Boolean) : [];

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "reply-item";
      empty.textContent = "Genera el anuncio para preparar respuestas de compradores.";
      elements.buyerRepliesResult.appendChild(empty);
      return;
    }

    list.forEach((value) => {
      const item = document.createElement("div");
      item.className = "reply-item";
      item.textContent = String(value);
      elements.buyerRepliesResult.appendChild(item);
    });
  }

  function renderBulletList(container, values) {
    if (!container) return;
    container.innerHTML = "";
    const list = Array.isArray(values) ? values.filter(Boolean) : [];

    if (!list.length) {
      const item = document.createElement("li");
      item.textContent = "No hay recomendaciones adicionales.";
      container.appendChild(item);
      return;
    }

    list.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = String(value);
      container.appendChild(item);
    });
  }

  function renderAdvancedResult(action, result) {
    if (!elements.advancedResult) return;

    elements.advancedResult.classList.remove("hidden");
    elements.advancedResult.innerHTML = "";

    if (action === "photo") {
      renderPhotoAnalysis(result);
      return;
    }

    if (action === "price") {
      renderPriceAnalysis(result);
      return;
    }

    if (action === "listing_analysis") {
      renderListingAnalysis(result);
      return;
    }
  }

  function renderPhotoAnalysis(result) {
    const score = clamp(Number(result.photo_quality) || 0, 0, 100);
    const sections = [
      ["Qué se ve", result.visible_product || "No se pudo confirmar el producto visualmente."],
      ["Fortalezas", toList(result.photo_strengths)],
      ["Observaciones de estado", toList(result.condition_observations)],
      ["Posibles puntos a revisar", toList(result.possible_issues)],
      ["Cómo mejorar las fotos", toList(result.photo_improvements)]
    ];

    elements.advancedResult.innerHTML = `<h4>Análisis fotográfico · ${score}/100</h4>`;
    sections.forEach(([title, content]) => appendAdvancedSection(title, content));
    if (result.caution) appendAdvancedSection("Precaución", result.caution);
  }

  function renderPriceAnalysis(result) {
    const suggested = formatEuro(result.suggested_price);
    const quick = formatEuro(result.quick_sale_price);
    const floor = formatEuro(result.negotiation_floor);
    const range = `${formatEuro(result.price_range_low)} – ${formatEuro(result.price_range_high)}`;

    elements.advancedResult.innerHTML = `<h4>Estrategia de precio</h4><div class="price-grid"><div><small>Precio orientativo</small><strong>${suggested}</strong></div><div><small>Venta rápida</small><strong>${quick}</strong></div><div><small>Suelo de negociación</small><strong>${floor}</strong></div><div><small>Rango observado</small><strong>${range}</strong></div></div>`;

    appendAdvancedSection("Lectura del mercado", result.market_context || "Sin contexto suficiente.");
    appendAdvancedSection("Recomendación", result.recommendation || "Sin recomendación.");
    appendAdvancedSection("Factores", toList(result.factors));
    appendAdvancedSection("Fuentes", result.sources_note || "La estimación se basa en referencias públicas encontradas mediante búsqueda web.");
  }

  function renderListingAnalysis(result) {
    const score = clamp(Number(result.score) || 0, 0, 100);
    elements.advancedResult.innerHTML = `<h4>Auditoría del anuncio · ${score}/100</h4>`;
    appendAdvancedSection("Lectura general", result.verdict || "Sin veredicto.");
    appendAdvancedSection("Fortalezas", toList(result.strengths));
    appendAdvancedSection("Debilidades", toList(result.weaknesses));
    appendAdvancedSection("Información que falta", toList(result.missing_information));
    appendAdvancedSection("Acciones recomendadas", toList(result.actions));
    appendAdvancedSection("Título mejorado", result.improved_title || "Sin propuesta.");
    appendAdvancedSection("Descripción mejorada", result.improved_description || "Sin propuesta.");
  }

  function appendAdvancedSection(title, content) {
    const wrapper = document.createElement("div");
    wrapper.style.marginTop = "14px";

    const heading = document.createElement("div");
    heading.style.color = "#758199";
    heading.style.fontSize = "8px";
    heading.style.fontWeight = "800";
    heading.style.letterSpacing = ".14em";
    heading.style.textTransform = "uppercase";
    heading.textContent = title;
    wrapper.appendChild(heading);

    if (Array.isArray(content)) {
      const ul = document.createElement("ul");
      ul.className = "bullet-list";
      content.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = String(item);
        ul.appendChild(li);
      });
      wrapper.appendChild(ul);
    } else {
      const paragraph = document.createElement("p");
      paragraph.textContent = String(content || "—");
      wrapper.appendChild(paragraph);
    }

    elements.advancedResult.appendChild(wrapper);
  }

  function showAdvancedLoading(action) {
    if (!elements.advancedResult) return;
    elements.advancedResult.classList.remove("hidden");
    elements.advancedResult.innerHTML = `<h4>Procesando ${escapeHtml(featureName(action))}…</h4><p>La IA está trabajando con los datos y las fotografías disponibles.</p>`;
  }

  function renderAdvancedError(message) {
    if (!elements.advancedResult) return;
    elements.advancedResult.classList.remove("hidden");
    elements.advancedResult.innerHTML = `<h4>No se pudo completar</h4><p>${escapeHtml(message)}</p>`;
  }

  function featureName(action) {
    const names = {
      photo: "las fotografías",
      price: "la estrategia de precio",
      listing_analysis: "la auditoría"
    };
    return names[action] || "la herramienta";
  }

  function buildCompleteListingText() {
    const title = cleanText(elements.titleResult?.textContent);
    const description = cleanText(elements.descriptionResult?.textContent);
    const keywords = getCurrentKeywords();
    const hashtags = getCurrentHashtags();

    return [
      title ? `TÍTULO:\n${title}` : "",
      description ? `DESCRIPCIÓN:\n${description}` : "",
      keywords.length ? `PALABRAS CLAVE:\n${keywords.join(", ")}` : "",
      hashtags.length ? `HASHTAGS:\n${hashtags.join(" ")}` : ""
    ].filter(Boolean).join("\n\n");
  }

  function getCurrentKeywords() {
    return $$(".keyword", elements.keywordsResult || document)
      .map((element) => cleanText(element.textContent))
      .filter((value) => value && !value.startsWith("No se generaron"));
  }

  function getCurrentHashtags() {
    return $$(".keyword", elements.hashtagsResult || document)
      .map((element) => cleanText(element.textContent))
      .filter((value) => value && !value.startsWith("No se generaron"));
  }

  function showResultState(stateName) {
    elements.emptyState?.classList.toggle("hidden", stateName !== "empty");
    elements.loadingState?.classList.toggle("hidden", stateName !== "loading");
    elements.errorState?.classList.toggle("hidden", stateName !== "error");
    elements.resultContent?.classList.toggle("hidden", stateName !== "result");
  }

  function setLoading(loading, statusText = "Generando") {
    elements.generateButton?.classList.toggle("is-loading", loading);
    if (elements.generateButton) elements.generateButton.disabled = loading;
    if (elements.resultStatus) elements.resultStatus.textContent = loading ? statusText : "Listo";
    if (loading) showResultState("loading");
  }

  function setActionLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.setAttribute("aria-busy", loading ? "true" : "false");
    button.classList.toggle("is-loading", loading);
  }

  function showError(message) {
    elements.errorMessage.textContent = message || "No se pudo completar la operación.";
    elements.resultStatus.textContent = "Error";
    showResultState("error");
    showToast(message, "error");
  }

  function showFieldError(element, message) {
    if (!element) return;
    element.setAttribute("aria-invalid", "true");
    element.dataset.error = message;
    element.focus();
    showToast(message, "error");
  }

  function clearFieldError(element) {
    if (!element) return;
    element.removeAttribute("aria-invalid");
    delete element.dataset.error;
  }

  function scrollResultIntoView() {
    window.setTimeout(() => {
      document.querySelector(".result-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function copyText(text) {
    const value = String(text || "").trim();
    if (!value) {
      showToast("No hay contenido para copiar.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    showToast("Copiado al portapapeles.", "success");
  }

  function flashButton(button, text) {
    if (!button) return;
    const original = button.textContent;
    button.textContent = text;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1200);
  }

  function showToast(message, type = "success") {
    if (!elements.toast) return;
    elements.toast.textContent = String(message || "");
    elements.toast.className = `toast show ${type}`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      elements.toast.classList.remove("show");
    }, 3200);
  }

  function cleanText(value) {
    return String(value ?? "").replace(/\u0000/g, "").trim();
  }

  function toList(value) {
    return Array.isArray(value) ? value.filter(Boolean).map((item) => String(item)) : [];
  }

  function formatEuro(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "—";
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(number);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
