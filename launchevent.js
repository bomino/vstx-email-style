var VSTX_SIGNATURE_ID = "vstx-signature";
var SIGNATURE_NAME = "Lawali";
var SIGNATURE_TITLE = "Analytics & AI Solutions";
var SIGNATURE_PHONE = "513-639-8829";
var ASSET_BASE = "https://bomino.github.io/vstx-email-style/assets/";
var LOGO_URL = ASSET_BASE + "vstx-logo.png";
var LOGO_WIDTH = 54;
var LOGO_HEIGHT = 70;
var HEXAGONS_URL = ASSET_BASE + "vstx-hexagons.png";
var HEXAGONS_WIDTH = 66;
var HEXAGONS_HEIGHT = 62;
var FONT_STACK = "Roboto,Arial,sans-serif";
var INK = "#231f20";
var GREY = "#58595b";
var YELLOW = "#fdc00f";
var PANEL = "#f4f4f4";
var HAIRLINE = "#e6e7e8";
var BRAND_TEXT = "font-family:" + FONT_STACK + ";color:" + INK;
var BODY_TEXT = BRAND_TEXT + ";font-size:15px;line-height:1.6";
var BULLET_LIST_CSS = "list-style:none;margin-left:0;padding-left:0";
var BULLET_ITEM_CSS = "margin-bottom:4px";
var HEXAGON_BULLET =
  "<span style=\"color:" + YELLOW + ";font-size:18px;line-height:1;vertical-align:-1px;font-family:'Segoe UI Symbol',Arial,sans-serif\">&#11042;</span>&nbsp;&nbsp;";
var REVIEW_TAG = "[review]";
var TEXT_TAGS = /<(p|li|div|span|td|font)(\s[^>]*)?>/gi;
var HEADING_TAGS = /<(h[1-6])(\s[^>]*)?>/gi;
var BULLET_LISTS = /<ul\b[\s\S]*?<\/ul>/gi;
var LIST_OPEN = /<(ul)(\s[^>]*)?>/gi;
var LIST_ITEMS = /<(li)(\s[^>]*)?>(\s*<(?:div|p)\b[^>]*>)?/gi;
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

function styleMerger(css) {
  return function (tag, name, attrs) {
    attrs = attrs || "";
    if (/WordSection/i.test(attrs)) return tag;
    var match = STYLE_ATTR.exec(attrs);
    if (!match) return "<" + name + attrs + ' style="' + css + '">';
    var quote = match[1].charAt(0);
    var existing = match[2] !== undefined ? match[2] : match[3];
    var merged = existing.replace(/[;\s]*$/, "") + ";" + css;
    return "<" + name + attrs.replace(STYLE_ATTR, function () {
      return "style=" + quote + merged + quote;
    }) + ">";
  };
}

function withHexagonBullets(list) {
  var styleItem = styleMerger(BULLET_ITEM_CSS);
  return list.replace(LIST_OPEN, styleMerger(BULLET_LIST_CSS)).replace(LIST_ITEMS, function (match, name, attrs, innerBlock) {
    var itemTag = match.slice(0, match.length - (innerBlock || "").length);
    return styleItem(itemTag, name, attrs) + (innerBlock || "") + HEXAGON_BULLET;
  });
}

function restyleOwnPart(html) {
  return html
    .replace(TEXT_TAGS, styleMerger(BODY_TEXT))
    .replace(HEADING_TAGS, styleMerger(BRAND_TEXT))
    .replace(BULLET_LISTS, withHexagonBullets);
}

function ruleCell(height, color, attrs) {
  return (
    "<td" + attrs + ' height="' + height + '" bgcolor="' + color + '"' +
    ' style="height:' + height + "px;background:" + color + ';font-size:0;line-height:0">&nbsp;</td>'
  );
}

function brandBarHtml() {
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 22px">' +
    "<tr>" + ruleCell(4, INK, ' colspan="2"') + "</tr>" +
    "<tr>" + ruleCell(2, YELLOW, ' width="38%"') + '<td style="font-size:0;line-height:0">&nbsp;</td></tr>' +
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
    ' style="display:block;width:' + LOGO_WIDTH + "px;height:" + LOGO_HEIGHT + 'px;border:0;outline:none">' +
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

function applyVersatexStyle(html) {
  var quoteStart = findQuoteStart(html);
  var ownPart = insertAfterBodyTag(restyleOwnPart(html.slice(0, quoteStart)), brandBarHtml());
  return ownPart + signatureHtml() + html.slice(quoteStart);
}

function callAsync(invoke) {
  return new Promise(function (resolve, reject) {
    invoke(function (result) {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve(result.value);
      else reject(result.error);
    });
  });
}

function restyleCurrentItem() {
  var item = Office.context.mailbox.item;
  return callAsync(function (done) {
    item.body.getAsync(Office.CoercionType.Html, done);
  }).then(function (html) {
    var ownPart = html.slice(0, findQuoteStart(html));
    if (ownPart.indexOf(VSTX_SIGNATURE_ID) !== -1) return false;
    var styled = applyVersatexStyle(html);
    return callAsync(function (done) {
      item.body.setAsync(styled, { coercionType: Office.CoercionType.Html }, done);
    }).then(function () {
      return true;
    });
  });
}

function describeError(error) {
  return error && error.message ? error.message : String(error);
}

function canOfferSendAnyway() {
  return Office.context.requirements.isSetSupported("Mailbox", "1.14");
}

function onMessageSendHandler(event) {
  var item = Office.context.mailbox.item;
  var restyled = false;
  restyleCurrentItem()
    .then(function (changed) {
      restyled = changed;
      return callAsync(function (done) {
        item.subject.getAsync(done);
      });
    })
    .then(function (subject) {
      var wantsReview = restyled && subject.toLowerCase().indexOf(REVIEW_TAG) !== -1;
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

function previewStyle(event) {
  restyleCurrentItem()
    .then(function (changed) {
      return notify(changed ? "Versatex style applied." : "This email already has the Versatex style.");
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
