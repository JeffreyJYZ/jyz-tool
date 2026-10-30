#!/usr/bin/env bun
import { VERSION } from "@jyz/core";
import { cac } from "cac";

const cli = cac("jyz");

cli.version(VERSION);
cli.help();

const args = process.argv.slice(2);

if (args.length === 0) {
	cli.outputHelp();
} else {
	cli.parse(process.argv);
}
