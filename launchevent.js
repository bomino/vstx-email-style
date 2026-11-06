var VSTX_SIGNATURE_ID = "vstx-signature";
var VSTX_BAR_ID = "vstx-bar";
var VSTX_LIST_CLASS = "vstx-list";
var VSTX_TABLE_CLASS = "vstx-table";
var SIGNATURE_SETTINGS_KEY = "vstxSignature";
var FEATURES_SETTINGS_KEY = "vstxFeatures";
var FEATURE_DEFAULTS = {
  headings: true,
  callouts: true,
  figures: true,
  buttons: true,
  statuses: true,
  kpis: true,
  // Off by default: Outlook on the web draws its own mention chip over the tag when the email is read.
  mentions: false,
  agenda: true,
  shortReplies: true,
  attachmentCheck: true,
};
var OWN_MARKUP = /\bvstx-/;
var ASSET_BASE = "https://bomino.github.io/vstx-email-style/assets/";
var LOGO_URL = ASSET_BASE + "vstx-logo-v2.png";
var LOGO_WIDTH = 54;
var LOGO_HEIGHT = 70;
var HEXAGONS_URL = ASSET_BASE + "vstx-hexagons.png";
var HEXAGONS_WIDTH = 66;
var HEXAGONS_HEIGHT = 62;
var FONT_STACK = "Roboto,Arial,sans-serif";
var INK = "#231f20";
var GREY = "#58595b";
var LIGHT_GREY = "#a7a9ac";
var YELLOW = "#fdc00f";
var PANEL = "#f4f4f4";
var HAIRLINE = "#e6e7e8";
var BODY_SIZE = "15px";
var BODY_LINE_HEIGHT = "1.6";
var BODY_TEXT = "font-family:" + FONT_STACK + ";color:" + INK + ";font-size:" + BODY_SIZE + ";line-height:" + BODY_LINE_HEIGHT;
var BULLET_SIZE = 18;
var BULLET_COLUMN = 22;
var BADGE_SIZE = 22;
var BADGE_CSS =
  "width:" + BADGE_SIZE + "px;height:" + BADGE_SIZE + "px;background:" + YELLOW + ";font-family:" + FONT_STACK +
  ";font-size:12px;font-weight:900;color:" + INK + ";line-height:" + BADGE_SIZE + "px;text-align:center";
var NUMBERED_TEXT_CSS = BODY_TEXT + ";vertical-align:top;padding:0 0 8px";
var REVIEW_TAG = /\[review\]/i;
var PLAIN_TAG = /\[plain\]/i;
var CONTROL_TAGS = /\[(?:review|plain)\]/gi;
var TEXT_TAGS = /<(\/?)(table|p|li|div|span|font|td|th|h[1-6])\b([^>]*)>/gi;
var BLOCK_TAGS = /^(p|li|div)$/;
var HEADING_TAGS = /^h[1-6]$/;
var MONOSPACE = /consolas|courier|monaco|menlo|cascadia|lucida console|monospace/i;
var LIST_OPENER = /<(ul|ol)\b([^>]*)>/gi;
var LEADING_HEXAGONS = /^((?:\s|<(?:div|p|span)\b[^>]*>)*)(?:<span\b[^>]*>&#11042;<\/span>(?:&nbsp;|\s)*)+/i;
var STYLE_ATTR = /\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i;
var TABLE_CSS = "border-collapse:collapse;margin:8px 0 14px";
var HEADER_CELL_CSS =
  "background:" + INK + ";color:#ffffff;font-weight:700;padding:8px 12px;border:none;border-bottom:3px solid " + YELLOW + ";text-align:left;vertical-align:bottom";
var BODY_CELL_CSS = "padding:7px 12px;border:none;border-bottom:1px solid " + HAIRLINE + ";vertical-align:top";
// Everything from the first match onwards is left untouched: quoted replies, forwards and a Teams joining block.
var QUOTE_MARKERS = [
  /<div[^>]*\bid=["']?appendonsend\b/i,
  /<div[^>]*\bid=["']?divRplyFwdMsg\b/i,
  /<div[^>]*border-top:\s*solid\s+#E1E1E1/i,
  /<hr\b[^>]*>/i,
  /<div[^>]*>\s*<span[^>]*>\s*_{20,}/i,
  /<div[^>]*\bclass=["']?[^"'>]*\bme-email-/i,
];

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findQuoteStart(html) {
  var start = -1;
  QUOTE_MARKERS.forEach(function (marker) {
    var match = marker.exec(html);
    if (match && (start === -1 || match.index < start)) start = match.index;
  });
  if (start !== -1) return start;
  var bodyEnd = html.search(/<\/body>/i);
  return bodyEnd === -1 ? html.length : bodyEnd;
}

// ---- Inline style helpers ----

function readStyle(attrs) {
  var match = STYLE_ATTR.exec(attrs || "");
  if (!match) return "";
  return (match[2] !== undefined ? match[2] : match[3]).replace(/&quot;/g, "'");
}

function parseDeclarations(style) {
  return style
    .split(";")
    .map(function (part) {
      var colon = part.indexOf(":");
      return colon === -1 ? null : [part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim()];
    })
    .filter(function (declaration) {
      return declaration && declaration[0];
    });
}

function valueOf(declarations, property) {
  for (var i = declarations.length - 1; i >= 0; i--) {
    if (declarations[i][0] === property) return declarations[i][1];
  }
  return "";
}

function comparable(value) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function withStyle(name, attrs, declarations, overrides) {
  var replaced = {};
  overrides.forEach(function (override) {
    replaced[override[0]] = true;
  });
  var style = declarations
    .filter(function (declaration) {
      return !replaced[declaration[0]];
    })
    .concat(overrides)
    .map(function (declaration) {
      return declaration[0] + ":" + declaration[1];
    })
    .join(";");
  var otherAttrs = (attrs || "").replace(STYLE_ATTR, "").replace(/\s{2,}/g, " ").replace(/\s+$/, "");
  return "<" + name + otherAttrs + ' style="' + style + '">';
}

function mergeStyle(tag, name, attrs, css) {
  if (/WordSection/i.test(attrs || "")) return tag;
  return withStyle(name, attrs, parseDeclarations(readStyle(attrs)), parseDeclarations(css));
}

// ---- Text: restyle only the default look, keep deliberate formatting ----

function scanTextTags(html, visit) {
  var tables = [];
  var foreignTables = 0;
  var codeContext = [];
  return html.replace(TEXT_TAGS, function (tag, closing, name, attrs) {
    name = name.toLowerCase();
    if (name === "table") {
      if (closing) {
        if (tables.pop()) foreignTables--;
      } else {
        var foreign = attrs.indexOf(VSTX_LIST_CLASS) === -1 && attrs.indexOf(VSTX_TABLE_CLASS) === -1;
        tables.push(foreign);
        if (foreign) foreignTables++;
      }
      return tag;
    }
    if (closing) {
      codeContext.pop();
      return tag;
    }
    var inCode = MONOSPACE.test(attrs) || codeContext[codeContext.length - 1] === true;
    codeContext.push(inCode);
    if (/WordSection/i.test(attrs) || OWN_MARKUP.test(attrs)) return tag;
    return visit(tag, name, attrs, foreignTables > 0, inCode);
  });
}

// The look Outlook applies to plain typed text lives on block elements; anything else on a span is deliberate.
function defaultLook(html) {
  var look = { color: {}, size: {} };
  look.color[comparable(INK)] = true;
  look.size[BODY_SIZE] = true;
  scanTextTags(html, function (tag, name, attrs, inForeignTable, inCode) {
    if (inForeignTable || !BLOCK_TAGS.test(name)) return tag;
    var declarations = parseDeclarations(readStyle(attrs));
    var color = valueOf(declarations, "color");
    var size = valueOf(declarations, "font-size");
    if (color) look.color[comparable(color)] = true;
    if (size && !inCode) look.size[comparable(size)] = true;
    return tag;
  });
  return look;
}

// Code keeps its font and size, but Outlook's default colour still becomes brand ink.
function brandText(html) {
  var look = defaultLook(html);
  return scanTextTags(html, function (tag, name, attrs, inForeignTable, inCode) {
    var declarations = parseDeclarations(readStyle(attrs));
    var overrides = inCode ? [] : [["font-family", FONT_STACK]];
    if (!inForeignTable) {
      var isBlock = BLOCK_TAGS.test(name);
      var color = comparable(valueOf(declarations, "color"));
      var size = comparable(valueOf(declarations, "font-size"));
      if (color ? look.color[color] : isBlock) overrides.push(["color", INK]);
      if (!inCode && !HEADING_TAGS.test(name)) {
        if (size ? look.size[size] : isBlock) overrides.push(["font-size", BODY_SIZE]);
        if (isBlock) overrides.push(["line-height", BODY_LINE_HEIGHT]);
      }
    }
    return overrides.length ? withStyle(name, attrs, declarations, overrides) : tag;
  });
}

// ---- Smart formatting: simple typing patterns become designed elements ----

var CALLOUTS = {
  action: { label: "Action", strong: true },
  actions: { label: "Actions", strong: true },
  ask: { label: "Ask", strong: true },
  decision: { label: "Decision", strong: true },
  deadline: { label: "Deadline", strong: true },
  important: { label: "Important", strong: true },
  risk: { label: "Risk", strong: true },
  note: { label: "Note", strong: false },
  fyi: { label: "FYI", strong: false },
  reminder: { label: "Reminder", strong: false },
  "next step": { label: "Next step", strong: false },
  "next steps": { label: "Next steps", strong: false },
};
// Fits the longest label ("Next steps") so every callout's text starts at the same edge.
var CALLOUT_LABEL_WIDTH = 92;
var CALLOUT_LINE =/^(actions?|ask|decision|deadline|important|risk|note|fyi|reminder|next steps?)\s*:\s*\S/i;
var STATUS_COLORS = {
  "on track": "#2e7d32",
  done: "#2e7d32",
  complete: "#2e7d32",
  completed: "#2e7d32",
  "at risk": "#e07b00",
  "in progress": "#e07b00",
  "off track": "#c62828",
  blocked: "#c62828",
  "not started": LIGHT_GREY,
};
var STATUS_TAG = /\[(on track|done|completed?|at risk|in progress|off track|blocked|not started)\]/gi;
// Money, percentages and big numbers; a range ("$14–16", "$14–$16", "10–20%") counts as one figure.
var FIGURE_NUMBER = "\\d+(?:,\\d{3})*(?:\\.\\d+)?";
var FIGURE_AMOUNT = "[$€£]\\s?" + FIGURE_NUMBER + "(?:\\s?(?:K|M|B|bn|million|billion)\\b)?";
var FIGURE_RANGE = "\\s?[–-]\\s?";
var KEY_FIGURE = new RegExp(
  "(?<![\\w$€£.,])(?:[+\\-−]\\s?)?(?:" +
    FIGURE_AMOUNT + "(?:" + FIGURE_RANGE + "(?:" + FIGURE_AMOUNT + "|" + FIGURE_NUMBER + "(?:\\s?(?:K|M|B|bn)\\b)?))?" +
    "|" + FIGURE_NUMBER + "(?:" + FIGURE_RANGE + FIGURE_NUMBER + ")?\\s?%" +
    "|" + FIGURE_NUMBER + "(?:(?:K|M|B|bn)\\b|\\s(?:million|billion)\\b))",
  "g"
);
var FIGURE_LIMIT = 8;
// Brand yellow #fdc00f at about a quarter strength, so ink text stays easy to read on it.
var FIGURE_HIGHLIGHT = "#fff0c2";
var INNERMOST_BLOCK = /<(div|p)\b([^>]*)>((?:(?!<\/?(?:div|p)\b)[\s\S])*?)<\/\1>/gi;
var BOLD_RUN = /<(b|strong)\b[^>]*>[\s\S]*?<\/\1>|<span\b[^>]*font-weight\s*:\s*(?:bold|[6-9]00)[^>]*>[\s\S]*?<\/span>/gi;
var BOLD_STYLE = /font-weight\s*:\s*(?:bold|[6-9]00)/i;
var NOT_HEADINGS = /^(hi|hello|hey|dear|thanks|thank you|regards|best|best regards|kind regards|cheers|sincerely)\b/i;
var LONE_LINK = /^((?:\s|&nbsp;|<(?!a\b)[^>]+>)*)<a\b([^>]*)>([\s\S]*?)<\/a>((?:\s|&nbsp;|<(?!a\b)[^>]+>)*)$/i;
var COMPONENT_MARKUP = /\bvstx-(?:figure|status|heading|callout-label|button|bar|signature|kpi)/;
var KPI_LINE = /^kpis?\s*:\s*\S/i;
var KPI_LABEL = /^kpis?\s*:\s*/i;
// Three tiles is the most a phone screen fits without scrolling sideways.
var KPI_PER_ROW = 3;
var AGENDA_TIME_WIDTH = 110;
var KPI_GAP = 2;
var NUMBER_BODY =
  "(?:[$€£]\\s?)?\\d[\\d,]*(?:\\.\\d+)?" +
  "(?:%|\\s?(?:pts|pp|bps|bn|[kmbx])\\b|\\s(?:million|billion|days?|hrs?|hours?|wks?|weeks?|months?|mins?|minutes?|yrs?|years?)\\b)?";
var KPI_VALUE = new RegExp("(?<![\\w.$€£])(?:[+\\-−]\\s?)?" + NUMBER_BODY, "i");
var KPI_CHANGE = new RegExp("(?<![\\w.$€£])[+\\-−]\\s?" + NUMBER_BODY, "i");
var VOID_TAGS = /^(br|img|hr|meta|link|input|col|wbr|area|base|source)$/i;

function roamingValue(key) {
  var roaming = typeof Office !== "undefined" && Office.context && Office.context.roamingSettings;
  var value = roaming ? roaming.get(key) : null;
  return value && typeof value === "object" ? value : {};
}

function featureSettings() {
  var saved = roamingValue(FEATURES_SETTINGS_KEY);
  var features = {};
  Object.keys(FEATURE_DEFAULTS).forEach(function (key) {
    features[key] = typeof saved[key] === "boolean" ? saved[key] : FEATURE_DEFAULTS[key];
  });
  return features;
}

function plainText(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function insideStructure(html, offset) {
  var tags = /<(\/?)(ul|ol|table)\b/gi;
  var depth = 0;
  var match;
  while ((match = tags.exec(html)) && match.index < offset) depth += match[1] ? -1 : 1;
  return depth > 0;
}

// Classic Outlook (Word) gives an empty cell a full line of height unless its font size and line height match the cell.
function ruleCell(height, color, attrs) {
  var fill = color ? ' bgcolor="' + color + '"' : "";
  return (
    "<td" + attrs + ' height="' + height + '"' + fill +
    ' style="height:' + height + "px;" + (color ? "background:" + color + ";" : "") +
    "font-size:" + height + "px;line-height:" + height + 'px;mso-line-height-rule:exactly">&nbsp;</td>'
  );
}

function yellowRule(width, height) {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>' +
    ruleCell(height, YELLOW, ' width="' + width + '"').replace('style="', 'style="width:' + width + "px;") +
    "</tr></table>"
  );
}

// Classic Outlook ignores margins on tables, so components are spaced by a wrapper it does respect.
function spaced(margin, html) {
  return '<div class="vstx-space" style="margin:' + margin + '">' + html + "</div>";
}

// A short line that is entirely bold, on its own, reads as a section heading.
function asHeading(attrs, inner, text) {
  if (text.length < 2 || text.length > 70 || /[.!?,;]$/.test(text) || NOT_HEADINGS.test(text) || !/[a-z]/i.test(text)) return null;
  if (/<br\b/i.test(inner.replace(/(?:\s|<br\b[^>]*>)+$/i, ""))) return null;
  var wholeBlockBold = BOLD_STYLE.test(attrs);
  if (!wholeBlockBold && (inner.search(BOLD_RUN) === -1 || plainText(inner.replace(BOLD_RUN, "")))) return null;
  return (
    '<div class="vstx-heading" style="margin:12px 0 6px">' + yellowRule(24, 3) +
    '<div class="vstx-heading-text" style="font-family:' + FONT_STACK + ";font-size:17px;font-weight:900;line-height:1.3;color:" + INK + ';margin-top:7px">' +
    escapeHtml(text.replace(/\s*:\s*$/, "")) + "</div></div>"
  );
}

// "Action: …", "Decision: …", "Deadline: …" and similar become a labelled row.
function asCallout(inner, text) {
  var match = CALLOUT_LINE.exec(text);
  if (!match) return null;
  var keyword = match[1];
  var spec = CALLOUTS[keyword.toLowerCase().replace(/\s+/g, " ")];
  var label = new RegExp("^((?:\\s|<[^>]+>)*)" + keyword.split(/\s+/).join("(?:\\s|&nbsp;)+") + "\\s*:\\s*", "i");
  var body = inner.replace(label, "$1");
  if (!spec || body === inner) return null;
  var labelFill = spec.strong ? INK : GREY;
  // Classic Outlook merges neighbouring tables, so the gap between callouts is a row inside each one.
  return (
    '<table class="vstx-callout" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
    "<tr>" + ruleCell(8, "", ' colspan="2"') + "</tr><tr>" +
    '<td class="vstx-callout-label" width="' + CALLOUT_LABEL_WIDTH + '" bgcolor="' + labelFill + '" style="width:' + CALLOUT_LABEL_WIDTH + "px;background:" + labelFill + ";padding:9px 12px;vertical-align:top;white-space:nowrap" +
    ";border-left:4px solid " + (spec.strong ? YELLOW : labelFill) + '">' +
    '<span style="font-family:' + FONT_STACK + ';font-size:11px;font-weight:900;letter-spacing:.08em;color:#ffffff">' + spec.label.toUpperCase() + "</span></td>" +
    '<td bgcolor="' + PANEL + '" style="background:' + PANEL + ';padding:9px 14px;vertical-align:top">' +
    '<div class="vstx-callout-text" style="' + BODY_TEXT + '">' + body + "</div></td>" +
    "</tr></table>"
  );
}

// "Spend $4.1M -8% vs plan [On track]" -> label "Spend", value "$4.1M", change "-8%", note "vs plan", status "on track".
function parseKpi(segment) {
  var status = null;
  var rest = segment.replace(STATUS_TAG, function (_tag, found) {
    status = status || found;
    return " ";
  });
  var value = KPI_VALUE.exec(rest);
  if (!value) return { label: "", value: rest.trim(), change: null, note: "", status: status, numeric: false };
  var label = rest.slice(0, value.index);
  var after = rest.slice(value.index + value[0].length);
  var change = KPI_CHANGE.exec(after);
  var note = change ? after.slice(0, change.index) + " " + after.slice(change.index + change[0].length) : after;
  var tidy = function (text) {
    return text.replace(/[()]/g, " ").replace(/\s+/g, " ").replace(/^[\s:,–—-]+|[\s:,–—-]+$/g, "");
  };
  label = tidy(label);
  note = tidy(note);
  if (!label && note) {
    label = note;
    note = "";
  }
  return { label: label, value: value[0].trim(), change: change ? change[0] : null, note: note, status: status, numeric: true };
}

function kpiTile(kpi, width) {
  var text = "font-family:" + FONT_STACK + ";";
  var lines = [];
  if (kpi.label) {
    lines.push(
      '<div class="vstx-kpi-label" style="' + text + "font-size:11px;font-weight:700;letter-spacing:.06em;color:" + GREY + ';line-height:1.35">' +
        escapeHtml(kpi.label.toUpperCase()) + "</div>"
    );
  }
  lines.push(
    '<div class="vstx-kpi-value" style="' + text + "font-size:" + (kpi.numeric ? "24px" : "16px") + ";font-weight:900;color:" + INK + ';line-height:1.2;padding-top:4px">' +
      escapeHtml(kpi.value) + "</div>"
  );
  if (kpi.change || kpi.note) {
    var change = "";
    if (kpi.change) {
      var falling = /^[\-−]/.test(kpi.change);
      change =
        "<span style=\"font-family:'Segoe UI Symbol',Arial,sans-serif;font-size:10px;color:" + INK + '">' + (falling ? "&#9660;" : "&#9650;") + "</span>&nbsp;" +
        '<span style="' + text + "font-weight:700;color:" + INK + '">' + escapeHtml(kpi.change.replace(/^[+\-−]\s?/, "")) + "</span>";
    }
    var note = kpi.note ? '<span style="' + text + "color:" + GREY + '">' + (change ? "&nbsp;" : "") + escapeHtml(kpi.note) + "</span>" : "";
    lines.push('<div class="vstx-kpi-change" style="' + text + "font-size:13px;color:" + INK + ';line-height:1.4;padding-top:2px">' + change + note + "</div>");
  }
  if (kpi.status) lines.push('<div class="vstx-kpi-status" style="padding-top:6px">' + statusPill("", kpi.status) + "</div>");
  return (
    '<td class="vstx-kpi-tile" width="' + width + '%" bgcolor="' + PANEL + '" style="width:' + width + "%;background:" + PANEL +
    ";border-top:3px solid " + YELLOW + ';padding:10px 12px 12px;vertical-align:top">' + lines.join("") + "</td>"
  );
}

// "KPI: Revenue $1.2M +6% | Margin 18%" becomes a row of tiles. Arrows show direction only: whether a change
// is good depends on the metric (spend down is good news), so colour comes only from a status tag you add.
function asKpiRow(text) {
  if (!KPI_LINE.test(text)) return null;
  var kpis = text
    .replace(KPI_LABEL, "")
    .split("|")
    .map(function (segment) {
      return segment.trim();
    })
    .filter(Boolean)
    .map(parseKpi);
  if (!kpis.some(function (kpi) { return kpi.numeric; })) return null;
  var columns = Math.max(2, Math.min(kpis.length, KPI_PER_ROW));
  var width = Math.floor((100 - KPI_GAP * (columns - 1)) / columns);
  var gap = '<td class="vstx-kpi-gap" width="' + KPI_GAP + '%" style="width:' + KPI_GAP + '%;font-size:1px;line-height:1px">&nbsp;</td>';
  var rows = [];
  for (var start = 0; start < kpis.length; start += columns) {
    var cells = kpis.slice(start, start + columns).map(function (kpi) {
      return kpiTile(kpi, width);
    });
    while (cells.length < columns) cells.push('<td class="vstx-kpi-gap" width="' + width + '%">&nbsp;</td>');
    rows.push("<tr>" + ruleCell(8, "", ' colspan="' + (columns * 2 - 1) + '"') + "</tr><tr>" + cells.join(gap) + "</tr>");
  }
  return (
    '<table class="vstx-kpi" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
    rows.join("") +
    "<tr>" + ruleCell(6, "", ' colspan="' + (columns * 2 - 1) + '"') + "</tr></table>"
  );
}

function hostOf(href) {
  var match = /^https?:\/\/([^\/?#:]+)/i.exec(href);
  return match ? match[1].toLowerCase().replace(/^www\./, "") : "";
}

function smartLinkLabel(href, host) {
  if (/(^|\.)powerbi\.com$/.test(host)) return "Open Power BI report";
  if (/(^|\.)sharepoint\.com$/.test(host)) {
    if (/\/:x:\//i.test(href)) return "Open the Excel workbook";
    if (/\/:w:\//i.test(href)) return "Open the Word document";
    if (/\/:p:\//i.test(href)) return "Open the presentation";
    if (/\/:b:\//i.test(href)) return "Open the PDF";
    if (/\/:f:\//i.test(href)) return "Open the folder";
    return "Open in SharePoint";
  }
  if (/(^|\.)teams\.(microsoft|live)\.com$/.test(host)) return "Open in Teams";
  if (/^forms\.(office|microsoft)\.com$/.test(host)) return "Open the form";
  if (/(^|\.)github\.com$/.test(host)) return "View on GitHub";
  return "Open link";
}

// A link alone on its own line becomes a button, with the website shown underneath so people know where it goes.
function asButton(inner) {
  var match = LONE_LINK.exec(inner);
  if (!match) return null;
  var hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(match[2]);
  var href = hrefMatch ? hrefMatch[1] || hrefMatch[2] : "";
  var linkText = plainText(match[3]);
  if (!/^https?:\/\//i.test(href) || !linkText) return null;
  var host = hostOf(href);
  var label = /^(https?:\/\/|www\.)/i.test(linkText) ? smartLinkLabel(href, host) : linkText;
  var text = "font-family:" + FONT_STACK + ";";
  return spaced(
    "8px 0 14px",
    '<table class="vstx-button" role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>' +
      '<td bgcolor="' + INK + '" style="background:' + INK + ";border-bottom:3px solid " + YELLOW + ';padding:11px 20px">' +
      '<a href="' + href + '" style="' + text + 'font-size:14px;font-weight:700;color:#ffffff;text-decoration:none">' + escapeHtml(label) + "&nbsp;&#8594;</a>" +
      "</td></tr></table>" +
      '<div class="vstx-button-caption" style="' + text + "font-size:12px;color:" + GREY + ';margin:4px 0 0">' + escapeHtml(host) + "</div>"
  );
}

function smartBlocks(html, features) {
  return html.replace(INNERMOST_BLOCK, function (block, name, attrs, inner, offset, whole) {
    if (OWN_MARKUP.test(attrs) || insideStructure(whole, offset)) return block;
    var text = plainText(inner);
    if (!text) return block;
    return (
      (features.buttons && asButton(inner)) ||
      (features.kpis && asKpiRow(text)) ||
      (features.callouts && asCallout(inner, text)) ||
      (features.headings && asHeading(attrs, inner, text)) ||
      block
    );
  });
}

function isTextOffLimits(name, attrs, skipTables) {
  return (
    /^(a|head|style|script|title|code|pre)$/.test(name) ||
    (skipTables && name === "table") ||
    MONOSPACE.test(attrs) ||
    COMPONENT_MARKUP.test(attrs)
  );
}

// Applies transform to text between tags, skipping links, code, our own components and (optionally) tables.
function mapText(html, skipTables, transform) {
  var open = [];
  return html.replace(/(<[^>]+>)|([^<]+)/g, function (token, tag, text) {
    if (text !== undefined) {
      var skip = open.length > 0 && open[open.length - 1].skip;
      return skip ? text : transform(text);
    }
    var parts = /^<(\/?)([a-z][a-z0-9]*)\b([^>]*)>$/i.exec(tag);
    if (!parts) return tag;
    var name = parts[2].toLowerCase();
    if (parts[1]) {
      for (var i = open.length - 1; i >= 0; i--) {
        if (open[i].name === name) {
          open.length = i;
          break;
        }
      }
      return tag;
    }
    if (VOID_TAGS.test(name) || /\/>$/.test(tag)) return tag;
    var parentSkips = open.length > 0 && open[open.length - 1].skip;
    open.push({ name: name, skip: parentSkips || isTextOffLimits(name, parts[3], skipTables) });
    return tag;
  });
}

function statusPill(_tag, status) {
  var key = status.toLowerCase();
  var label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    '<span class="vstx-status" style="display:inline-block;padding:1px 8px 1px 6px;background:' + PANEL + ";border:1px solid #d3d2d2;border-radius:2px;" +
    "font-family:" + FONT_STACK + ";font-size:12px;font-weight:700;line-height:1.5;color:" + INK + ';white-space:nowrap">' +
    '<span style="color:' + STATUS_COLORS[key] + ";font-family:'Segoe UI Symbol',Arial,sans-serif\">&#11042;</span>&nbsp;" + label + "</span>"
  );
}

function markStatuses(html) {
  return mapText(html, false, function (text) {
    return text.replace(STATUS_TAG, statusPill);
  });
}

// Key figures get a light yellow highlight; an email full of figures gets bold only, so the yellow never takes over.
// A background, not an underline: Outlook on the web strips borders from inline text when the email is read.
function markKeyFigures(html) {
  var count = 0;
  mapText(html, true, function (text) {
    count += (text.match(KEY_FIGURE) || []).length;
    return text;
  });
  var style = count > FIGURE_LIMIT ? "font-weight:700" : "font-weight:700;background:" + FIGURE_HIGHLIGHT + ";padding:0 2px";
  return mapText(html, true, function (text) {
    return text.replace(KEY_FIGURE, function (figure) {
      return '<span class="vstx-figure" style="' + style + '">' + figure + "</span>";
    });
  });
}

// ---- @mentions ----
// Outlook's mention is a mailto link whose id (OWAAM…) and address drive the "you were mentioned" notice,
// so the link itself is never changed: only its look, plus a styled wrapper around the name.
var MENTION_LINK = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
var MAILTO_HREF = /\bhref\s*=\s*["']?mailto:/i;
var OUTLOOK_MENTION_ID = /\bid\s*=\s*["']?(?:x_)?OWAAM/i;

function markMentions(html) {
  return html.replace(MENTION_LINK, function (link, attrs, inner) {
    if (!MAILTO_HREF.test(attrs) || /vstx-mention/.test(inner)) return link;
    if (!OUTLOOK_MENTION_ID.test(attrs) && plainText(inner).charAt(0) !== "@") return link;
    var opening = mergeStyle("<a" + attrs + ">", "a", attrs, "color:" + INK + ";text-decoration:none");
    return (
      opening +
      '<span class="vstx-mention" style="font-family:' + FONT_STACK + ";font-weight:700;color:" + INK + ";background:" + PANEL +
      ";border-bottom:2px solid " + YELLOW + ';padding:0 4px;white-space:nowrap">' + inner + "</span></a>"
    );
  });
}

// ---- Timed agenda ----
// Colon times only: "1.50 per unit" on two lines must not become an agenda.
var CLOCK = "\\d{1,2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?)?";
var AGENDA_LINE = new RegExp("^(" + CLOCK + ")(?:\\s*(?:-|–|—|to)\\s*(" + CLOCK + "))?(?=[\\s\\-–—:|•·])\\s*(?:[-–—:|•·]\\s*)?(\\S[\\s\\S]*)$", "i");
var AGENDA_PREFIX = new RegExp("^((?:\\s|<[^>]+>)*)" + CLOCK + "(?:\\s*(?:-|–|—|to)\\s*" + CLOCK + ")?\\s*(?:[-–—:|•·]\\s*)?", "i");

// "9:30", "9:30am", "2pm" -> minutes after midnight; a bare "9" isn't a time.
function clockMinutes(text) {
  var match = /^(\d{1,2})(?::(\d{2}))?\s*([ap])?/i.exec(text.trim());
  if (!match || (!match[2] && !match[3])) return null;
  var hour = parseInt(match[1], 10);
  var minute = match[2] ? parseInt(match[2], 10) : 0;
  if (hour > 23 || minute > 59 || (match[3] && hour > 12)) return null;
  if (match[3]) hour = (hour % 12) + (match[3].toLowerCase() === "p" ? 12 : 0);
  return hour * 60 + minute;
}

function agendaEntry(inner) {
  var parts = AGENDA_LINE.exec(plainText(inner));
  if (!parts) return null;
  var start = clockMinutes(parts[1]);
  var end = parts[2] ? clockMinutes(parts[2]) : null;
  if (start === null || (parts[2] && end === null)) return null;
  var item = inner.replace(AGENDA_PREFIX, "$1");
  if (item === inner || !plainText(item)) return null;
  var length = end !== null && end > start && end - start <= 720 ? end - start : null;
  return { from: parts[1].trim(), to: parts[2] ? parts[2].trim() : "", length: length, item: item };
}

function formatLength(minutes) {
  var hours = Math.floor(minutes / 60);
  var rest = minutes % 60;
  return (hours ? hours + " h" : "") + (hours && rest ? " " : "") + (rest ? rest + " min" : "");
}

function agendaTable(entries) {
  var text = "font-family:" + FONT_STACK + ";";
  var rows = entries.map(function (entry) {
    var clock = escapeHtml(entry.from) + (entry.to ? "&#8211;" + escapeHtml(entry.to) : "");
    var length = entry.length
      ? '<div class="vstx-agenda-length" style="' + text + "font-size:12px;color:" + GREY + ';line-height:1.4">' + formatLength(entry.length) + "</div>"
      : "";
    return (
      "<tr>" +
      '<td class="vstx-agenda-time" width="' + AGENDA_TIME_WIDTH + '" bgcolor="' + PANEL + '" style="width:' + AGENDA_TIME_WIDTH + "px;background:" + PANEL +
      ";border-left:3px solid " + YELLOW + ";border-bottom:2px solid #ffffff;padding:8px 12px;vertical-align:top;white-space:nowrap\">" +
      '<div class="vstx-agenda-clock" style="' + text + "font-size:14px;font-weight:700;color:" + INK + ';line-height:1.4">' + clock + "</div>" + length + "</td>" +
      '<td style="padding:8px 14px;vertical-align:top;border-bottom:1px solid ' + HAIRLINE + '">' +
      '<div class="vstx-agenda-text" style="' + BODY_TEXT + '">' + entry.item + "</div></td>" +
      "</tr>"
    );
  });
  return (
    '<table class="vstx-agenda" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
    "<tr>" + ruleCell(8, "", ' colspan="2"') + "</tr>" + rows.join("") + "<tr>" + ruleCell(6, "", ' colspan="2"') + "</tr></table>"
  );
}

// Two or more lines in a row that start with a time become an agenda; a single "10:00 call" stays a sentence.
function withAgenda(html) {
  var blocks = new RegExp(INNERMOST_BLOCK.source, "gi");
  var runs = [];
  var run = [];
  var match;
  var closeRun = function () {
    if (run.length >= 2) runs.push(run);
    run = [];
  };
  while ((match = blocks.exec(html))) {
    var entry = OWN_MARKUP.test(match[2]) || insideStructure(html, match.index) ? null : agendaEntry(match[3]);
    var adjacent = run.length && !html.slice(run[run.length - 1].end, match.index).trim();
    if (!entry || !adjacent) closeRun();
    if (entry) run.push({ start: match.index, end: blocks.lastIndex, entry: entry });
  }
  closeRun();
  for (var i = runs.length - 1; i >= 0; i--) {
    var first = runs[i][0];
    var last = runs[i][runs[i].length - 1];
    html = html.slice(0, first.start) + agendaTable(runs[i].map(function (line) { return line.entry; })) + html.slice(last.end);
  }
  return html;
}

function smartFormat(html) {
  var features = featureSettings();
  var result = features.agenda ? withAgenda(html) : html;
  result = smartBlocks(result, features);
  if (features.mentions) result = markMentions(result);
  if (features.statuses) result = markStatuses(result);
  if (features.figures) result = markKeyFigures(result);
  return result;
}

// ---- Lists ----
// Lists become small tables: classic Outlook (Word) draws its own "•" on every <li>, whatever the CSS says.

function hexagonCell(color) {
  return (
    '<td width="' + BULLET_COLUMN + '" style="width:' + BULLET_COLUMN + "px;vertical-align:top;padding:0;" +
    "font-size:" + BULLET_SIZE + "px;line-height:24px;mso-line-height-rule:exactly\">" +
    '<span style="color:' + color + ";font-size:" + BULLET_SIZE + "px;line-height:24px;font-family:'Segoe UI Symbol',Arial,sans-serif\">&#11042;</span></td>"
  );
}

function numberBadge(number) {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>' +
    '<td width="' + BADGE_SIZE + '" height="' + BADGE_SIZE + '" align="center" bgcolor="' + YELLOW + '" style="' + BADGE_CSS + '">' +
    '<span style="font-family:' + FONT_STACK + ";font-size:12px;font-weight:900;color:" + INK + '">' + number + "</span></td>" +
    "</tr></table>"
  );
}

function endOfList(html, from) {
  var tags = /<(\/?)(?:ul|ol)\b[^>]*>/gi;
  tags.lastIndex = from;
  var depth = 1;
  var match;
  while ((match = tags.exec(html))) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return { innerEnd: match.index, end: tags.lastIndex };
  }
  return null;
}

// Outlook places a sub-list between items (<ol><li>..</li><ul>..</ul><li>..</li></ol>), not inside one,
// so a sub-list found between items is attached to the item above it. Pasted lists can also carry text
// that isn't in any item (a line as a <div>, bare text, an unclosed <li>); that is kept with the item above.
function topLevelItems(inner) {
  var tags = /<(\/?)(ul|ol|li)\b[^>]*>/gi;
  var items = [];
  var leading = "";
  var depth = 0;
  var itemStart = -1;
  var subListStart = -1;
  var cursor = 0;
  var match;
  var attach = function (piece) {
    if (items.length) items[items.length - 1] += piece;
    else leading += piece;
  };
  var keepStray = function (to) {
    var stray = inner.slice(cursor, to);
    if (plainText(stray) || /<img\b/i.test(stray)) attach(stray);
  };
  var closeItem = function (at) {
    items.push((items.length ? "" : leading) + inner.slice(itemStart, at));
    itemStart = -1;
  };
  while ((match = tags.exec(inner))) {
    var closing = match[1] === "/";
    var isItem = match[2].toLowerCase() === "li";
    if (depth === 0 && itemStart === -1 && !closing) keepStray(match.index);
    if (!isItem) {
      if (!closing && depth === 0 && itemStart === -1) subListStart = match.index;
      depth += closing ? -1 : 1;
      if (closing && depth === 0 && subListStart !== -1) {
        attach(inner.slice(subListStart, tags.lastIndex));
        subListStart = -1;
        cursor = tags.lastIndex;
      }
    } else if (depth === 0 && !closing) {
      if (itemStart !== -1) closeItem(match.index);
      itemStart = tags.lastIndex;
    } else if (depth === 0 && itemStart !== -1) {
      closeItem(match.index);
      cursor = tags.lastIndex;
    }
  }
  if (itemStart !== -1) {
    closeItem(inner.length);
  } else {
    keepStray(inner.length);
  }
  return items;
}

// A list holding only other lists, with no item of its own: what Outlook makes of bullets indented twice.
function isParentlessList(inner) {
  if (topLevelItems(inner).length || !/<(?:ul|ol)\b/i.test(inner)) return false;
  return !plainText(withoutLists(inner));
}

function withoutLists(html) {
  return splitTopLevelLists(html)
    .map(function (part) {
      return part.inner === undefined ? part.text : "";
    })
    .join("");
}

function splitTopLevelLists(html) {
  var openers = new RegExp(LIST_OPENER.source, "gi");
  var parts = [];
  var cursor = 0;
  var open;
  while ((open = openers.exec(html))) {
    var close = endOfList(html, openers.lastIndex);
    if (!close) break;
    parts.push({ text: html.slice(cursor, open.index) });
    parts.push({ open: html.slice(open.index, openers.lastIndex), inner: html.slice(openers.lastIndex, close.innerEnd), close: html.slice(close.innerEnd, close.end) });
    cursor = close.end;
    openers.lastIndex = close.end;
  }
  parts.push({ text: html.slice(cursor) });
  return parts;
}

// Pasted sub-points often arrive as a parentless list right after the list they belong to (with only
// empty wrappers in between); they are moved into that list so they sit under its last item.
var ONLY_WRAPPERS = /^(?:\s|&nbsp;|<\/?(?:div|p|span)\b[^>]*>|<br\s*\/?>)*$/i;

function attachParentlessLists(html) {
  var parts = splitTopLevelLists(html);
  var previous = null;
  parts.forEach(function (part) {
    if (part.inner === undefined) {
      if (!ONLY_WRAPPERS.test(part.text)) previous = null;
      return;
    }
    if (previous && isParentlessList(part.inner)) {
      previous.inner += part.inner;
      part.moved = true;
      return;
    }
    previous = part;
  });
  return parts
    .map(function (part) {
      if (part.inner === undefined) return part.text;
      return part.moved ? "" : part.open + part.inner + part.close;
    })
    .join("");
}

function listTable(rows, margin) {
  return spaced(
    margin,
    '<table class="' + VSTX_LIST_CLASS + '" role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
      rows.join("") +
      "</table>"
  );
}

function itemText(content, bulletDepth) {
  return '<div style="' + BODY_TEXT + '">' + withListTables(content.replace(LEADING_HEXAGONS, "$1"), true, bulletDepth) + "</div>";
}

function numberedTable(attrs, items) {
  var start = /\bstart=["']?(\d+)/i.exec(attrs);
  var number = start ? parseInt(start[1], 10) : 1;
  return listTable(
    items.map(function (content) {
      return (
        '<tr><td width="' + (BADGE_SIZE + 12) + '" style="width:' + BADGE_SIZE + 'px;vertical-align:top;padding:2px 12px 8px 0">' + numberBadge(number++) + "</td>" +
        '<td style="' + NUMBERED_TEXT_CSS + '">' + itemText(content, 0) + "</td></tr>"
      );
    }),
    "8px 0 12px"
  );
}

function bulletTable(items, bulletDepth, nested) {
  var color = bulletDepth > 0 ? LIGHT_GREY : GREY;
  return listTable(
    items.map(function (content) {
      return "<tr>" + hexagonCell(color) + '<td style="vertical-align:top;padding:0 0 4px 6px">' + itemText(content, bulletDepth + 1) + "</td></tr>";
    }),
    nested ? "2px 0 4px" : "6px 0 10px"
  );
}

// Only a top-level numbered list keeps its numbers; every sub-list, numbered or not, gets hexagon bullets.
function withListTables(html, nested, bulletDepth) {
  var openers = new RegExp(LIST_OPENER.source, "gi");
  var output = "";
  var cursor = 0;
  var open;
  while ((open = openers.exec(html))) {
    var close = endOfList(html, openers.lastIndex);
    if (!close) break;
    var inner = html.slice(openers.lastIndex, close.innerEnd);
    var items = topLevelItems(inner);
    var numbered = open[1].toLowerCase() === "ol" && !nested;
    var table;
    if (items.length) table = numbered ? numberedTable(open[2], items) : bulletTable(items, bulletDepth || 0, nested);
    else table = isParentlessList(inner) ? withListTables(inner, nested, bulletDepth) : html.slice(open.index, close.end);
    output += html.slice(cursor, open.index) + table;
    cursor = close.end;
    openers.lastIndex = close.end;
  }
  return output + html.slice(cursor);
}

// ---- Tables ----

function endOfTable(html, from) {
  var tags = /<(\/?)table\b[^>]*>/gi;
  tags.lastIndex = from;
  var depth = 1;
  var match;
  while ((match = tags.exec(html))) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  return -1;
}

function eachTopLevelTable(html, transform) {
  var openers = /<table\b([^>]*)>/gi;
  var output = "";
  var cursor = 0;
  var open;
  while ((open = openers.exec(html))) {
    var end = endOfTable(html, openers.lastIndex);
    if (end === -1) break;
    output += html.slice(cursor, open.index) + transform(html.slice(open.index, end), open[1]);
    cursor = end;
    openers.lastIndex = end;
  }
  return output + html.slice(cursor);
}

function isOwnTable(attrs) {
  return OWN_MARKUP.test(attrs);
}

function withClass(openingTag, className) {
  if (/\bclass\s*=\s*"/i.test(openingTag)) return openingTag.replace(/\bclass\s*=\s*"/i, 'class="' + className + " ");
  return openingTag.replace(/^<table/i, '<table class="' + className + '"');
}

function withBgcolor(tag, color) {
  return tag.replace(/\sbgcolor\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, "").replace(/>$/, ' bgcolor="' + color + '">');
}

// A table without colours of its own was inserted in Outlook; pasted Excel or Power BI tables keep their look.
function markInsertedTables(html) {
  return eachTopLevelTable(html, function (table, attrs) {
    if (isOwnTable(attrs)) return table;
    var openingEnd = table.indexOf(">") + 1;
    var pasted = /background|bgcolor|mso-|class=["']?xl/i.test(table);
    if (pasted || /<table\b/i.test(table.slice(openingEnd))) return table;
    return withClass(table.slice(0, openingEnd), VSTX_TABLE_CLASS) + table.slice(openingEnd);
  });
}

function brandTables(html) {
  return eachTopLevelTable(html, function (table, attrs) {
    if (attrs.indexOf(VSTX_TABLE_CLASS) === -1) return table;
    var openingEnd = table.indexOf(">") + 1;
    var row = 0;
    var rows = table.slice(openingEnd).replace(/(<tr\b[^>]*>)([\s\S]*?)(<\/tr>)/gi, function (_row, open, cells, close) {
      var header = row === 0;
      var fill = header ? INK : row % 2 === 0 ? PANEL : "#ffffff";
      var css = header ? HEADER_CELL_CSS : BODY_CELL_CSS + ";background:" + fill;
      row++;
      var styled = cells.replace(/<(td|th)\b([^>]*)>/gi, function (tag, name, cellAttrs) {
        return withBgcolor(mergeStyle(tag, name, cellAttrs, css), fill);
      });
      return open + (header ? styled.replace(/([;"'\s])color:#231f20/gi, "$1color:#ffffff") : styled) + close;
    });
    return mergeStyle(table.slice(0, openingEnd), "table", attrs, TABLE_CSS) + rows;
  });
}

function restyleOwnPart(html) {
  return withListTables(attachParentlessLists(brandTables(smartFormat(brandText(markInsertedTables(html))))), false, 0);
}

// ---- Safety net: styling may move and decorate words, never drop them ----
var STYLING_ONLY_WORDS = { kpi: true, kpis: true };

function ownWords(html) {
  var text = plainText(html.replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "))
    .toLowerCase()
    .replace(/&[#\w]+;/g, " ")
    .replace(/(?:https?:\/\/|www\.)\S+/g, " ");
  return text.split(/[^a-z0-9À-ɏ]+/).filter(function (word) {
    return word && !STYLING_ONLY_WORDS[word];
  });
}

function keepsWords(before, after) {
  var available = {};
  ownWords(after).forEach(function (word) {
    available[word] = (available[word] || 0) + 1;
  });
  return ownWords(before).every(function (word) {
    return available[word]-- > 0;
  });
}

// If full styling would lose any of the sender's words, fall back to fonts and colours only;
// if even that would, the text goes exactly as written.
function safeRestyle(html) {
  var styled = restyleOwnPart(html);
  if (keepsWords(html, styled)) return styled;
  var basic = brandText(html);
  return keepsWords(html, basic) ? basic : html;
}

// ---- Frame: brand bar and signature ----

function brandBarHtml() {
  return (
    '<table id="' + VSTX_BAR_ID + '" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
    "<tr>" + ruleCell(6, INK, ' colspan="2"') + "</tr>" +
    "<tr>" + ruleCell(3, "", ' width="9%"') + ruleCell(3, YELLOW, "") + "</tr>" +
    "<tr>" + ruleCell(22, "", ' colspan="2"') + "</tr>" +
    "</table>"
  );
}

// The directory lists people as "Last, First"; a signature reads "First Last".
function profileName() {
  var profile = typeof Office !== "undefined" && Office.context && Office.context.mailbox && Office.context.mailbox.userProfile;
  if (!profile) return "";
  var display = (profile.displayName || "").trim();
  var lastFirst = /^([^,]+),\s*(.+)$/.exec(display);
  if (lastFirst) return lastFirst[2] + " " + lastFirst[1];
  return display || (profile.emailAddress || "").split("@")[0];
}

// Until someone saves their own details, the signature carries just their name from Outlook.
function signatureDefaults() {
  return { name: profileName(), title: "", phone: "" };
}

function isSignatureSetUp() {
  return typeof roamingValue(SIGNATURE_SETTINGS_KEY).name === "string";
}

function signatureDetails() {
  var saved = roamingValue(SIGNATURE_SETTINGS_KEY);
  var defaults = signatureDefaults();
  var pick = function (key) {
    return typeof saved[key] === "string" ? saved[key].trim() : defaults[key];
  };
  return { name: pick("name") || defaults.name, title: pick("title"), phone: pick("phone") };
}

function signatureLines(details) {
  var text = "font-family:" + FONT_STACK + ";";
  var lines = ['<span style="' + text + "font-size:16px;font-weight:700;letter-spacing:.01em;color:" + INK + '">' + escapeHtml(details.name) + "</span>"];
  if (details.title) lines.push('<span style="' + text + "font-size:13px;color:" + INK + '">' + escapeHtml(details.title) + "</span>");
  if (details.phone) {
    lines.push('<span style="' + text + "font-size:13px;color:" + GREY + '">' + escapeHtml(details.phone).replace(/-/g, "&#8209;") + "</span>");
  }
  return lines.join("<br>");
}

function signatureHtml(details) {
  var text = "font-family:" + FONT_STACK + ";";
  details = details || signatureDetails();
  var panel = ' bgcolor="' + PANEL + '"';
  var panelCss = "background:" + PANEL + ";border-top:1px solid " + HAIRLINE + ";";
  return (
    '<table id="' + VSTX_SIGNATURE_ID + '" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
    "<tr>" + ruleCell(26, "", ' colspan="3"') + "</tr>" +
    "<tr>" +
    '<td width="' + LOGO_WIDTH + '"' + panel + ' style="' + panelCss + "width:" + LOGO_WIDTH + 'px;padding:14px 16px 14px 20px;vertical-align:middle">' +
    '<img src="' + LOGO_URL + '" width="' + LOGO_WIDTH + '" height="' + LOGO_HEIGHT + '" alt="Versatex"' +
    ' style="display:block;width:' + LOGO_WIDTH + "px;height:" + LOGO_HEIGHT + "px;border:0;outline:none;" +
    text + "font-size:12px;font-weight:700;color:" + INK + '">' +
    "</td>" +
    "<td" + panel + ' style="' + panelCss + "vertical-align:middle;padding:10px 20px 10px 16px;border-left:3px solid " + YELLOW + '">' +
    signatureLines(details) +
    "</td>" +
    '<td align="right"' + panel + ' style="' + panelCss + 'vertical-align:middle;padding:10px 22px 10px 10px">' +
    '<img src="' + HEXAGONS_URL + '" width="' + HEXAGONS_WIDTH + '" height="' + HEXAGONS_HEIGHT + '" alt=""' +
    ' style="display:block;width:' + HEXAGONS_WIDTH + "px;height:" + HEXAGONS_HEIGHT + 'px;border:0;outline:none;margin-left:auto">' +
    "</td>" +
    "</tr></table>"
  );
}

// Once you've introduced yourself in a thread, later replies carry a one-line signature instead of the full panel.
function shortSignatureHtml(details) {
  var text = "font-family:" + FONT_STACK + ";font-size:13px;";
  var separator = '<span style="' + text + "color:" + LIGHT_GREY + '">&nbsp;&nbsp;|&nbsp;&nbsp;</span>';
  details = details || signatureDetails();
  var parts = ['<span style="' + text + "font-size:14px;font-weight:700;color:" + INK + '">' + escapeHtml(details.name) + "</span>"];
  if (details.title) parts.push('<span style="' + text + "color:" + INK + '">' + escapeHtml(details.title) + "</span>");
  if (details.phone) parts.push('<span style="' + text + "color:" + GREY + '">' + escapeHtml(details.phone).replace(/-/g, "&#8209;") + "</span>");
  return (
    '<table id="' + VSTX_SIGNATURE_ID + '" class="vstx-signature-short" role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
    "<tr>" + ruleCell(18, "", "") + "</tr>" +
    '<tr><td style="border-left:3px solid ' + YELLOW + ';padding:2px 0 2px 12px;line-height:20px">' + parts.join(separator) + "</td></tr>" +
    "</table>"
  );
}

function signedEarlierInThread(quoted, name) {
  if (!name) return false;
  var signature = new RegExp(VSTX_SIGNATURE_ID + "[\\s\\S]{0,3000}?>\\s*" + escapeHtml(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*<", "i");
  return signature.test(quoted);
}

function insertAfterBodyTag(html, fragment) {
  var bodyTag = /<body[^>]*>/i.exec(html);
  if (!bodyTag) return fragment + html;
  var at = bodyTag.index + bodyTag[0].length;
  return html.slice(0, at) + fragment + html.slice(at);
}

function signatureStart(ownPart) {
  var at = ownPart.indexOf(VSTX_SIGNATURE_ID);
  return at === -1 ? -1 : ownPart.lastIndexOf("<table", at);
}

function textStart(ownPart) {
  var at = ownPart.indexOf(VSTX_BAR_ID);
  if (at !== -1) {
    var barClose = ownPart.indexOf("</table>", at);
    if (barClose !== -1) return barClose + "</table>".length;
  }
  var bodyTag = /<body[^>]*>/i.exec(ownPart);
  return bodyTag ? bodyTag.index + bodyTag[0].length : 0;
}

// Returns the restyled email and whether this send added the frame (false when it only re-tidied the text).
function styleEmail(html) {
  var quoteStart = findQuoteStart(html);
  var ownPart = html.slice(0, quoteStart);
  var quoted = html.slice(quoteStart);
  var signatureAt = signatureStart(ownPart);
  if (signatureAt !== -1) {
    var from = Math.min(textStart(ownPart), signatureAt);
    return {
      html: ownPart.slice(0, from) + safeRestyle(ownPart.slice(from, signatureAt)) + ownPart.slice(signatureAt) + quoted,
      framed: false,
    };
  }
  var details = signatureDetails();
  var signature = featureSettings().shortReplies && signedEarlierInThread(quoted, details.name) ? shortSignatureHtml(details) : signatureHtml(details);
  return {
    html: insertAfterBodyTag(safeRestyle(ownPart), brandBarHtml()) + signature + quoted,
    framed: true,
  };
}

function applyVersatexStyle(html) {
  return styleEmail(html).html;
}

// ---- Outlook integration ----

function callAsync(invoke) {
  return new Promise(function (resolve, reject) {
    invoke(function (result) {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve(result.value);
      else reject(result.error);
    });
  });
}

// Resolves to "styled" (frame added), "refreshed" (text re-tidied), "unchanged" or "plain-text".
function restyleCurrentItem() {
  var body = Office.context.mailbox.item.body;
  return callAsync(function (done) {
    body.getTypeAsync(done);
  }).then(function (type) {
    if (type === Office.CoercionType.Text) return "plain-text";
    return callAsync(function (done) {
      body.getAsync(Office.CoercionType.Html, done);
    }).then(function (html) {
      var result = styleEmail(html);
      if (result.html === html) return "unchanged";
      return callAsync(function (done) {
        body.setAsync(result.html, { coercionType: Office.CoercionType.Html }, done);
      }).then(function () {
        return result.framed ? "styled" : "refreshed";
      });
    });
  });
}

function describeError(error) {
  return error && error.message ? error.message : String(error);
}

function canOfferSendAnyway() {
  return Office.context.requirements.isSetSupported("Mailbox", "1.14");
}

var ATTACHMENT_WORDS = /\b(?:attach(?:ed|es|ing|ment|ments)?|enclosed)(?![\wÀ-ɏ])/i;
var SHARED_FILE_LINK = /href=["']?https?:\/\/[^"'\s>]*(?:sharepoint\.com|onedrive\.live\.com|1drv\.ms)/i;
var PLAIN_TEXT_QUOTE = /^\s*(?:-{2,}\s*Original Message|_{10,}|From:\s)/im;

// Only your own words count: the quoted thread is full of other people's "see attached".
function mentionsMissingAttachment(item) {
  var body = item.body;
  return callAsync(function (done) {
    body.getTypeAsync(done);
  })
    .then(function (type) {
      var coercion = type === Office.CoercionType.Text ? Office.CoercionType.Text : Office.CoercionType.Html;
      return callAsync(function (done) {
        body.getAsync(coercion, done);
      }).then(function (content) {
        if (coercion === Office.CoercionType.Text) {
          var quoteAt = content.search(PLAIN_TEXT_QUOTE);
          return { words: quoteAt === -1 ? content : content.slice(0, quoteAt), sharedLink: false };
        }
        var own = content.slice(0, findQuoteStart(content));
        return { words: plainText(own), sharedLink: SHARED_FILE_LINK.test(own) };
      });
    })
    .then(function (own) {
      if (!ATTACHMENT_WORDS.test(own.words) || own.sharedLink || !Office.context.requirements.isSetSupported("Mailbox", "1.8")) return false;
      return callAsync(function (done) {
        item.getAttachmentsAsync(done);
      }).then(function (attachments) {
        return !attachments.some(function (attachment) {
          return !attachment.isInline;
        });
      });
    });
}

function withoutControlTags(subject) {
  return subject.replace(CONTROL_TAGS, " ").replace(/\s{2,}/g, " ").trim();
}

// The [review] and [plain] subject tags steer the add-in and are removed before the email goes out.
// The attachment check runs after styling, so "Send anyway" still sends the styled email.
function onMessageSendHandler(event) {
  var item = Office.context.mailbox.item;
  var subject = "";
  callAsync(function (done) {
    item.subject.getAsync(done);
  })
    .then(function (value) {
      subject = value || "";
      return PLAIN_TAG.test(subject) ? "skipped" : restyleCurrentItem();
    })
    .then(function (status) {
      var cleanSubject = withoutControlTags(subject);
      if (cleanSubject === subject) return status;
      return callAsync(function (done) {
        item.subject.setAsync(cleanSubject, done);
      }).then(function () {
        return status;
      });
    })
    .then(function (status) {
      var checkAttachment = featureSettings().attachmentCheck && canOfferSendAnyway();
      // A reminder isn't worth blocking Send over: if the lookup fails, the email goes out.
      var lookup = checkAttachment
        ? mentionsMissingAttachment(item).catch(function () {
            return false;
          })
        : Promise.resolve(false);
      return lookup.then(function (missing) {
        return { status: status, missingAttachment: missing };
      });
    })
    .then(function (outcome) {
      if (outcome.missingAttachment) {
        event.completed({
          allowEvent: false,
          errorMessage: "Your email mentions an attachment, but nothing is attached. Select Don't send to add it, or send it as it is.",
          sendModeOverride: Office.MailboxEnums.SendModeOverride.PromptUser,
        });
        return;
      }
      var wantsReview = outcome.status === "styled" && REVIEW_TAG.test(subject);
      if (!wantsReview) {
        event.completed({ allowEvent: true });
        return;
      }
      event.completed({
        allowEvent: false,
        errorMessage: "Versatex style applied. Check how the email looks, then select Send again.",
      });
    })
    .catch(function (error) {
      if (!canOfferSendAnyway()) {
        event.completed({ allowEvent: true });
        return;
      }
      event.completed({
        allowEvent: false,
        errorMessage: "Couldn't apply the Versatex style to this email: " + describeError(error),
        sendModeOverride: Office.MailboxEnums.SendModeOverride.PromptUser,
      });
    });
}

var SETTINGS_BUTTON = { message: "vstxSettingsButton", appointment: "vstxMeetingSettingsButton" };

// First use: until someone saves their details, each new email offers a one-click way to the settings pane.
function onNewComposeHandler(event) {
  if (isSignatureSetUp() || !Office.context.requirements.isSetSupported("Mailbox", "1.10")) {
    event.completed();
    return;
  }
  var item = Office.context.mailbox.item;
  var isInvite = item.itemType === Office.MailboxEnums.ItemType.Appointment;
  var done = function () {
    event.completed();
  };
  try {
    showSetupPrompt(item, isInvite ? SETTINGS_BUTTON.appointment : SETTINGS_BUTTON.message, done);
  } catch (error) {
    // A prompt Outlook rejects is skipped; the email itself is unaffected.
    done();
  }
}

function showSetupPrompt(item, commandId, done) {
  item.notificationMessages.replaceAsync(
    "vstx-setup",
    {
      type: Office.MailboxEnums.ItemNotificationMessageType.InsightMessage,
      message: "Finish your Versatex signature: add your title and phone once, and every email carries it.",
      icon: "Icon.16x16",
      actions: [
        {
          actionText: "Open settings",
          actionType: Office.MailboxEnums.ActionType.ShowTaskPane,
          commandId: commandId,
          contextData: "{}",
        },
      ],
    },
    done
  );
}

function notify(message) {
  return callAsync(function (done) {
    Office.context.mailbox.item.notificationMessages.replaceAsync(
      "vstx",
      {
        type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
        message: message.slice(0, 150),
        icon: "Icon.16x16",
        persistent: false,
      },
      done
    );
  });
}

var PREVIEW_MESSAGES = {
  styled: "Versatex style applied.",
  refreshed: "Versatex style refreshed for your latest edits.",
  unchanged: "This email already has the Versatex style.",
  "plain-text": "This is a plain-text email, so the Versatex style isn't applied.",
};

function previewStyle(event) {
  restyleCurrentItem()
    .then(function (status) {
      return notify(PREVIEW_MESSAGES[status]);
    })
    .catch(function (error) {
      return notify("Couldn't restyle: " + describeError(error)).catch(function () {
        return undefined;
      });
    })
    .then(function () {
      event.completed();
    });
}

// The settings pane loads this file only to preview the signature, and declares VSTX_SETTINGS_PANE first.
if (typeof VSTX_SETTINGS_PANE === "undefined") {
  Office.actions.associate("onMessageSendHandler", onMessageSendHandler);
  Office.actions.associate("previewStyle", previewStyle);
  Office.actions.associate("onNewComposeHandler", onNewComposeHandler);
}
