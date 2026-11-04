import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
if (existsSync(".env"))
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(".env", "utf8")),
  ))
    if (process.env[key] === undefined) process.env[key] = value;
