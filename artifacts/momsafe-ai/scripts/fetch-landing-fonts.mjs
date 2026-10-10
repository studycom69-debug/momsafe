import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const fontsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/fonts",
);

const files = [
  {
    name: "inter-latin.woff2",
    url: "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2",
  },
  {
    name: "plus-jakarta-sans-latin.woff2",
    url: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2",
  },
];

fs.mkdirSync(fontsDir, { recursive: true });

for (const { name, url } of files) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(fontsDir, name), buf);
  console.log(`${name}: ${buf.length} bytes`);
}

const css = `/* Self-hosted homepage typography (latin); font-display: swap */
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 400 600;
  font-display: swap;
  src: url("/fonts/inter-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: "Plus Jakarta Sans";
  font-style: normal;
  font-weight: 600 700;
  font-display: swap;
  src: url("/fonts/plus-jakarta-sans-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`;

fs.writeFileSync(path.join(fontsDir, "../landing-fonts.css"), css);
console.log("Wrote public/landing-fonts.css");
