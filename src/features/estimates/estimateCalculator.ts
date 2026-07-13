import type { EstimateForm, EstimatePricing, EstimateResult, EstimateRow } from "./estimateTypes";

const finalizeEstimate = (
  sqft: number,
  low: number,
  high: number,
  rows: EstimateRow[],
  notes: string[],
  pricing: EstimatePricing,
): EstimateResult => {
  if (low < pricing.mj || high < pricing.mj) {
    notes.push(`Minimum job price of $${pricing.mj.toLocaleString()} applied.`);
  }
  let nextLow = Math.max(low, pricing.mj);
  let nextHigh = Math.max(high, pricing.mj);
  nextLow = Math.round(nextLow / 50) * 50;
  nextHigh = Math.round(nextHigh / 50) * 50;
  if (nextLow === nextHigh) {
    nextHigh = nextLow + 500;
  }
  return { sqft, lo: nextLow, hi: nextHigh, rows, notes };
};

export function calcEst(form: EstimateForm, pricing: EstimatePricing): EstimateResult {
  const type = form.type;
  let sqft = 0;
  let low = 0;
  let high = 0;
  const rows: EstimateRow[] = [];
  const notes: string[] = [];

  if (type === "columns") {
    const count = parseInt(form.cols, 10) || 1;
    low = count * pricing.co1;
    high = count * pricing.co2;
    rows.push({ l: `${count} column${count > 1 ? "s" : ""} x $${pricing.co1}-$${pricing.co2} each`, lo: low, hi: high });
    notes.push("Column pricing depends on size, height, design, and footing requirements.");
    return finalizeEstimate(sqft, low, high, rows, notes, pricing);
  }

  if (type === "repair") {
    sqft = form.len && form.wid ? parseFloat(form.len) * parseFloat(form.wid) : 0;
    low = pricing.re1;
    high = pricing.re2;
    rows.push({ l: "Concrete repair - rough all-in range", lo: low, hi: high });
    notes.push("Repair pricing is highly variable. Scope confirmed on site visit.");
    return finalizeEstimate(sqft, low, high, rows, notes, pricing);
  }

  sqft = parseFloat(form.len) * parseFloat(form.wid);

  if (type === "block") {
    const perimeter = 2 * (parseFloat(form.len) + parseFloat(form.wid));
    low = perimeter * pricing.bl1;
    high = perimeter * pricing.bl2;
    rows.push({ l: `~${Math.round(perimeter)} lin ft x $${pricing.bl1}-$${pricing.bl2}/ft`, lo: low, hi: high });
    notes.push("Final pricing depends on wall height, block type, and footing design.");
    if (form.grade !== "no") {
      rows.push({ l: `${form.grade === "ns" ? "Possible " : ""}Grading/prep`, lo: pricing.gr1, hi: pricing.gr2 });
      low += pricing.gr1;
      high += pricing.gr2;
    }
    if (form.access !== "yes") {
      rows.push({ l: `${form.access === "ns" ? "Possible " : ""}Difficult access`, lo: pricing.ac1, hi: pricing.ac2 });
      low += pricing.ac1;
      high += pricing.ac2;
    }
    return finalizeEstimate(sqft, low, high, rows, notes, pricing);
  }

  if (type === "pole_barn") {
    low = sqft * pricing.pb1;
    high = sqft * pricing.pb2;
    rows.push({ l: `${sqft.toLocaleString()} sqft x $${pricing.pb1}-$${pricing.pb2}/sqft`, lo: low, hi: high });
  } else {
    low = sqft * pricing.b1;
    high = sqft * pricing.b2;
    rows.push({ l: `${sqft.toLocaleString()} sqft x $${pricing.b1}-$${pricing.b2}/sqft (base)`, lo: low, hi: high });

    const isStamped = type === "stamped" || form.finish === "stamped";
    const isDecorative = type === "decorative" || form.finish === "decorative";

    if (isStamped) {
      const stampedLow = sqft * pricing.st1;
      const stampedHigh = sqft * pricing.st2;
      rows.push({ l: `Stamped finish (+$${pricing.st1}-$${pricing.st2}/sqft)`, lo: stampedLow, hi: stampedHigh });
      low += stampedLow;
      high += stampedHigh;
    } else if (isDecorative) {
      const decorativeLow = sqft * pricing.de1;
      const decorativeHigh = sqft * pricing.de2;
      rows.push({ l: `Decorative/stain (+$${pricing.de1}-$${pricing.de2}/sqft)`, lo: decorativeLow, hi: decorativeHigh });
      low += decorativeLow;
      high += decorativeHigh;
    }
  }

  if (form.thick === "6" && sqft > 0) {
    const thickLow = sqft * pricing.th1;
    const thickHigh = sqft * pricing.th2;
    rows.push({ l: `6"+ thick slab (+$${pricing.th1}-$${pricing.th2}/sqft)`, lo: thickLow, hi: thickHigh });
    low += thickLow;
    high += thickHigh;
  }

  if (form.tear !== "no" && sqft > 0) {
    const prefix = form.tear === "ns" ? "Possible " : "";
    const tearLow = sqft * pricing.tr1;
    const tearHigh = sqft * pricing.tr2;
    rows.push({ l: `${prefix}Tear-out/removal (+$${pricing.tr1}-$${pricing.tr2}/sqft)`, lo: tearLow, hi: tearHigh });
    low += tearLow;
    high += tearHigh;
    if (form.tear === "ns") {
      notes.push("Tear-out included as possible - confirm on site visit.");
    }
  }

  if (form.grade !== "no") {
    const prefix = form.grade === "ns" ? "Possible " : "";
    rows.push({ l: `${prefix}Grading/prep`, lo: pricing.gr1, hi: pricing.gr2 });
    low += pricing.gr1;
    high += pricing.gr2;
    if (form.grade === "ns") {
      notes.push("Grading included as possible - confirm on site visit.");
    }
  }

  if (form.access !== "yes") {
    const prefix = form.access === "ns" ? "Possible " : "";
    rows.push({ l: `${prefix}Difficult access`, lo: pricing.ac1, hi: pricing.ac2 });
    low += pricing.ac1;
    high += pricing.ac2;
    if (form.access === "ns") {
      notes.push("Access upcharge possible - confirm on site visit.");
    }
  }

  return finalizeEstimate(sqft, low, high, rows, notes, pricing);
}
