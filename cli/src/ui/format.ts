// ANSI escape helpers — zero dependencies

const esc = (code: string) => `\x1b[${code}m`;
const wrap = (code: string, reset: string) => (text: string) => `${esc(code)}${text}${esc(reset)}`;

export const bold = wrap('1', '22');
export const dim = wrap('2', '22');
export const italic = wrap('3', '23');

export const red = wrap('31', '39');
export const green = wrap('32', '39');
export const yellow = wrap('33', '39');
export const blue = wrap('34', '39');
export const magenta = wrap('35', '39');
export const cyan = wrap('36', '39');
export const white = wrap('37', '39');
export const gray = wrap('90', '39');

export const bgGreen = wrap('42', '49');
export const bgRed = wrap('41', '49');
export const bgYellow = wrap('43', '49');

export const heading = (text: string) => bold(cyan(text));
export const serverName = (text: string) => bold(yellow(text));
export const toolName = (text: string) => green(text);
export const error = (text: string) => bold(red(text));
export const success = (text: string) => green(text);

export function badge(label: string, color: 'green' | 'yellow' | 'red'): string {
  const bg = color === 'green' ? bgGreen : color === 'yellow' ? bgYellow : bgRed;
  return bg(bold(` ${label} `));
}
