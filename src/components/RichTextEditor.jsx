import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bold, List, ListOrdered } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Sanitiser                                                           */
/* ------------------------------------------------------------------ */
/* Lightweight, dependency-free HTML sanitiser for the rich-text notes
   field. Parses untrusted HTML with DOMParser (which never executes
   scripts) and rebuilds a fresh tree keeping ONLY an allow-list of tags
   plus a validated inline `style` (colour / font-size / bold). Every
   other tag is unwrapped (its text kept), every attribute dropped. This
   is what makes dangerouslySetInnerHTML safe downstream. */

const ALLOWED_TAGS = new Set([
  "P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "SPAN",
]);

// Legacy <font size="1..7"> → em font-size (execCommand('fontSize') still
// emits <font> in Chromium even with styleWithCSS).
const FONT_SIZE_MAP = {
  "1": "0.75em",
  "2": "0.85em",
  "3": "1em",
  "4": "1.15em",
  "5": "1.35em",
  "6": "1.6em",
  "7": "2em",
};

const COLOR_RE = /^#[0-9a-f]{3,8}$|^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i;
const SIZE_RE = /^\d+(\.\d+)?(px|em|rem|%)$/;

function safeStyle(el) {
  const out = [];
  const color = el.style?.color;
  if (color && COLOR_RE.test(color.trim())) out.push(`color:${color.trim()}`);
  const fs = el.style?.fontSize;
  if (fs && SIZE_RE.test(fs.trim())) out.push(`font-size:${fs.trim()}`);
  const fw = el.style?.fontWeight;
  if (fw && (fw === "bold" || fw === "700")) out.push("font-weight:bold");
  return out.join(";");
}

function cleanNode(node, doc) {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.nodeValue);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tag = node.tagName;

  // Convert legacy <font> to a sanitised <span>.
  if (tag === "FONT") {
    const span = doc.createElement("span");
    const styles = [];
    const color = node.getAttribute("color");
    if (color && COLOR_RE.test(color.trim())) styles.push(`color:${color.trim()}`);
    const size = node.getAttribute("size");
    if (size && FONT_SIZE_MAP[size]) styles.push(`font-size:${FONT_SIZE_MAP[size]}`);
    if (styles.length) span.setAttribute("style", styles.join(";"));
    for (const child of node.childNodes) {
      const c = cleanNode(child, doc);
      if (c) span.appendChild(c);
    }
    return span;
  }

  // Disallowed tag: unwrap — keep its children, drop the tag itself.
  if (!ALLOWED_TAGS.has(tag)) {
    const frag = doc.createDocumentFragment();
    for (const child of node.childNodes) {
      const c = cleanNode(child, doc);
      if (c) frag.appendChild(c);
    }
    return frag;
  }

  const el = doc.createElement(tag.toLowerCase());
  if (tag === "SPAN") {
    const s = safeStyle(node);
    if (s) el.setAttribute("style", s);
  }
  for (const child of node.childNodes) {
    const c = cleanNode(child, doc);
    if (c) el.appendChild(c);
  }
  return el;
}

export function sanitizeRichText(html) {
  if (!html || typeof html !== "string") return "";
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return "";
  }
  const out = doc.createElement("div");
  for (const child of doc.body.childNodes) {
    const c = cleanNode(child, doc);
    if (c) out.appendChild(c);
  }
  const result = out.innerHTML.trim();
  // Collapse the various "visually empty" shells browsers leave behind.
  if (result === "<br>" || result === "<p></p>" || result === "<div></div>" || result === "<p><br></p>") {
    return "";
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Read-only renderer                                                  */
/* ------------------------------------------------------------------ */

export function RichTextView({ html, className = "" }) {
  const clean = sanitizeRichText(html);
  if (!clean) return null;
  return (
    <div
      className={`rte-content ${className}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  ariaLabel,
  ariaLabelledby,
  className = "",
}) {
  const editorId = useId();
  const ref = useRef(null);
  const [boldActive, setBoldActive] = useState(false);

  // Sync external value in — but only when the DOM does not already
  // represent it (compared logically, so <font> vs <span> equivalents
  // don't reset the caret mid-typing).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const incoming = sanitizeRichText(value || "");
    if (sanitizeRichText(el.innerHTML) === incoming) return;
    el.innerHTML = incoming;
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    onChange?.(sanitizeRichText(el.innerHTML));
  }, [onChange]);

  const syncState = useCallback(() => {
    try {
      setBoldActive(document.queryCommandState("bold"));
    } catch {
      /* queryCommandState can throw when no selection — ignore. */
    }
  }, []);

  // aria-pressed must track the live selection, not just clicks.
  useEffect(() => {
    const handler = () => {
      const sel = document.getSelection();
      if (sel && ref.current && ref.current.contains(sel.anchorNode)) {
        syncState();
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [syncState]);

  const exec = (cmd, arg) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand("styleWithCSS", false, true);
    } catch {
      /* not supported everywhere — foreColor still works */
    }
    try {
      document.execCommand(cmd, false, arg);
    } catch {
      /* ignore unsupported command */
    }
    emit();
    syncState();
  };

  const labelProps = ariaLabelledby
    ? { "aria-labelledby": ariaLabelledby }
    : { "aria-label": ariaLabel || "Description" };

  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500 ${className}`}
    >
      <div
        role="toolbar"
        aria-label="Text formatting"
        aria-controls={editorId}
        className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-1.5 py-1"
      >
        <button
          type="button"
          aria-label="Bold"
          aria-pressed={boldActive}
          onClick={() => exec("bold")}
          className={`${iconBtn} ${
            boldActive
              ? "bg-brand-100 text-brand-700"
              : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          aria-label="Bullet list"
          onClick={() => exec("insertUnorderedList")}
          className={`${iconBtn} text-slate-600 hover:bg-slate-200`}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          onClick={() => exec("insertOrderedList")}
          className={`${iconBtn} text-slate-600 hover:bg-slate-200`}
        >
          <ListOrdered size={15} />
        </button>

        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-slate-300" />

        <select
          aria-label="Font size"
          value=""
          onChange={(e) => {
            if (e.target.value) exec("fontSize", e.target.value);
          }}
          className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-[12px] font-semibold text-slate-600"
        >
          <option value="" disabled>
            Size
          </option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
        </select>

        <select
          aria-label="Text color"
          value=""
          onChange={(e) => {
            if (e.target.value) exec("foreColor", e.target.value);
          }}
          className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-[12px] font-semibold text-slate-600"
        >
          <option value="" disabled>
            Color
          </option>
          <option value="#0f172a">Default</option>
          <option value="#b91c1c">Red</option>
          <option value="#15803d">Green</option>
          <option value="#1d4ed8">Blue</option>
          <option value="#b45309">Amber</option>
        </select>
      </div>

      <div
        id={editorId}
        ref={ref}
        role="textbox"
        aria-multiline="true"
        {...labelProps}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onKeyUp={syncState}
        onMouseUp={syncState}
        data-placeholder={placeholder}
        className="rte-editable min-h-[96px] max-h-[260px] overflow-y-auto px-3 py-2.5 text-sm font-medium leading-relaxed text-slate-900 focus:outline-none"
      />
    </div>
  );
}
