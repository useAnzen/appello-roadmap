/**
 * Shared plan renderer — converts embedded markdown (in <script type="text/plain" id="plan-md">)
 * into styled HTML with syntax-highlighted code blocks.
 *
 * Usage: add these two tags at the bottom of any plan HTML file:
 *
 *   <script src="plan-renderer.js"></script>
 *   <script>renderPlan();</script>
 *
 * Expects:
 *   - A <div id="rendered"></div> target container
 *   - A <script type="text/plain" id="plan-md"> with the markdown source
 *
 * Syntax highlighting supports: prisma, typescript/ts, graphql, sql
 */

// eslint-disable-next-line no-unused-vars
function renderPlan() {
    var md = document.getElementById("plan-md").textContent;
    var target = document.getElementById("rendered");

    // ── Syntax highlighting ────────────────────────────────────────────

    /** Apply a regex replacement only to text OUTSIDE existing HTML tags */
    function replaceText(str, regex, replacement) {
        return str.replace(/(<[^>]*>)|([^<]+)/g, function (m, tag, text) {
            if (tag) return tag;
            return text.replace(regex, replacement);
        });
    }

    function highlightCode(code, lang) {
        // Comments first — these wrap entire line tails so replaceText skips them later
        code = code.replace(/(\/\/\s*&lt;--\s*.+)/g, '<span class="syn-add">$1</span>');
        code = code.replace(/(\/\/.+)/g, function (m) {
            if (m.indexOf("syn-add") !== -1) return m;
            return '<span class="syn-comment">' + m + "</span>";
        });

        if (lang === "prisma") {
            code = replaceText(code, /\b(model|enum|generator|datasource)\b/g, '<span class="syn-kw">$1</span>');
            // Decorators FIRST (before types so @db.Decimal doesn't get split)
            code = replaceText(
                code,
                /(@[\w.]+)(\([^)]*(?:\([^)]*\))?[^)]*\))?/g,
                function (_, attr, args) {
                    return (
                        '<span class="syn-attr">' +
                        attr +
                        "</span>" +
                        (args ? '<span class="syn-num">' + args + "</span>" : "")
                    );
                }
            );
            // Types (standalone — skip if preceded by . as in @db.Decimal)
            code = replaceText(
                code,
                /([^.\w]|^)(String|Boolean|DateTime|Decimal|Int|Float|Json)(\??)\b/gm,
                function (_, pre, typ, q) {
                    return pre + '<span class="syn-type">' + typ + (q || "") + "</span>";
                }
            );
            // Field names (first word on indented lines)
            code = code.replace(/^(\s+)(\w+)(\s+)/gm, function (_, ws, name, trail) {
                if (name === "model" || name === "enum" || name === "span") return _;
                return ws + '<span class="syn-field-name">' + name + "</span>" + trail;
            });
            // Braces
            code = replaceText(code, /([{}])/g, '<span class="syn-brace">$1</span>');
        } else if (lang === "typescript" || lang === "ts") {
            code = replaceText(
                code,
                /\b(const|let|var|function|return|if|else|import|export|from|interface|type|async|await|new|class|extends|implements|this|null|undefined|true|false|void)\b/g,
                '<span class="syn-kw">$1</span>'
            );
            code = replaceText(
                code,
                /\b(string|number|boolean|Record|Promise|null)\b/g,
                '<span class="syn-type">$1</span>'
            );
            code = replaceText(code, /("(?:[^"\\]|\\.)*")/g, '<span class="syn-str">$1</span>');
            code = replaceText(code, /\b(\d+\.?\d*)\b/g, '<span class="syn-num">$1</span>');
            code = replaceText(code, /(\.\w+)\s*\(/g, '<span class="syn-fn">$1</span>(');
        } else if (lang === "graphql") {
            // # comments for GraphQL
            code = code.replace(/(#\s*.+)/g, function (m) {
                if (m.indexOf("syn-") !== -1) return m;
                return '<span class="syn-comment">' + m + "</span>";
            });
            code = replaceText(
                code,
                /\b(type|input|query|mutation|subscription|fragment|on|enum|scalar|extend|schema)\b/g,
                '<span class="syn-kw">$1</span>'
            );
            code = replaceText(
                code,
                /\b(ID|String|Float|Int|Boolean)\b/g,
                '<span class="syn-type">$1</span>'
            );
            code = replaceText(code, /(\$\w+)/g, '<span class="syn-attr">$1</span>');
        } else if (lang === "sql") {
            code = replaceText(
                code,
                /\b(ALTER|TABLE|ADD|COLUMN|CREATE|INSERT|UPDATE|DELETE|SELECT|FROM|WHERE|SET|NULL|NOT|DEFAULT|INDEX|DROP|DECIMAL|VARCHAR|INT|BOOLEAN)\b/gi,
                '<span class="syn-kw">$1</span>'
            );
            code = replaceText(code, /(`[^`]+`)/g, '<span class="syn-str">$1</span>');
        }
        return code;
    }

    // ── Markdown → HTML ────────────────────────────────────────────────

    // Extract fenced code blocks FIRST so later regexes don't mangle <span> tags
    var codeBlocks = [];
    var html = md.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
        var esc = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        var rendered = "<pre><code>" + highlightCode(esc, lang) + "</code></pre>";
        var placeholder = "\x00CODEBLOCK_" + codeBlocks.length + "\x00";
        codeBlocks.push(rendered);
        return placeholder;
    });

    // Inline markdown
    html = html
        .replace(/`([^`\n]+)`/g, "<code>$1</code>")
        .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/^---$/gm, "<hr>");

    // Checkboxes
    html = html.replace(
        /^- \[ \] (.+)$/gm,
        '<div class="check-item"><div class="check-box"></div><span>$1</span></div>'
    );
    html = html.replace(
        /^- \[x\] (.+)$/gm,
        '<div class="check-item"><div class="check-box" style="background:#3b82f6;border-color:#3b82f6;"></div><span>$1</span></div>'
    );

    // Tables
    html = html.replace(/(\|.+\|\n)+/g, function (table) {
        var rows = table.trim().split("\n");
        if (rows.length < 2) return table;
        var headers = rows[0].split("|").filter(function (c) { return c.trim(); });
        var isSep = /^[\s|:\-]+$/.test(rows[1]);
        var start = isSep ? 2 : 1;
        var out = "<table><thead><tr>";
        headers.forEach(function (h) { out += "<th>" + h.trim() + "</th>"; });
        out += "</tr></thead><tbody>";
        for (var i = start; i < rows.length; i++) {
            var cells = rows[i].split("|").filter(function (c) { return c.trim(); });
            out += "<tr>";
            cells.forEach(function (c) { out += "<td>" + c.trim() + "</td>"; });
            out += "</tr>";
        }
        out += "</tbody></table>";
        return out;
    });

    // Unordered list items
    html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, function (m) {
        return "<ul>" + m + "</ul>";
    });

    // Paragraphs — wrap standalone text lines
    html = html.replace(
        /^(?!<[hultdps\/<]|<\/|<code|<pre|<hr|<div|<strong|<em)(.+)$/gm,
        "<p>$1</p>"
    );

    // Clean up double-wrapped
    html = html.replace(/<p><(h[1-4]|pre|table|ul|hr|div)/g, "<$1");

    // Reinsert code blocks
    for (var i = 0; i < codeBlocks.length; i++) {
        html = html.replace("\x00CODEBLOCK_" + i + "\x00", codeBlocks[i]);
    }

    target.innerHTML = html;

    // ── Inject syntax-highlight CSS (once) ─────────────────────────────

    if (!document.getElementById("plan-syn-css")) {
        var style = document.createElement("style");
        style.id = "plan-syn-css";
        style.textContent = [
            "pre { background: #1e293b; color: #f1f5f9; border-radius: 8px; padding: 16px; overflow-x: auto; font-size: 13px; line-height: 1.6; margin: 12px 0; font-family: 'SF Mono', 'Fira Code', monospace; }",
            "pre code { background: none; padding: 0; color: inherit; font-size: inherit; }",
            "pre .syn-kw { color: #c4b5fd; font-weight: 600; }",
            "pre .syn-type { color: #67e8f9; }",
            "pre .syn-str { color: #86efac; }",
            "pre .syn-num { color: #fca5a5; }",
            "pre .syn-comment { color: #94a3b8; font-style: italic; }",
            "pre .syn-attr { color: #fbbf24; }",
            "pre .syn-fn { color: #93c5fd; }",
            "pre .syn-punct { color: #cbd5e1; }",
            "pre .syn-add { color: #4ade80; font-weight: 600; }",
            "pre .syn-field { color: #f1f5f9; }",
            "pre .syn-field-name { color: #f8fafc; }",
            "pre .syn-brace { color: #e2e8f0; font-weight: 600; }"
        ].join("\n");
        document.head.appendChild(style);
    }
}
