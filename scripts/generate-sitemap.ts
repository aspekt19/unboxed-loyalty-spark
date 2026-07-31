/**
 * Sitemap generator for loyalspark.online.
 *
 * Parses <Route path="..."> entries from src/App.tsx so future route
 * additions/removals stay in sync without manually editing public/sitemap.xml.
 *
 * Runs automatically via the Vite plugin exported below (wired in
 * vite.config.ts), and can also be executed standalone with
 *   `bunx tsx scripts/generate-sitemap.ts`
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const BASE_URL = "https://loyalspark.online";

// Routes that exist in the router but should NOT be indexed.
// - admin / native / preview / pitch are internal or device-specific
// - /premium is a redirect-only stub
// - "*" is the catch-all NotFound
const EXCLUDE = new Set<string>([
  "*",
  "/admin",
  "/premium",
  "/preview-3d",
  "/native/shopper",
  "/native/business",
]);

// Per-route metadata. Anything not listed here gets sensible defaults.
const META: Record<
  string,
  { changefreq?: string; priority?: string }
> = {
  "/": { changefreq: "weekly", priority: "1.0" },
  "/app": { changefreq: "weekly", priority: "0.9" },
  "/merchant": { changefreq: "weekly", priority: "0.9" },
  "/customer": { changefreq: "weekly", priority: "0.8" },
  "/api-docs": { changefreq: "weekly", priority: "0.9" },
  "/for-agents": { changefreq: "weekly", priority: "0.95" },
  "/pricing": { changefreq: "monthly", priority: "0.85" },
  "/guide": { changefreq: "monthly", priority: "0.7" },
  "/install": { changefreq: "monthly", priority: "0.5" },
  "/pitch": { changefreq: "monthly", priority: "0.6" },
  "/legal/terms": { changefreq: "yearly", priority: "0.4" },
  "/legal/privacy": { changefreq: "yearly", priority: "0.4" },
  "/legal/refund": { changefreq: "yearly", priority: "0.4" },
};

// Static, non-router assets that must stay in the sitemap for agent discovery.
const EXTRA_PATHS: string[] = ["/llms.txt"];
META["/llms.txt"] = { changefreq: "weekly", priority: "0.85" };

function projectRoot(): string {
  // When invoked as a module, resolve relative to this file; when invoked
  // standalone via tsx, process.cwd() is also the project root.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function extractRoutes(appSource: string): string[] {
  const routes = new Set<string>();
  const re = /<Route\s+path=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(appSource)) !== null) {
    routes.add(match[1]);
  }
  return [...routes];
}

function buildXml(paths: string[], lastmod: string): string {
  const ordered = [...paths].sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });

  const urls = ordered.map((path) => {
    const meta = META[path] ?? { changefreq: "monthly", priority: "0.5" };
    return [
      "  <url>",
      `    <loc>${BASE_URL}${path === "/" ? "/" : path}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      meta.changefreq ? `    <changefreq>${meta.changefreq}</changefreq>` : null,
      meta.priority ? `    <priority>${meta.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    "",
  ].join("\n");
}

export function generateSitemap(): {
  outputPath: string;
  routeCount: number;
} {
  const root = projectRoot();
  const appPath = resolve(root, "src/App.tsx");
  const outputPath = resolve(root, "public/sitemap.xml");

  const source = readFileSync(appPath, "utf8");
  const allRoutes = extractRoutes(source);
  const indexable = [...allRoutes.filter((p) => !EXCLUDE.has(p)), ...EXTRA_PATHS];

  const lastmod = new Date().toISOString().slice(0, 10);
  const xml = buildXml(indexable, lastmod);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, xml);

  return { outputPath, routeCount: indexable.length };
}

/** Vite plugin: regenerates the sitemap on dev server start and before build. */
export function sitemapPlugin(): Plugin {
  let ran = false;
  const run = (origin: string) => {
    if (ran) return;
    ran = true;
    try {
      const { routeCount } = generateSitemap();
      // eslint-disable-next-line no-console
      console.log(`[sitemap] ${origin}: wrote public/sitemap.xml (${routeCount} routes)`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[sitemap] ${origin}: skipped`, err);
    }
  };

  return {
    name: "loyalspark-sitemap",
    apply: () => true,
    configResolved() {
      run("configResolved");
    },
    buildStart() {
      ran = false;
      run("buildStart");
    },
  };
}

// Allow `bunx tsx scripts/generate-sitemap.ts` (or `node --loader tsx ...`)
// to run the generator standalone.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("generate-sitemap.ts");
if (invokedDirectly) {
  const { outputPath, routeCount } = generateSitemap();
  // eslint-disable-next-line no-console
  console.log(`sitemap.xml written to ${outputPath} (${routeCount} routes)`);
}
