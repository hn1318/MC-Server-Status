const form = document.getElementById("query-form");
const addressInput = document.getElementById("address");
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
    .map((player) => `<li>${escapeHtml(player)}</li>`)
    .join("");
}

function showSummary(data) {
  const statusClass = data.online ? "online" : "offline";
  const statusText = data.online ? "Online" : "Offline";
  const players = `${data.players?.online ?? 0}/${data.players?.max ?? 0}`;

  summaryEl.classList.remove("hidden");
  summaryEl.innerHTML = `
    <div class="summary-top">
      <img class="server-icon" src="${data.iconUrl}" alt="Server Icon" width="64" height="64" />
      <div>
        <strong class="${statusClass}">${statusText}</strong>
        <div>Host: ${escapeHtml(data.host)}${data.port ? `:${data.port}` : ""}</div>
        <div>Version: ${escapeHtml(data.version || "Unknown")}</div>
        <div>Players: ${players}</div>
      </div>
    </div>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = addressInput.value.trim();

  if (!address) return;

  summaryEl.classList.add("hidden");
  playersSectionEl.classList.add("hidden");
  resultEl.classList.remove("hidden");
  resultEl.textContent = "Querying...";

  try {
    const response = await fetch(`/api/mc-status?address=${encodeURIComponent(address)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    showSummary(data);
    renderPlayers(data);
    resultEl.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    resultEl.textContent = `Query failed: ${error.message}`;
  }
});
