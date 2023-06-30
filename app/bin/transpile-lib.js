#!/usr/bin/env node

const path = require("path");

module.exports = async function (dir1 = path.join(__dirname, "lib"), ...dirs) {
    for (const dir of [dir1, ...dirs]) {
        const fs = require("fs").promises;
        const files = await fs.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const ext = path.extname(file);
            if (ext === ".ts" && !ext.endsWith(("d.ts"))) {
                const jsFilePath = filePath.replace(".ts", ".js");
                try {
                    const tsStats = await fs.stat(filePath);
                    const jsStats = await fs.stat(jsFilePath);
                    if (tsStats.mtime <= jsStats.mtime) {
                        continue;
                    }
                } catch (err) {
                    if (err.code !== "ENOENT") {
                        console.error(`Could not stat the JavaScript file.`, err);
                        continue;
                    }
                }
                // TypeScript file is newer or corresponding JS file does not exist
                const sourceCode = await fs.readFile(filePath, "utf8");
                const ts = require("typescript");
                const result = ts.transpileModule(sourceCode, {
                    compilerOptions: {module: ts.ModuleKind.CommonJS},
                });
                await fs.writeFile(jsFilePath, result.outputText);
            }
        }
    }
}

// module.exports = transpileIfNeeded().catch((err) => {
//     console.error("Error while transpiling TypeScript files", err);
// });
