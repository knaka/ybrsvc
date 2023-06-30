#!/usr/bin/env node

const dns = require("dns");
const util = require("util");
const url = require("url");

const resolveSrv = util.promisify(dns.resolveSrv)

async function resolveUrlSrv(urlStr: string) {
  const parsedUrl = new url.URL(urlStr);
  try {
    const records = await resolveSrv(parsedUrl.hostname);
    if (records.length > 0) {
      const srvRecord = records[0]
      parsedUrl.hostname = srvRecord.name
      parsedUrl.port = srvRecord.port
    }
  } catch (err) {}
  return parsedUrl.toString()
}

if (require.main === module) {
  (async () => {
    console.log(await resolveUrlSrv(process.argv[2]))
  })();
} else {
  module.exports = resolveUrlSrv
}
