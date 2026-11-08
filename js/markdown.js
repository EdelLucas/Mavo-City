/* ==========================================================
   Mavo City – einfache, sichere Text-Formatierung
   Wird im Forum und im Wiki verwendet.

   **fett**  *kursiv*  `code`  [Text](https://link)  ![Bild](https://bild.jpg)
   # Überschrift   ## Unterüberschrift   - Liste   > Zitat   | Tabelle |

   Sicherheit: Der Text wird ZUERST komplett HTML-escaped, danach werden
   nur die obigen Muster umgewandelt. Links nur mit http(s) oder #.
   ========================================================== */
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|#)/i.test(u) ? u : null);

  function inline(text) {
    return text
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) =>
        safeUrl(url) && !url.startsWith("#") ? `<img src="${url}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">` : m)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
        if (!safeUrl(url)) return m;
        return url.startsWith("#")
          ? `<a href="${url}">${label}</a>`
          : `<a href="${url}" target="_blank" rel="noopener nofollow ugc">${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  }

  function renderMarkdown(src) {
    const lines = esc(src).replace(/\r/g, "").split("\n");
    const out = [];
    let list = null;        // offene <ul>
    let quote = [];         // gesammelte Zitatzeilen
    let para = [];          // gesammelte Absatzzeilen
    let table = [];         // gesammelte Tabellenzeilen

    const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; } };
    const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${quote.map(inline).join("<br>")}</blockquote>`); quote = []; } };
    const flushTable = () => {
      if (!table.length) return;
      const cells = (l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const isSep = (r) => r.every((c) => /^:?-{2,}:?$/.test(c));
      const rows = table.map(cells);
      let headRow = null;
      if (rows.length > 1 && isSep(rows[1])) { headRow = rows[0]; rows.splice(0, 2); }
      out.push(`<div class="md-table"><table>${
        headRow ? `<thead><tr>${headRow.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` : ""
      }<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      table = [];
    };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable(); };

    for (const raw of lines) {
      const line = raw.trimEnd();
      let m;
      if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); flushList(); flushQuote(); table.push(line.trim()); continue; }
      flushTable();
      if (!line.trim()) { flushAll(); continue; }
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        flushAll();
        const level = m[1].length + 1; // # -> h2, ## -> h3, ### -> h4
        out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      } else if ((m = line.match(/^\s*[-•*]\s+(.*)$/))) {
        flushPara(); flushQuote();
        (list ||= []).push(`<li>${inline(m[1])}</li>`);
      } else if ((m = line.match(/^&gt;\s?(.*)$/))) {
        flushPara(); flushList();
        quote.push(m[1]);
      } else {
        flushList(); flushQuote();
        para.push(line);
      }
    }
    flushAll();
    return out.join("");
  }

  window.renderMarkdown = renderMarkdown;
})();
