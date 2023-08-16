import { readFile, writeFile, rm } from "node:fs/promises";
import { inspect, promisify } from "node:util";
import { exec } from "node:child_process";
const execAsync = promisify(exec);

import { unified } from 'unified';
import markdown from 'remark-parse';
import remarkFrontmatter from "remark-frontmatter";
import yaml from "yaml";
import remarkGfm from 'remark-gfm'
import remark2rehype from 'remark-rehype';

import CryptoES from 'crypto-es';

async function main() {
    const filename = process.argv[2];

    const title = filename.replace("manuscripts/", "").replace(/\.md$/, "");
    const hashFilename = CryptoES.MD5(title).toString();

    await rm(`articles/${hashFilename}.json`);
    await rm(`headers/${hashFilename}.json`);

    const index = await readFile("index.json", "utf-8");
    const indexJson = JSON.parse(index);
    await writeFile("index.json", JSON.stringify(
        indexJson.filter((item) => item.id !== hashFilename)
    ));


    const files = (await execAsync(`sh -c "grep -r -I 'e348ae98b7f15489d56bef4c06d42511' tags | sed -e 's/:.*//g'"`)).stdout.split("\n");
    console.log(files)
    
    for(const file of files) {
        if(file === "") continue;
        const content = await readFile(file, "utf-8");
        const json = JSON.parse(content);
        const newJson = {
            ...json,
            articles: json.articles.filter((tag) => tag !== hashFilename)
        };
        await writeFile(file, JSON.stringify(newJson));
    }
}

main();