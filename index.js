"use strict";

import { readFile, writeFile } from "node:fs/promises";

import { unified } from 'unified';
import markdown from 'remark-parse';
import remarkFrontmatter from "remark-frontmatter";
import yaml from "yaml";
import remarkGfm from 'remark-gfm'
import remark2rehype from 'remark-rehype';

import CryptoES from 'crypto-es';
import { inspect } from "node:util";


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
    const hashFilename = CryptoES.MD5(filename).toString();

    const content = await readFile(filename, "utf-8")
    const parsed = processor.parse(content);
    const frontmatter = { tags: [] };
    if(parsed.children[0].type === "yaml") {
        const parsedFrontmatter = yaml.parse(parsed.children[0].value);
        Object.assign(frontmatter, parsedFrontmatter);
        parsed.children.shift();
    }

    prune(parsed);
    const json = JSON.stringify({
        title: filename.replace(/\.md$/, ""),
        content: parsed,
        meta: frontmatter
    });

    await writeFile(`articles/${hashFilename}.json`, json);
}


main();