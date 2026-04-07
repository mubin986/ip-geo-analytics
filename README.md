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
  { "ip": "206.189.131.1" }
]
```

**Array of strings:**
```json
[
  "8.8.8.8",
  "206.189.131.1"
]
```

**Mixed:**
```json
[
  { "ip": "8.8.8.8" },
  "206.189.131.1"
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

### Single IP Lookup

```bash
node index.js 206.189.131.1
```

Output:

```
IP:       206.189.131.1
City:     Bengaluru
Region:   KA
Country:  IN
Timezone: Asia/Kolkata
Lat/Lng:  12.9634, 77.5855
```

### As a Module

```js
const { lookupCity } = require("./index");

const result = lookupCity("157.240.1.35");
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
