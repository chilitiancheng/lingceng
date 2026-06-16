import fs from "node:fs";
import path from "node:path";

const vaultRoot = "D:\\灵层文档\\灵层";
const outputPath = path.resolve("data/world-data.js");
const canvasPath = path.join(vaultRoot, "阵营", "灵层世界观关系网.canvas");

const categoryByTop = new Map([
  ["名词档案\\世界观概念", "principles"],
  ["名词档案\\职业", "principles"],
  ["角色档案", "characters"],
  ["梦", "dreams"],
  ["阵营", "factions"],
  ["司游", "locations"],
  ["文集", "stories"],
  ["灵层系列合集", "stories"]
]);

function walk(dir) {
  const results = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === ".obsidian" || item.name === "模板") continue;
      results.push(...walk(full));
    } else if (item.isFile() && item.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function normalizeSlashes(value) {
  return value.split(path.sep).join("\\");
}

function categoryFor(relativePath) {
  for (const [prefix, category] of categoryByTop) {
    if (relativePath.startsWith(prefix)) return category;
  }
  return "notes";
}

function stripFrontmatter(content) {
  return content.replace(/^---[\s\S]*?---\s*/, "");
}

function plainText(content) {
  return stripFrontmatter(content)
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/[-·]\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFields(content) {
  const fields = {};
  for (const line of stripFrontmatter(content).split(/\r?\n/)) {
    const match = line.match(/^\s*([^：:]{1,14})[：:]\s*(.+?)\s*$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    if (!key || !value || key.startsWith("#")) continue;
    if (Object.keys(fields).length >= 8) break;
    fields[key] = value.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1");
  }
  return fields;
}

function codeFor(title) {
  const match = title.match(/^([A-Z]-\d{7,}|\w-\d{7,})/);
  return match ? match[1] : "";
}

function statusFor(content) {
  if (/残缺|待解锁|未测量|暂无|不得而知/.test(content)) return "档案残缺";
  return "";
}

function summaryFor(content) {
  const text = plainText(content);
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

const entries = walk(vaultRoot).map((fullPath) => {
  const relativePath = normalizeSlashes(path.relative(vaultRoot, fullPath));
  const content = fs.readFileSync(fullPath, "utf8");
  const basename = path.basename(fullPath, ".md");
  const category = categoryFor(relativePath);
  const plain = plainText(content);
  const fields = extractFields(content);
  return {
    id: Buffer.from(relativePath).toString("base64url"),
    title: basename,
    basename,
    path: relativePath,
    category,
    code: codeFor(basename),
    status: statusFor(content),
    fields,
    summary: summaryFor(content),
    plain,
    content: stripFrontmatter(content).trim(),
    searchText: [basename, relativePath, category, plain, Object.values(fields).join(" ")].join(" ")
  };
}).sort((a, b) => {
  const order = ["principles", "characters", "dreams", "factions", "locations", "stories", "notes"];
  return order.indexOf(a.category) - order.indexOf(b.category) || a.title.localeCompare(b.title, "zh-Hans-CN");
});

function canvasLabel(node) {
  if (node.type === "file") return path.basename(node.file || "", ".md");
  return String(node.label || node.text || "").replace(/^#+\s*/, "").trim();
}

function readCanvas() {
  if (!fs.existsSync(canvasPath)) return null;
  const raw = fs.readFileSync(canvasPath, "utf8");
  const canvas = JSON.parse(raw);
  return {
    source: normalizeSlashes(path.relative(vaultRoot, canvasPath)),
    nodes: (canvas.nodes || []).map((node) => ({
      id: node.id,
      type: node.type,
      label: canvasLabel(node),
      file: node.file || "",
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      color: node.color || ""
    })),
    edges: (canvas.edges || []).map((edge) => ({
      id: edge.id,
      fromNode: edge.fromNode,
      toNode: edge.toNode,
      label: edge.label || ""
    }))
  };
}

const payload = {
  generatedAt: new Date().toISOString(),
  sourceRoot: vaultRoot,
  entries,
  canvas: readCanvas(),
  categories: [...new Set(entries.map((entry) => entry.category))]
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `window.LINGCENG_WORLD_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  "utf8"
);

console.log(`Generated ${entries.length} entries at ${outputPath}`);
