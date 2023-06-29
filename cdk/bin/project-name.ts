console.log(
  JSON.parse(require('fs').readFileSync(`${__dirname}/../cdk.json`))["context"]["project-name"],
)
