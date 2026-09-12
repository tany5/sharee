/**
 * Saree AI Studio — app wiring: upload/preview, Puter auth status, generate
 * (AI photo → exact-text overlay), variations, PNG download. No frameworks.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    authStatus: $("auth-status"), btnSignin: $("btn-signin"),
    drop: $("drop"), file: $("file"), previewWrap: $("preview-wrap"),
    preview: $("preview"), btnClear: $("btn-clear"), fileError: $("file-error"),
    brand: $("f-brand"), headline: $("f-headline"), offer: $("f-offer"), ship: $("f-ship"),
    style: $("f-style"), model: $("f-model"), format: $("f-format"),
    generate: $("btn-generate"), genStatus: $("gen-status"), genError: $("gen-error"),
    resultEmpty: $("result-empty"), result: $("result"), resultImg: $("result-img"),
    download: $("btn-download"), again: $("btn-again"),
  };

  var state = { imageDataUrl: null, lastBaseUrl: null, logo: null, variation: 0, generating: false };
  var workerId = "saree-studio-" + Math.random().toString(36).slice(2);

  /* ------------------------------ puter auth ------------------------------ */

  function refreshAuth() {
    if (!window.puter) {
      els.authStatus.textContent = "Puter.js failed to load — check your connection.";
      return;
    }
    try {
      window.puter.auth.isSignedIn().then(function (signedIn) {
        if (signedIn) {
          els.authStatus.textContent = "✓ Signed in to Puter";
          els.authStatus.classList.add("ok");
          els.btnSignin.classList.add("hidden");
          els.generate.disabled = !state.imageDataUrl;
          startRelayWorker();
        } else {
          els.authStatus.textContent = "Not signed in — sign-in popup opens on generate.";
          els.btnSignin.classList.remove("hidden");
        }
      });
    } catch {
      els.authStatus.textContent = "Puter unavailable right now.";
    }
  }

  els.btnSignin.addEventListener("click", function () {
    window.puter.auth.signIn().then(refreshAuth).catch(function () {
      els.authStatus.textContent = "Sign-in cancelled.";
    });
  });

  /* -------------------------------- upload -------------------------------- */

  function acceptFile(file) {
    if (!file || !/^image\//.test(file.type)) {
      els.fileError.textContent = "Please upload a clear saree image (JPG/PNG/WebP).";
      els.fileError.classList.remove("hidden");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      els.fileError.textContent = "Image is too large — please use one under 12 MB.";
      els.fileError.classList.remove("hidden");
      return;
    }
    els.fileError.classList.add("hidden");
    var reader = new FileReader();
    reader.onload = function () {
      state.imageDataUrl = String(reader.result);
      els.preview.src = state.imageDataUrl;
      els.previewWrap.classList.remove("hidden");
      els.drop.classList.add("hidden");
      els.generate.disabled = state.generating;
    };
    reader.readAsDataURL(file);
  }

  els.drop.addEventListener("click", function () { els.file.click(); });
  els.drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") els.file.click(); });
  els.file.addEventListener("change", function () { acceptFile(els.file.files[0]); });
  els.drop.addEventListener("dragover", function (e) { e.preventDefault(); });
  els.drop.addEventListener("drop", function (e) {
    e.preventDefault();
    acceptFile(e.dataTransfer.files[0]);
  });
  els.btnClear.addEventListener("click", function () {
    state.imageDataUrl = null;
    els.previewWrap.classList.add("hidden");
    els.drop.classList.remove("hidden");
    els.generate.disabled = true;
  });

  /* ------------------------------ generation ------------------------------ */

  function setBusy(busy, msg) {
    state.generating = busy;
    els.generate.disabled = busy || !state.imageDataUrl;
    els.generate.textContent = busy ? "Creating your saree campaign…" : "Generate Post";
    els.genStatus.classList.toggle("hidden", !busy);
    els.genStatus.textContent = busy ? msg || "Painting the model, saree and scene…" : "";
    if (busy) els.genError.classList.add("hidden");
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Generated image could not be loaded")); };
      img.src = url;
    });
  }

  loadImage("/logo/logo-light.webp").then(function (img) {
    state.logo = img;
  }).catch(function () {
    state.logo = null;
  });

  function formatDims() {
    var w = 1080;
    var h = window.SareeAI.FORMAT_SIZES[els.format.value] || 1080;
    return { width: w, height: h };
  }

  function generate() {
    if (state.generating || !state.imageDataUrl) return;
    setBusy(true);

    window.SareeAI
      .generateCampaign({
        imageDataUrl: state.imageDataUrl,
        styleKey: els.style.value,
        model: els.model.value,
        variationSeed: state.variation,
      })
      .then(function (out) {
        if (!out.url) throw new Error("Image generation returned nothing");
        state.lastBaseUrl = out.url;
        return loadImage(out.url);
      })
      .then(function (img) {
        var dims = formatDims();
        var dataUrl = window.SareeOverlay.composePost({
          image: img,
          logo: state.logo,
          width: dims.width,
          height: dims.height,
          text: {
            brand: els.brand.value.trim() || "TheTanti",
            headline: els.headline.value.trim() || "OUR SAREE",
            offer: els.offer.value.trim() || "₹199 FLAT",
            ship: els.ship.value.trim() || "SHIPPING INCLUDED",
          },
        });
        els.resultImg.src = dataUrl;
        els.result.classList.remove("hidden");
        els.resultEmpty.classList.add("hidden");
        state.variation += 1;
        setBusy(false);
      })
      .catch(function (err) {
        setBusy(false);
        els.genError.textContent = window.SareeAI.friendlyError(err);
        els.genError.classList.remove("hidden");
      });
  }

  function startRelayWorker() {
    if (state.workerStarted) return;
    state.workerStarted = true;
    pollRelay();
    setInterval(function () {
      fetch("/api/admin/marketing-ai/puter-relay/jobs?mode=heartbeat&workerId=" + encodeURIComponent(workerId), {
        cache: "no-store",
      }).catch(function () {});
    }, 5000);
    setInterval(pollRelay, 2500);
  }

  function pollRelay() {
    fetch("/api/admin/marketing-ai/puter-relay/jobs?workerId=" + encodeURIComponent(workerId), {
      cache: "no-store",
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !data.job) return;
        return runRelayJob(data.job);
      })
      .catch(function () {});
  }

  function runRelayJob(job) {
    var payload = job.payload || {};
    var prompt = payload.prompt;
    if (!prompt) return completeRelay(job.id, null, "Relay job had no prompt");
    return window.puter.ai.txt2img(prompt, { model: els.model.value || "gpt-image-2.5-flare" })
      .then(function (out) {
        var url = typeof out === "string" ? out : out && (out.url || out.src);
        if (!url) throw new Error("Empty result from Puter image model");
        return loadImage(url);
      })
      .then(function (img) {
        var dataUrl = window.SareeOverlay.composePost({
          image: img,
          logo: state.logo,
          width: payload.width || 1080,
          height: payload.height || 1080,
          text: {
            brand: "TheTanti",
            headline: "OUR SAREE",
            offer: "₹" + ((payload.product && payload.product.price) || 199) + " FLAT",
            ship: "SHIPPING INCLUDED",
          },
        });
        return completeRelay(job.id, dataUrl, null);
      })
      .catch(function (err) {
        return completeRelay(job.id, null, window.SareeAI.friendlyError(err));
      });
  }

  function completeRelay(id, imageDataUrl, error) {
    return fetch("/api/admin/marketing-ai/puter-relay/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: id,
        workerId: workerId,
        imageDataUrl: imageDataUrl,
        contentType: "image/png",
        error: error || undefined,
      }),
    }).catch(function () {});
  }

  els.generate.addEventListener("click", generate);
  els.again.addEventListener("click", generate);

  els.download.addEventListener("click", function () {
    var src = els.resultImg.src;
    if (!src) return;
    var slug = (els.offer.value.trim() || "saree-post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    var a = document.createElement("a");
    a.href = src;
    a.download = slug + "-thetanti.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  refreshAuth();
})();
