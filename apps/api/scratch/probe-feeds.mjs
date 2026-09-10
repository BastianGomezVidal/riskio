// Standalone probe — runs with `node scratch/probe-feeds.mjs`
// Goal: see what the NHC feeds actually contain right now.

const feeds = [
  { name: 'Atlantic summary', url: 'https://www.nhc.noaa.gov/index-at.xml' },
  { name: 'East Pacific summary', url: 'https://www.nhc.noaa.gov/index-ep.xml' },
  { name: 'Central Pacific summary', url: 'https://www.nhc.noaa.gov/index-cp.xml' },
];

for (const { name, url } of feeds) {
  console.log(`\n════════════════════════════════════════`);
  console.log(`  ${name}`);
  console.log(`  ${url}`);
  console.log(`════════════════════════════════════════`);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Riskio/0.1 (dev probe)' },
    });
    console.log(`Status: ${res.status} ${res.statusText}`);

    const text = await res.text();
    console.log(`Body size: ${text.length} bytes`);

    // Extract all <title> values
    const titles = [...text.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
    console.log(`Found ${titles.length} <title> tags:`);
    titles.forEach((t) => console.log(`  • ${t}`));

    // Extract all <pubDate> values
    const dates = [...text.matchAll(/<pubDate>([^<]*)<\/pubDate>/g)].map((m) => m[1]);
    if (dates.length) {
      console.log(`PubDates:`);
      dates.forEach((d) => console.log(`  • ${d}`));
    }

    // First 300 chars of raw body for structure inspection
    console.log(`\nFirst 300 chars of raw body:`);
    console.log(text.slice(0, 300));
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
  }
}

console.log('\n════════════════════════════════════════');
console.log('  Probe complete.');
console.log('════════════════════════════════════════');