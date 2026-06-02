const searchInput = document.querySelector("#site-search");
const postList = document.querySelector("#post-list");
const answerDataList = document.querySelector("#answer-data-list");
const dailyAnswerTable = document.querySelector("#daily-answer-table");
const articleBody = document.querySelector("[data-answer-date]");

const dataPath = window.location.pathname.includes("/answers/")
  ? "../data/answers.json"
  : "data/answers.json";

if (searchInput && postList) {
  const cards = [...postList.querySelectorAll("[data-search]")];

  searchInput.addEventListener("input", () => {
    const keyword = searchInput.value.trim().toLowerCase();

    cards.forEach((card) => {
      const text = card.dataset.search.toLowerCase();
      card.hidden = keyword.length > 0 && !text.includes(keyword);
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAnswerCards(entries) {
  if (!answerDataList) return;

  const mode = answerDataList.dataset.mode;
  const visibleEntries = mode === "latest" ? entries.slice(0, 5) : entries;

  answerDataList.innerHTML = visibleEntries.map((entry) => {
    const firstAnswer = entry.items[0]?.answer ?? "확인 필요";

    return `
      <article class="data-card" data-search="${escapeHtml(`${entry.date} ${entry.title}`)}">
        <a href="${escapeHtml(entry.url)}">
          <span class="tag">${escapeHtml(entry.date)}</span>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml(entry.summary)}</p>
          <small>업데이트 ${escapeHtml(entry.updatedAt)} · 대표 정답: ${escapeHtml(firstAnswer)}</small>
        </a>
      </article>
    `;
  }).join("");
}

function renderDailyAnswers(entries) {
  if (!dailyAnswerTable || !articleBody) return;

  const date = articleBody.dataset.answerDate;
  const entry = entries.find((item) => item.date === date);

  if (!entry) {
    dailyAnswerTable.innerHTML = '<p class="muted">해당 날짜의 정답 데이터가 없습니다.</p>';
    return;
  }

  dailyAnswerTable.innerHTML = entry.items.map((item) => `
    <div class="answer-row">
      <span>브랜드/문항</span>
      <strong>${escapeHtml(item.brand)}</strong>
      <span>정답</span>
      <mark>${escapeHtml(item.answer)}</mark>
      <p class="question">${escapeHtml(item.question)}</p>
      <p class="note">${escapeHtml(item.note ?? "")}</p>
    </div>
  `).join("");
}

async function loadAnswerData() {
  if (!answerDataList && !dailyAnswerTable) return;

  try {
    const response = await fetch(dataPath);
    if (!response.ok) throw new Error("answers.json load failed");
    const entries = await response.json();

    entries.sort((a, b) => b.date.localeCompare(a.date));
    renderAnswerCards(entries);
    renderDailyAnswers(entries);
  } catch {
    if (answerDataList) {
      answerDataList.innerHTML = '<p class="muted">정답 데이터를 불러오지 못했습니다.</p>';
    }
    if (dailyAnswerTable) {
      dailyAnswerTable.innerHTML = '<p class="muted">정답 데이터를 불러오지 못했습니다.</p>';
    }
  }
}

loadAnswerData();
