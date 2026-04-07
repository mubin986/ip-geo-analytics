const geoip = require("geoip-lite");

function lookupCity(ip) {
  const geo = geoip.lookup(ip);
  if (!geo) return null;
  return {
    ip,
    city: geo.city || "Unknown",
    region: geo.region || "Unknown",
    country: geo.country || "Unknown",
    timezone: geo.timezone || "Unknown",
    ll: geo.ll,
  };
}

// CLI usage
if (require.main === module) {
  const ip = process.argv[2];

  if (!ip) {
    console.error("Usage: node index.js <ip-address>");
    process.exit(1);
  }

  const result = lookupCity(ip);

  if (!result) {
    console.error(`No geolocation data found for IP: ${ip}`);
    process.exit(1);
  }

  console.log(`IP:       ${result.ip}`);
  console.log(`City:     ${result.city}`);
  console.log(`Region:   ${result.region}`);
  console.log(`Country:  ${result.country}`);
  console.log(`Timezone: ${result.timezone}`);
  console.log(`Lat/Lng:  ${result.ll[0]}, ${result.ll[1]}`);
}

module.exports = { lookupCity };
