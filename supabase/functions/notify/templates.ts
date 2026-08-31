/**
 * Mail bodies, in both languages.
 *
 * PDT's platform is bilingual and the recipient's locale travels on the outbox
 * row, so nothing here guesses. Danish is the source text; English is a
 * translation of it.
 *
 * Deliberately plain HTML with inline styles. Mail clients strip <style> blocks
 * and ignore most of what a browser would honour, so anything cleverer would
 * look worse in Outlook than this does.
 */

type Payload = Record<string, unknown>;

const COPY: Record<string, { da: [string, string]; en: [string, string] }> = {
  order_placed: {
    da: ["Tak for din bestilling", "Vi har modtaget bestilling {orderNumber}. Du kan følge den på din side."],
    en: ["Thank you for your order", "We have received order {orderNumber}. You can follow it on your page."],
  },
  approval_requested: {
    da: ["En bestilling afventer din godkendelse", "Bestilling {orderNumber} fra {employee} venter på en beslutning."],
    en: ["An order is waiting for your approval", "Order {orderNumber} from {employee} is waiting for a decision."],
  },
  order_dispatched: {
    da: ["Din bestilling er sendt", "Bestilling {orderNumber} er afsendt. Pakkenummer: {parcel}."],
    en: ["Your order has been dispatched", "Order {orderNumber} has been sent. Parcel number: {parcel}."],
  },
  payment_succeeded: {
    da: ["Betaling modtaget", "Vi har modtaget {amountDkk} kr. for bestilling {orderNumber}."],
    en: ["Payment received", "We have received {amountDkk} kr. for order {orderNumber}."],
  },
  payment_failed: {
    da: ["Betalingen gik ikke igennem", "Betalingen for bestilling {orderNumber} blev afvist. Bestillingen er ikke annulleret."],
    en: ["Payment did not go through", "The payment for order {orderNumber} was declined. The order has not been cancelled."],
  },
  application_received: {
    da: ["Ny ansøgning om brugeradgang", "{company} har ansøgt om adgang. Kontakt: {contact}."],
    en: ["New B2B access application", "{company} has applied for access. Contact: {contact}."],
  },
  enquiry_received: {
    da: ["Ny henvendelse fra hjemmesiden", "{name} har skrevet: {message}"],
    en: ["New website enquiry", "{name} wrote: {message}"],
  },
  import_staged: {
    da: ["Nyt leverandørfeed klar til gennemsyn", "{supplier}: {created} nye, {updated} ændringer, {discontinued} udgået."],
    en: ["Supplier feed staged for review", "{supplier}: {created} new, {updated} changed, {discontinued} discontinued."],
  },
  import_failed: {
    da: ["Import fejlede", "{supplier} kunne ikke importeres: {error}"],
    en: ["Import failed", "{supplier} could not be imported: {error}"],
  },
};

/** Replaces {placeholders}, escaping every value — payloads reach a mail client. */
function fill(template: string, payload: Payload): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = payload[key];
    return value === undefined || value === null ? "—" : escapeHtml(String(value));
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function render(kind: string, locale: string, payload: Payload): string {
  const entry = COPY[kind];
  const lang = locale === "en" ? "en" : "da";

  // An unknown kind still gets delivered rather than swallowed: somebody
  // queued it on purpose, and a silent drop is the worst outcome for a queue.
  const [heading, body] = entry
    ? entry[lang]
    : [kind, JSON.stringify(payload)];

  return `<!doctype html>
<html lang="${lang}">
  <body style="margin:0;padding:24px;background:#f5f4f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px">
      <tr><td style="padding:32px">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b6b">Profil Design Trading</p>
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(heading)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6">${fill(body, payload)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
