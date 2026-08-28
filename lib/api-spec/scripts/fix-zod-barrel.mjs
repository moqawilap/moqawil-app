import { writeFile } from "node:fs/promises";

const barrel = new URL("../../api-zod/src/index.ts", import.meta.url);
await writeFile(barrel, 'export * from "./generated/api";\nexport * as ApiTypes from "./generated/types";\n');