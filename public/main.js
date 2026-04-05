const form = document.getElementById("query-form");
const addressInput = document.getElementById("address");
const submitBtn = document.getElementById("submit-btn");
const summaryEl = document.getElementById("summary");
const resultEl = document.getElementById("result");
const playersSectionEl = document.getElementById("players-section");
const playersListEl = document.getElementById("players-list");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePayload(payload, requestedEdition) {
  const data =
    payload && typeof payload === "object" && payload.success === true && payload.data
      ? payload.data
      : payload;

  const online = Boolean(data?.online);
  const playersOnline = Number(data?.players?.online ?? 0);
  const playersMax = Number(data?.players?.max ?? 0);
  const playerList = Array.isArray(data?.players?.list) ? data.players.list : [];

  return {
    online,
    edition: data?.edition || requestedEdition || "java",
    host: data?.host || data?.input || "",
    port: data?.port ?? null,
    version: data?.version || null,
    iconUrl: data?.iconUrl || data?.icon || "",
    players: {
      online: Number.isFinite(playersOnline) ? playersOnline : 0,
      max: Number.isFinite(playersMax) ? playersMax : 0,
      list: playerList,
    },
  };
}

function renderPlayers(data) {
  const players = data.players?.list ?? [];
  const shouldShow = data.online && players.length > 0;

  if (!shouldShow) {
    playersSectionEl.classList.add("hidden");
    playersListEl.innerHTML = "";
    return;
  }

  playersSectionEl.classList.remove("hidden");
  playersListEl.innerHTML = players
    .map((player) => {
      if (typeof player === "string") {
        return player;
      }
      if (player && typeof player === "object" && typeof player.name === "string" && player.name.trim()) {
        return player.name;
      }
      return "Unknown Player";
    })
    .map((playerName) => `<li>${escapeHtml(playerName)}</li>`)
    .join("");
}

function showSummary(data) {
  const statusClass = data.online ? "online" : "offline";
  const statusText = data.online ? "Online" : "Offline";
  const editionText = data.edition === "bedrock" ? "Bedrock" : "Java";
  const players = `${data.players?.online ?? 0}/${data.players?.max ?? 0}`;
  const iconHtml = data.iconUrl
    ? `<img class="server-icon" src="${escapeHtml(data.iconUrl)}" alt="Server Icon" width="64" height="64" />`
    : `<div class="server-icon" aria-hidden="true"></div>`;

  summaryEl.classList.remove("hidden");
  summaryEl.innerHTML = `
    <div class="summary-top">
      ${iconHtml}
      <div>
        <strong class="${statusClass}">${statusText}</strong>
        <div>Edition: ${editionText}</div>
        <div>Host: ${escapeHtml(data.host || "Unknown")}${data.port ? `:${data.port}` : ""}</div>
        <div>Version: ${escapeHtml(data.version || "Unknown")}</div>
        <div>Players: ${players}</div>
      </div>
    </div>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = addressInput.value.trim();
  const edition = form.elements.edition.value;

  if (!address) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Querying...";
  summaryEl.classList.add("hidden");
  playersSectionEl.classList.add("hidden");
  resultEl.classList.remove("hidden");
  resultEl.textContent = "Querying...";

  try {
    const response = await fetch(
      `/api/mc-status?address=${encodeURIComponent(address)}&edition=${encodeURIComponent(edition)}`
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Request failed");
    }

    const data = normalizePayload(payload, edition);
    showSummary(data);
    renderPlayers(data);
    resultEl.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    resultEl.textContent = `Query failed: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Query Status";
  }
});
