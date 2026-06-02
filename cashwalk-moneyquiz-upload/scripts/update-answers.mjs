import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const answersPath = path.join(root, "data", "answers.json");
const sourcePagesPath = path.join(root, "data", "source-pages.json");
const answersDir = path.join(root, "answers");
const sitemapPath = path.join(root, "sitemap.xml");

const siteBaseUrl = (process.env.SITE_BASE_URL || "https://YOUR_GITHUB_USERNAME.github.io/cashwalk-moneyquiz").replace(/\/$/, "");
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const apiKey = process.env.OPENAI_API_KEY;

function getKoreanDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const [year, month, day] = formatter.format(date).split("-");
  return { year, month, day, iso: `${year}-${month}-${day}` };
}

function formatKoreanTitle(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일 캐시워크 돈버는퀴즈 정답`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function parseSourceUrls() {
  const fromEnv = (process.env.ANSWER_SOURCE_URLS || "")
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => ({ name: url, url }));

  return fromEnv;
}

async function loadSources() {
  const envSources = parseSourceUrls();
  if (envSources.length > 0) return envSources;

  const fileSources = await readJson(sourcePagesPath, []);
  return fileSources.filter((source) => source.url && !source.url.includes("example.com"));
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "CashwalkAnswerBot/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status}`);
  }

  const html = await response.text();
  return {
    name: source.name || source.url,
    url: source.url,
    text: htmlToText(html).slice(0, 12000)
  };
}

function extractResponseText(responseJson) {
  if (typeof responseJson.output_text === "string") return responseJson.output_text;

  const chunks = [];
  for (const item of responseJson.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

function extractJsonObject(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model output did not include a JSON object.");
  }
  return JSON.parse(clean.slice(start, end + 1));
}

function normalizeEntry(entry, date) {
  const safeItems = Array.isArray(entry.items) ? entry.items : [];
  return {
    date,
    updatedAt: entry.updatedAt || new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date()),
    title: entry.title || formatKoreanTitle(date),
    url: `answers/${date}.html`,
    summary: entry.summary || `${date} 캐시워크 돈버는퀴즈 정답을 정리했습니다.`,
    items: safeItems.map((item) => ({
      brand: item.brand || "브랜드 미확인",
      question: item.question || "문항 확인 필요",
      answer: item.answer || "확인 필요",
      note: item.note || "출처 확인 후 업데이트"
    })).filter((item) => item.answer !== "확인 필요")
  };
}

async function createAnswerEntry(date, sources) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to GitHub Actions secrets.");
  }

  const sourceText = sources.map((source, index) => [
    `SOURCE ${index + 1}: ${source.name}`,
    `URL: ${source.url}`,
    source.text
  ].join("\n")).join("\n\n---\n\n");

  const prompt = `
오늘 날짜는 ${date} (Asia/Seoul)입니다.
아래 소스 텍스트에서 오늘 날짜의 캐시워크 돈버는퀴즈 정답만 추출해 JSON으로 정리하세요.

규칙:
- 소스에 명시된 정보만 사용하세요.
- 정답을 추측하거나 만들어내지 마세요.
- 오늘 날짜와 관련 없는 항목은 제외하세요.
- 정답이 불확실하면 items에 넣지 마세요.
- 출력은 JSON 객체 하나만 반환하세요.

JSON 형식:
{
  "date": "${date}",
  "updatedAt": "HH:mm",
  "title": "${formatKoreanTitle(date)}",
  "summary": "요약 문장",
  "items": [
    {
      "brand": "브랜드명 또는 문항명",
      "question": "문제 문장 또는 핵심 키워드",
      "answer": "정답",
      "note": "출처 또는 변경 가능성 메모"
    }
  ]
}

소스:
${sourceText}
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_object"
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const responseJson = await response.json();
  const parsed = extractJsonObject(extractResponseText(responseJson));
  return normalizeEntry(parsed, date);
}

function renderAnswerPage(entry) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(entry.title)}</title>
  <meta name="description" content="${escapeHtml(entry.summary)}">
  <link rel="stylesheet" href="../assets/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="topline">
      <a class="brand" href="../index.html">캐시워크 돈버는퀴즈</a>
      <form class="search" role="search">
        <label class="sr-only" for="site-search">글 검색</label>
        <input id="site-search" type="search" placeholder="브랜드명, 날짜, 키워드 검색">
      </form>
    </div>
    <nav aria-label="주요 메뉴">
      <a href="../index.html">홈</a>
      <a href="../archive.html">날짜별 정답</a>
      <a href="../guide.html">이용 가이드</a>
      <a href="../about.html">소개</a>
      <a href="../contact.html">문의</a>
    </nav>
  </header>
  <main class="article-page">
    <article class="article-body" data-answer-date="${escapeHtml(entry.date)}">
      <p class="category">Cashwalk Answer</p>
      <h1>${escapeHtml(entry.title)}</h1>
      <p class="meta">자동 업데이트 · ${escapeHtml(entry.date)} ${escapeHtml(entry.updatedAt)}</p>
      <div class="alert">정답은 이벤트 진행 상황에 따라 달라질 수 있습니다. 캐시워크 앱 화면의 문제 문장과 함께 확인하세요.</div>
      <section class="answer-table" id="daily-answer-table" aria-label="정답 목록"></section>
      <h2>확인 메모</h2>
      <p>이 페이지는 GitHub Actions 자동화가 <code>data/answers.json</code>의 날짜별 데이터를 읽어 표시합니다. 정답 후보가 불확실한 항목은 자동 등록하지 않도록 설계되어 있습니다.</p>
    </article>
  </main>
  <footer>
    <p>© 2026 캐시워크 돈버는퀴즈. All rights reserved.</p>
    <nav aria-label="하단 메뉴">
      <a href="../privacy.html">개인정보처리방침</a>
      <a href="../terms.html">이용약관</a>
      <a href="../contact.html">문의</a>
    </nav>
  </footer>
  <script src="../assets/app.js"></script>
</body>
</html>
`;
}

function renderSitemap(entries) {
  const staticPages = [
    "",
    "archive.html",
    "guide.html",
    "about.html",
    "contact.html",
    "privacy.html",
    "terms.html"
  ];

  const urls = [
    ...staticPages.map((page) => `${siteBaseUrl}/${page}`),
    ...entries.map((entry) => `${siteBaseUrl}/${entry.url}`)
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${escapeHtml(url)}</loc>
    <lastmod>${getKoreanDateParts().iso}</lastmod>
  </url>`).join("\n")}
</urlset>
`;
}

async function main() {
  const { iso: today } = getKoreanDateParts();
  const sources = await loadSources();

  if (sources.length === 0) {
    console.log("No source URLs configured. Set ANSWER_SOURCE_URLS or data/source-pages.json.");
    return;
  }

  const fetchedSources = [];
  for (const source of sources) {
    try {
      fetchedSources.push(await fetchSource(source));
    } catch (error) {
      console.warn(error.message);
    }
  }

  if (fetchedSources.length === 0) {
    console.log("No source pages could be fetched.");
    return;
  }

  const existingEntries = await readJson(answersPath, []);
  const nextEntry = await createAnswerEntry(today, fetchedSources);

  if (nextEntry.items.length === 0) {
    console.log("No reliable answers found for today. Existing data was left unchanged.");
    return;
  }

  const mergedEntries = [
    nextEntry,
    ...existingEntries.filter((entry) => entry.date !== today)
  ].sort((a, b) => b.date.localeCompare(a.date));

  await fs.writeFile(answersPath, `${JSON.stringify(mergedEntries, null, 2)}\n`, "utf8");
  await fs.mkdir(answersDir, { recursive: true });
  await fs.writeFile(path.join(answersDir, `${today}.html`), renderAnswerPage(nextEntry), "utf8");
  await fs.writeFile(sitemapPath, renderSitemap(mergedEntries), "utf8");

  console.log(`Updated ${today} with ${nextEntry.items.length} answer item(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
