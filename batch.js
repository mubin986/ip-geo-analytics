const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { lookupCity } = require("./index");

const inputFile = process.argv[2] || "ips.json";
const detailsFile = process.argv[3] || "output-details.json";
const analyticsFile = process.argv[4] || "output-analytics.json";

// Read input — supports [{ ip: "..." }, ...] or ["ip", ...]
const raw = JSON.parse(fs.readFileSync(path.resolve(inputFile), "utf-8"));
const ips = raw.map((item) => (typeof item === "string" ? item : item.ip));
console.log(`Processing ${ips.length} IPs from ${inputFile}...\n`);

// Lookup each IP with progress
const results = [];
const failed = [];
const total = ips.length;
const startTime = Date.now();
let lastPrint = 0;

for (let i = 0; i < total; i++) {
  const result = lookupCity(ips[i]);
  if (result) {
    results.push(result);
  } else {
    failed.push(ips[i]);
  }

  // Update progress every 1% or every 500 IPs, whichever is smaller
  const now = i + 1;
  const interval = Math.max(1, Math.min(500, Math.floor(total / 100)));
  if (now === total || now - lastPrint >= interval) {
    lastPrint = now;
    const pct = ((now / total) * 100).toFixed(1);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = Math.round(now / elapsed) || 0;
    const eta = rate > 0 ? ((total - now) / rate).toFixed(1) : "—";
    const barLen = 30;
    const filled = Math.round((now / total) * barLen);
    const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
    process.stdout.write(
      `\r  ${bar}  ${pct}%  ${now.toLocaleString()}/${total.toLocaleString()}  ${rate.toLocaleString()} IPs/s  ETA ${eta}s`
    );
  }
}
process.stdout.write("\n\n");

// --- Analytics ---

function countBy(arr, key) {
  const map = {};
  for (const item of arr) {
    const val = item[key];
    map[val] = (map[val] || 0) + 1;
  }
  // Sort descending by count
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

const countryStats = countBy(results, "country");
const cityStats = countBy(
  results.filter((r) => r.city !== "Unknown"),
  "city"
);
const timezoneStats = countBy(results, "timezone");

const analytics = {
  totalIPs: ips.length,
  resolved: results.length,
  failedCount: failed.length,
  failedIPs: failed,
  uniqueCountries: countryStats.length,
  uniqueCities: cityStats.length,
  uniqueTimezones: timezoneStats.length,
  topCountries: countryStats.slice(0, 10),
  topCities: cityStats.slice(0, 10),
  topTimezones: timezoneStats.slice(0, 10),
};

// Write details file
const details = {
  generatedAt: new Date().toISOString(),
  total: results.length,
  results,
};
fs.writeFileSync(path.resolve(detailsFile), JSON.stringify(details, null, 2));

// Write analytics JSON file
const analyticsOutput = {
  generatedAt: new Date().toISOString(),
  ...analytics,
};
fs.writeFileSync(
  path.resolve(analyticsFile),
  JSON.stringify(analyticsOutput, null, 2)
);

// Write Excel report
const excelFile = analyticsFile.replace(/\.json$/, ".xlsx");
async function writeExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "IP City Finder";
  wb.created = new Date();

  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B579A" } };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  const subHeaderFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF7" } };
  const subHeaderFont = { bold: true, size: 11 };
  const borderStyle = { style: "thin", color: { argb: "FFD0D0D0" } };
  const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  function styleHeader(sheet, colCount) {
    const row = sheet.getRow(1);
    row.height = 28;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borders;
    }
  }

  function styleDataRows(sheet, startRow, colCount) {
    for (let r = startRow; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.border = borders;
        cell.alignment = { vertical: "middle" };
      }
      if (r % 2 === 0) {
        for (let c = 1; c <= colCount; c++) {
          row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7FA" } };
        }
      }
    }
  }

  // --- Sheet 1: Summary ---
  const summarySheet = wb.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 25 },
    { header: "Value", key: "value", width: 20 },
  ];
  summarySheet.addRows([
    { metric: "Generated At", value: analyticsOutput.generatedAt },
    { metric: "Total IPs", value: analytics.totalIPs },
    { metric: "Resolved", value: analytics.resolved },
    { metric: "Failed", value: analytics.failedCount },
    { metric: "Unique Countries", value: analytics.uniqueCountries },
    { metric: "Unique Cities", value: analytics.uniqueCities },
    { metric: "Unique Timezones", value: analytics.uniqueTimezones },
    { metric: "Resolution Rate", value: ((analytics.resolved / analytics.totalIPs) * 100).toFixed(1) + "%" },
  ]);
  styleHeader(summarySheet, 2);
  styleDataRows(summarySheet, 2, 2);

  // --- Sheet 2: Countries ---
  const countrySheet = wb.addWorksheet("Countries");
  countrySheet.columns = [
    { header: "#", key: "rank", width: 8 },
    { header: "Country", key: "name", width: 20 },
    { header: "IP Count", key: "count", width: 15 },
    { header: "% Share", key: "pct", width: 12 },
  ];
  countryStats.forEach(({ name, count }, i) => {
    countrySheet.addRow({
      rank: i + 1,
      name,
      count,
      pct: ((count / results.length) * 100).toFixed(2) + "%",
    });
  });
  styleHeader(countrySheet, 4);
  styleDataRows(countrySheet, 2, 4);

  // --- Sheet 3: Cities ---
  const citySheet = wb.addWorksheet("Cities");
  citySheet.columns = [
    { header: "#", key: "rank", width: 8 },
    { header: "City", key: "name", width: 30 },
    { header: "IP Count", key: "count", width: 15 },
    { header: "% Share", key: "pct", width: 12 },
  ];
  cityStats.forEach(({ name, count }, i) => {
    citySheet.addRow({
      rank: i + 1,
      name,
      count,
      pct: ((count / results.length) * 100).toFixed(2) + "%",
    });
  });
  styleHeader(citySheet, 4);
  styleDataRows(citySheet, 2, 4);

  // --- Sheet 4: Timezones ---
  const tzSheet = wb.addWorksheet("Timezones");
  tzSheet.columns = [
    { header: "#", key: "rank", width: 8 },
    { header: "Timezone", key: "name", width: 30 },
    { header: "IP Count", key: "count", width: 15 },
    { header: "% Share", key: "pct", width: 12 },
  ];
  timezoneStats.forEach(({ name, count }, i) => {
    tzSheet.addRow({
      rank: i + 1,
      name,
      count,
      pct: ((count / results.length) * 100).toFixed(2) + "%",
    });
  });
  styleHeader(tzSheet, 4);
  styleDataRows(tzSheet, 2, 4);

  // --- Sheet 5: All Results ---
  const detailSheet = wb.addWorksheet("All Results");
  detailSheet.columns = [
    { header: "#", key: "rank", width: 8 },
    { header: "IP Address", key: "ip", width: 20 },
    { header: "City", key: "city", width: 25 },
    { header: "Region", key: "region", width: 12 },
    { header: "Country", key: "country", width: 12 },
    { header: "Timezone", key: "timezone", width: 25 },
    { header: "Latitude", key: "lat", width: 14 },
    { header: "Longitude", key: "lng", width: 14 },
  ];
  results.forEach((r, i) => {
    detailSheet.addRow({
      rank: i + 1,
      ip: r.ip,
      city: r.city,
      region: r.region,
      country: r.country,
      timezone: r.timezone,
      lat: r.ll[0],
      lng: r.ll[1],
    });
  });
  styleHeader(detailSheet, 8);
  styleDataRows(detailSheet, 2, 8);
  detailSheet.autoFilter = { from: "A1", to: "H1" };

  // --- Sheet 6: Failed IPs ---
  if (failed.length) {
    const failedSheet = wb.addWorksheet("Failed IPs");
    failedSheet.columns = [
      { header: "#", key: "rank", width: 8 },
      { header: "IP Address", key: "ip", width: 25 },
    ];
    failed.forEach((ip, i) => {
      failedSheet.addRow({ rank: i + 1, ip });
    });
    styleHeader(failedSheet, 2);
    styleDataRows(failedSheet, 2, 2);
  }

  await wb.xlsx.writeFile(path.resolve(excelFile));
}


// Print summary to console
console.log("=== Analytics Summary ===\n");
console.log(`Total IPs:        ${analytics.totalIPs}`);
console.log(`Resolved:         ${analytics.resolved}`);
console.log(`Failed:           ${analytics.failedCount}`);
console.log(`Unique Countries: ${analytics.uniqueCountries}`);
console.log(`Unique Cities:    ${analytics.uniqueCities}`);
console.log(`Unique Timezones: ${analytics.uniqueTimezones}`);

if (countryStats.length) {
  console.log("\nTop Countries:");
  for (const { name, count } of countryStats.slice(0, 5)) {
    console.log(`  ${name}  — ${count} IP(s)`);
  }
}

if (cityStats.length) {
  console.log("\nTop Cities:");
  for (const { name, count } of cityStats.slice(0, 5)) {
    console.log(`  ${name}  — ${count} IP(s)`);
  }
}

if (failed.length) {
  console.log("\nFailed IPs:");
  for (const ip of failed) {
    console.log(`  ${ip}`);
  }
}

writeExcel().then(() => {
  console.log(`\nDetails JSON to   ${detailsFile}`);
  console.log(`Analytics JSON to ${analyticsFile}`);
  console.log(`Excel report to   ${excelFile}`);
});
