var VSTX_SIGNATURE_ID = "vstx-signature";
var VSTX_BAR_ID = "vstx-bar";
var VSTX_LIST_CLASS = "vstx-list";
var SIGNATURE_NAME = "Lawali";
var SIGNATURE_TITLE = "Analytics & AI Solutions";
var SIGNATURE_PHONE = "513-639-8829";
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
var BULLET_LIST_CSS = "list-style:none;margin-left:0;padding-left:0";
var SUBLIST_UNDER_NUMBER_CSS = "list-style:none;margin:6px 0 4px;padding-left:0";
var SUBLIST_UNDER_BULLET_CSS = "list-style:none;margin:2px 0 6px;padding-left:24px";
var BULLET_ITEM_CSS = "list-style:none;margin-bottom:4px";
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
var LIST_TAGS = /<(\/?)(ul|ol|li)\b([^>]*)>/gi;
var BULLET_BEFORE_BLOCK = /(<span style="[^"]*">&#11042;<\/span>&nbsp;&nbsp;)(\s*<(?:div|p)\b[^>]*>)/gi;
var REPEATED_BULLETS = /(<span style="[^"]*">&#11042;<\/span>&nbsp;&nbsp;)(?:\s*<span style="[^"]*">&#11042;<\/span>&nbsp;&nbsp;)+/gi;
var STYLE_ATTR = /\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i;
var QUOTE_MARKERS = [
  /<div[^>]*\bid=["']?appendonsend\b/i,
  /<div[^>]*\bid=["']?divRplyFwdMsg\b/i,
  /<div[^>]*border-top:\s*solid\s+#E1E1E1/i,
  /<hr\b[^>]*>/i,
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
  var otherAttrs = (attrs || "").replace(STYLE_ATTR, "").replace(/\s+$/, "");
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
        var foreign = attrs.indexOf(VSTX_LIST_CLASS) === -1;
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
    if (/WordSection/i.test(attrs)) return tag;
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

// ---- Lists ----

function hexagonBullet(color) {
  return (
    "<span style=\"color:" + color +
    ";font-size:18px;line-height:1;vertical-align:-1px;font-family:'Segoe UI Symbol',Arial,sans-serif\">&#11042;</span>&nbsp;&nbsp;"
  );
}

// Any sub-list, numbered or not, becomes a hexagon bullet list; only top-level numbered lists keep numbers.
function withHexagonBullets(html) {
  var openLists = [];
  var marked = html.replace(LIST_TAGS, function (tag, closing, name, attrs) {
    name = name.toLowerCase();
    if (name !== "li") {
      if (closing) return "</" + (openLists.pop() || name) + ">";
      var parent = openLists[openLists.length - 1];
      var listName = parent ? "ul" : name;
      openLists.push(listName);
      if (!parent) return listName === "ul" ? mergeStyle(tag, listName, attrs, BULLET_LIST_CSS) : tag;
      return mergeStyle(tag, listName, attrs, parent === "ol" ? SUBLIST_UNDER_NUMBER_CSS : SUBLIST_UNDER_BULLET_CSS);
    }
    if (closing || openLists[openLists.length - 1] !== "ul") return tag;
    var level = openLists.length - (openLists[0] === "ol" ? 1 : 0);
    return mergeStyle(tag, name, attrs, BULLET_ITEM_CSS) + hexagonBullet(level > 1 ? LIGHT_GREY : GREY);
  });
  return marked.replace(BULLET_BEFORE_BLOCK, "$2$1").replace(REPEATED_BULLETS, "$1");
}

function numberBadge(number) {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>' +
    '<td width="' + BADGE_SIZE + '" height="' + BADGE_SIZE + '" align="center" bgcolor="' + YELLOW + '" style="' + BADGE_CSS + '">' +
    '<span style="font-family:' + FONT_STACK + ";font-size:12px;font-weight:900;color:" + INK + '">' + number + "</span></td>" +
    "</tr></table>"
  );
}

function endOfNumberedList(html, from) {
  var tags = /<(\/?)ol\b[^>]*>/gi;
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
// so a sub-list found between items is attached to the item above it.
function topLevelItems(inner) {
  var tags = /<(\/?)(ul|ol|li)\b[^>]*>/gi;
  var items = [];
  var leading = "";
  var depth = 0;
  var itemStart = -1;
  var subListStart = -1;
  var match;
  while ((match = tags.exec(inner))) {
    var closing = match[1] === "/";
    if (match[2].toLowerCase() !== "li") {
      if (!closing && depth === 0 && itemStart === -1) subListStart = match.index;
      depth += closing ? -1 : 1;
      if (closing && depth === 0 && subListStart !== -1) {
        var subList = inner.slice(subListStart, tags.lastIndex);
        if (items.length) items[items.length - 1] += subList;
        else leading += subList;
        subListStart = -1;
      }
    } else if (depth === 0 && !closing) {
      itemStart = tags.lastIndex;
    } else if (depth === 0 && itemStart !== -1) {
      items.push((items.length ? "" : leading) + inner.slice(itemStart, match.index));
      itemStart = -1;
    }
  }
  return items;
}

function numberedTable(attrs, inner) {
  var items = topLevelItems(inner);
  if (!items.length) return "<ol" + attrs + ">" + inner + "</ol>";
  var start = /\bstart=["']?(\d+)/i.exec(attrs);
  var number = start ? parseInt(start[1], 10) : 1;
  var rows = items.map(function (content) {
    return (
      '<tr><td style="vertical-align:top;padding:2px 12px 8px 0">' + numberBadge(number++) + "</td>" +
      '<td style="' + NUMBERED_TEXT_CSS + '"><div style="' + BODY_TEXT + '">' + withNumberBadges(content) + "</div></td></tr>"
    );
  });
  return (
    '<table class="' + VSTX_LIST_CLASS + '" role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 12px">' +
    rows.join("") +
    "</table>"
  );
}

function withNumberBadges(html) {
  var openers = /<ol\b([^>]*)>/gi;
  var output = "";
  var cursor = 0;
  var open;
  while ((open = openers.exec(html))) {
    var close = endOfNumberedList(html, openers.lastIndex);
    if (!close) break;
    output += html.slice(cursor, open.index) + numberedTable(open[1], html.slice(openers.lastIndex, close.innerEnd));
    cursor = close.end;
    openers.lastIndex = close.end;
  }
  return output + html.slice(cursor);
}

function restyleOwnPart(html) {
  return withNumberBadges(withHexagonBullets(brandText(html)));
}

// ---- Frame: brand bar and signature ----

function ruleCell(height, color, attrs) {
  return (
    "<td" + attrs + ' height="' + height + '" bgcolor="' + color + '"' +
    ' style="height:' + height + "px;background:" + color + ';font-size:0;line-height:0">&nbsp;</td>'
  );
}

function brandBarHtml() {
  return (
    '<table id="' + VSTX_BAR_ID + '" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 22px">' +
    "<tr>" + ruleCell(6, INK, ' colspan="2"') + "</tr>" +
    '<tr><td width="9%" style="font-size:0;line-height:0">&nbsp;</td>' + ruleCell(3, YELLOW, "") + "</tr>" +
    "</table>"
  );
}

function signatureHtml() {
  var text = "font-family:" + FONT_STACK + ";";
  var phone = escapeHtml(SIGNATURE_PHONE).replace(/-/g, "&#8209;");
  return (
    '<table id="' + VSTX_SIGNATURE_ID + '" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + PANEL + '"' +
    ' style="border-collapse:collapse;margin-top:26px;background:' + PANEL + ";border-top:1px solid " + HAIRLINE + '">' +
    "<tr>" +
    '<td width="' + LOGO_WIDTH + '" style="width:' + LOGO_WIDTH + 'px;padding:14px 16px 14px 20px;vertical-align:middle">' +
    '<img src="' + LOGO_URL + '" width="' + LOGO_WIDTH + '" height="' + LOGO_HEIGHT + '" alt="Versatex"' +
    ' style="display:block;width:' + LOGO_WIDTH + "px;height:" + LOGO_HEIGHT + "px;border:0;outline:none;" +
    text + "font-size:12px;font-weight:700;color:" + INK + '">' +
    "</td>" +
    '<td style="vertical-align:middle;padding:10px 20px 10px 16px;border-left:3px solid ' + YELLOW + '">' +
    '<span style="' + text + "font-size:16px;font-weight:700;letter-spacing:.01em;color:" + INK + '">' + escapeHtml(SIGNATURE_NAME) + "</span><br>" +
    '<span style="' + text + "font-size:13px;color:" + INK + '">' + escapeHtml(SIGNATURE_TITLE) + "</span><br>" +
    '<span style="' + text + "font-size:13px;color:" + GREY + '">' + phone + "</span>" +
    "</td>" +
    '<td align="right" style="vertical-align:middle;padding:10px 22px 10px 10px">' +
    '<img src="' + HEXAGONS_URL + '" width="' + HEXAGONS_WIDTH + '" height="' + HEXAGONS_HEIGHT + '" alt=""' +
    ' style="display:block;width:' + HEXAGONS_WIDTH + "px;height:" + HEXAGONS_HEIGHT + 'px;border:0;outline:none;margin-left:auto">' +
    "</td>" +
    "</tr></table>"
  );
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
      html: ownPart.slice(0, from) + restyleOwnPart(ownPart.slice(from, signatureAt)) + ownPart.slice(signatureAt) + quoted,
      framed: false,
    };
  }
  return {
    html: insertAfterBodyTag(restyleOwnPart(ownPart), brandBarHtml()) + signatureHtml() + quoted,
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

function withoutControlTags(subject) {
  return subject.replace(CONTROL_TAGS, " ").replace(/\s{2,}/g, " ").trim();
}

// The [review] and [plain] subject tags steer the add-in and are removed before the email goes out.
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
      var wantsReview = status === "styled" && REVIEW_TAG.test(subject);
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

Office.actions.associate("onMessageSendHandler", onMessageSendHandler);
Office.actions.associate("previewStyle", previewStyle);
