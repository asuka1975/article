"use strict";

import { readFile, writeFile } from "node:fs/promises";
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

import dayjs from "dayjs";

function prune(data) {
    delete data.position;
    if(data.children) {
        for(const child of data.children) {
            prune(child);
        }
    }
}

async function main() {
    const processor = unified()
        .use(markdown)
        .use(remarkFrontmatter, [{
            type: "yaml",
            marker: "-",
            anywhere: false
        }])
        .use(remarkGfm)
        .use(remark2rehype)

    const filename = process.argv[2];
    const title = filename.replace("manuscripts/", "").replace(/\.md$/, "");
    const hashFilename = CryptoES.MD5(title).toString();
    
    const createdDateString = (await execAsync(`sh -c "git log '${filename}' | grep Date | sed -e 's/Date:\s*//g' | tail -n 1"`)).stdout.trim();
    const createdDate = dayjs(createdDateString).format("YYYY-MM-DD");
    const updatedDate = dayjs().format("YYYY-MM-DD");

    const content = await readFile(filename, "utf-8")
    const parsed = processor.parse(content);
    const frontmatter = { tags: [] };
    if(parsed.children[0].type === "yaml") {
        const parsedFrontmatter = yaml.parse(parsed.children[0].value);
        Object.assign(frontmatter, parsedFrontmatter);
        parsed.children.shift();
    }
    frontmatter.created = createdDate;
    frontmatter.updated = updatedDate === createdDate ? null : updatedDate;

    prune(parsed);
    const json = JSON.stringify({
        title: title,
        content: parsed,
        meta: frontmatter,
    });
    const header = JSON.stringify({ title: title, meta: frontmatter });

    await writeFile(`articles/${hashFilename}.json`, json);
    await writeFile(`headers/${hashFilename}.json`, header);

    const tags = frontmatter.tags;

    for(const tag of tags) {
        const tagInfo = await readFile(`tags/${tag}.json`, "utf-8");
        const tagJson = JSON.parse(tagInfo);
        if(tagJson.articles.indexOf(hashFilename) === -1) {
            tagJson.articles.push(hashFilename);
            await writeFile(`tags/${tag}.json`, JSON.stringify(tagJson));
        }
    }
}


main();