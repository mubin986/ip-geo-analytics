# IP Geo Analytics

Offline IP-to-city geolocation tool for Node.js. Uses the MaxMind GeoLite2 database bundled with [geoip-lite](https://www.npmjs.com/package/geoip-lite) — no API calls, fully offline.

## Setup

```bash
npm install
```

## Usage

### Batch Processing

Prepare your input file (see `ips.example.json`). Both formats are supported:

**Array of objects:**
```json
[
  { "ip": "8.8.8.8" },
  { "ip": "103.4.146.1" }
]
```

**Array of strings:**
```json
[
  "8.8.8.8",
  "103.4.146.1"
]
```

**Mixed:**
```json
[
  { "ip": "8.8.8.8" },
  "103.4.146.1"
]
```

Copy the example and add your IPs:

```bash
cp ips.example.json ips.json
```

Run the batch processor:

```bash
npm start
```

Or with custom file paths:

```bash
node batch.js <input> <details-output> <analytics-output>
node batch.js ips.json output-details.json output-analytics.json
```

### Output Files

The batch processor generates 3 output files:

| File | Description |
|------|-------------|
| `output-details.json` | Per-IP lookup results (city, region, country, timezone, lat/lng) |
| `output-analytics.json` | Analytics summary in JSON |
| `output-analytics.xlsx` | Excel report with multiple tabs (Summary, Countries, Cities, Timezones, All Results, Failed IPs) |

### Excel Report Tabs

| Tab | Content |
|-----|---------|
| Summary | Totals, resolution rate |
| Countries | Ranked list with count and % share |
| Cities | Ranked list with count and % share |
| Timezones | Ranked list with count and % share |
| All Results | Every IP with full geo details + auto-filter |
| Failed IPs | Unresolved IPs |

### Sample Output

**`output-details.json`** — per-IP geo results:

```json
{
  "generatedAt": "2026-04-07T07:36:36.484Z",
  "total": 6,
  "results": [
    {
      "ip": "103.4.146.1",
      "city": "Dhaka",
      "region": "C",
      "country": "BD",
      "timezone": "Asia/Dhaka",
      "ll": [23.7272, 90.4093]
    },
    {
      "ip": "202.84.37.1",
      "city": "Dhaka",
      "region": "C",
      "country": "BD",
      "timezone": "Asia/Dhaka",
      "ll": [23.7272, 90.4093]
    },
    {
      "ip": "8.8.8.8",
      "city": "Unknown",
      "region": "Unknown",
      "country": "US",
      "timezone": "America/Chicago",
      "ll": [37.751, -97.822]
    }
  ]
}
```

**`output-analytics.json`** — analytics summary:

```json
{
  "generatedAt": "2026-04-07T07:36:36.485Z",
  "totalIPs": 6,
  "resolved": 6,
  "failedCount": 0,
  "failedIPs": [],
  "uniqueCountries": 3,
  "uniqueCities": 1,
  "uniqueTimezones": 3,
  "topCountries": [
    { "name": "US", "count": 3 },
    { "name": "BD", "count": 2 },
    { "name": "Unknown", "count": 1 }
  ],
  "topCities": [
    { "name": "Dhaka", "count": 2 }
  ],
  "topTimezones": [
    { "name": "America/Chicago", "count": 3 },
    { "name": "Asia/Dhaka", "count": 2 },
    { "name": "Unknown", "count": 1 }
  ]
}
```

**`output-analytics.xlsx`** — Excel report with styled tabs:

| Summary | | Countries | |
|---|---|---|---|
| Total IPs | 6 | US | 3 |
| Resolved | 6 | BD | 2 |
| Failed | 0 | Unknown | 1 |
| Unique Countries | 3 | | |
| Unique Cities | 1 | | |
| Resolution Rate | 100.0% | | |

| All Results | | | | |
|---|---|---|---|---|
| IP Address | City | Region | Country | Timezone |
| 103.4.146.1 | Dhaka | C | BD | Asia/Dhaka |
| 202.84.37.1 | Dhaka | C | BD | Asia/Dhaka |
| 8.8.8.8 | Unknown | Unknown | US | America/Chicago |

### Single IP Lookup

```bash
node index.js 103.4.146.1
```

Output:

```
IP:       103.4.146.1
City:     Dhaka
Region:   C
Country:  BD
Timezone: Asia/Dhaka
Lat/Lng:  23.7272, 90.4093
```

### As a Module

```js
const { lookupCity } = require("./index");

const result = lookupCity("103.4.146.1");
// { ip, city, region, country, timezone, ll }
```

## Input from MongoDB

Export IPs from a MongoDB `users` collection:

```js
// mongosh
const result = db.users.aggregate([
  { $match: { ip: { $exists: true, $ne: null, $ne: "" } } },
  { $group: { _id: "$ip" } },
  { $project: { _id: 0, ip: "$_id" } }
]).toArray();

fs.writeFileSync("ips.json", JSON.stringify(result, null, 2));
```

Or via CLI:

```bash
mongosh --quiet --eval '
  print(JSON.stringify(
    db.getSiblingDB("YOUR_DB").users.aggregate([
      { $match: { ip: { $exists: true, $ne: null, $ne: "" } } },
      { $group: { _id: "$ip" } },
      { $project: { _id: 0, ip: "$_id" } }
    ]).toArray()
  ))
' > ips.json
```

Then run:

```bash
npm start
```

## Performance

Handles 200k+ IPs with ease (~150k-300k IPs/sec). Progress bar with ETA is shown in the terminal during processing.

```
  █████████████████████████░░░░░  82.7%  19,422/23,480  313,258 IPs/s  ETA 0.0s
```

## Notes

- City-level data is available for most public IPs but not all. Some IPs only resolve to country level.
- Private/reserved IP ranges (10.x, 127.x, etc.) will show as failed.
- For more complete city coverage, a paid MaxMind GeoIP2 City database would be needed.
