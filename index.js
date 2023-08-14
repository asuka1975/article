"use strict";

import { readFile, writeFile } from "node:fs/promises";

import { unified } from 'unified';
import markdown from 'remark-parse';
import remarkGfm from 'remark-gfm'
import remark2rehype from 'remark-rehype';

import CryptoES from 'crypto-es';


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
        .use(remarkGfm)
        .use(remark2rehype)

    const filename = process.argv[2];
    const hashFilename = CryptoES.MD5(filename).toString();

    const content = await readFile(filename, "utf-8")
    const parsed = processor.parse(content);
    prune(parsed);
    const json = JSON.stringify({
        title: filename.replace(/\.md$/, ""),
        content: parsed
    });

    await writeFile(`articles/${hashFilename}.json`, json);
}


main();