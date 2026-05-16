/**
 *
 * @param {string} name name of the function
 * @param {Record<string,any>} args Named Arguments passed to the function
 * @returns A formatted multi line string that looks more like a python function call than json
 */

export const function_format = (name, args) => `${name}${Object.keys(args).length === 0 ? '()' : `(\n${Object.entries(args).map(([k, v]) => `  ${k} = ${JSON.stringify(v)},`).join("\n")}\n)`}`;
