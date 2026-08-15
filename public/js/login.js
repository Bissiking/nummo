// public/js/login.js
const form = document.querySelector("#local-login-form");
const openLink = document.querySelector("#local-open");
const kyrosLogin = document.querySelector("#kyros-login");
const kyrosState = document.querySelector("#kyros-state");
const copy = document.querySelector("#access-copy");
const errorText = document.querySelector("#login-error");
const privacyNote = document.querySelector("#privacy-note-text");

async function request(path, options) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "La connexion n'a pas abouti.");
  return payload?.data;
}

async function initialize() {
  try {
    const callbackError = new URLSearchParams(location.search).get("error");
    if (callbackError) errorText.textContent = callbackError === "kyros_exchange_failed" ? "Kyros n’a pas pu finaliser la session. Réessayez." : "La réponse Kyros n’a pas pu être vérifiée. Réessayez.";
    const status = await request("/api/auth/status");
    if (status.authenticated) {
      copy.textContent = "La session est déjà ouverte sur cet appareil.";
      openLink.hidden = false;
    } else if (status.provider === "local" && status.misconfigured) {
      copy.textContent = "La protection locale est incomplète et le registre reste verrouillé.";
      kyrosState.querySelector("span").textContent = "Session locale";
      kyrosState.querySelector("strong").textContent = "SESSION_SECRET requis";
      kyrosState.querySelector("small").textContent = "Configurez un secret aléatoire d’au moins 32 caractères puis redémarrez Nummo.";
      kyrosState.hidden = false;
    } else if (status.provider === "local" && status.protected) {
      copy.textContent = "Identifiez-vous pour accéder aux données de ce registre privé.";
      privacyNote.textContent = "Le mot de passe reste côté serveur et la session utilise un cookie HttpOnly.";
      form.hidden = false;
      form.elements.username.focus();
    } else if (status.provider === "local") {
      copy.textContent = "Nummo fonctionne actuellement en mode local, sans mot de passe configuré.";
      openLink.hidden = false;
    } else if (status.provider === "kyros" && status.protected) {
      copy.textContent = "Kyros vérifie votre identité avant d’ouvrir ce registre privé.";
      privacyNote.textContent = "La connexion est déléguée à Kyros ; Nummo conserve uniquement des cookies de session HttpOnly.";
      kyrosLogin.hidden = false;
    } else {
      copy.textContent = "Le fournisseur d’identité doit être configuré avant de pouvoir ouvrir le registre.";
      kyrosState.hidden = false;
    }
  } catch (error) {
    copy.textContent = error.message;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorText.textContent = "";
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await request("/api/auth/local", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    location.assign("/");
  } catch (error) {
    errorText.textContent = error.message;
    form.elements.password.select();
  } finally {
    button.disabled = false;
  }
});

initialize();
