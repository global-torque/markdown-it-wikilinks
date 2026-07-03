import fs from 'node:fs';
import path from 'node:path';
import { Url } from './url.js';
const WIKILINK_REGEX = /^\[\[([^|\]\n]+)(\|([^\]\n]+))?\]\]/;
const INITIAL_HASH_REGEX = /^#/;
const DIR_SEPARATOR_REGEX = /[/\\]/g;
const ILLEGAL_FILENAME_CHARS_REGEX = /[/\\?<>:*|"]/g;
const CONTROL_FILENAME_CHARS_REGEX = /[\u0000-\u001f\u0080-\u009f]/g;
const RESERVED_FILENAME_REGEX = /^\.+$/;
const WINDOWS_RESERVED_FILENAME_REGEX = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const WINDOWS_TRAILING_FILENAME_REGEX = /[. ]+$/g;
const MAX_FILENAME_BYTES = 255;
const SAFE_ATTRIBUTE_NAME_REGEX = /^[^\s"'<>/=]+$/;
const docsFileIndexByRoot = new Map();
export default function wikilinks(options = {}) {
    const normalizedOptions = normalizeOptions(options);
    return (md) => {
        md.inline.ruler.before('link', 'wikilink', wikilinkInlineRule);
        md.renderer.rules.wikilink = (tokens, idx, _markdownOptions, env = {}) => {
            const meta = tokens[idx].meta;
            return renderWikilink(meta, normalizedOptions, env);
        };
    };
}
const wikilinkInlineRule = (state, silent) => {
    const start = state.pos;
    if (start + 3 >= state.posMax
        || state.src.charCodeAt(start) !== 0x5b
        || state.src.charCodeAt(start + 1) !== 0x5b) {
        return false;
    }
    const match = WIKILINK_REGEX.exec(state.src.slice(start));
    if (!match) {
        return false;
    }
    if (silent) {
        return true;
    }
    const token = state.push('wikilink', '', 0);
    token.markup = match[0];
    token.content = match[0];
    token.meta = {
        originalPagePath: match[1],
        rawLabel: match[3] ?? match[1],
        isSplit: match[3] !== undefined,
    };
    state.pos += match[0].length;
    return true;
};
function normalizeOptions(options) {
    return {
        baseURL: options.baseURL ?? '/',
        relativeBaseURL: options.relativeBaseURL ?? './',
        makeAllLinksAbsolute: options.makeAllLinksAbsolute ?? false,
        uriSuffix: options.uriSuffix ?? '.html',
        htmlAttributes: { ...(options.htmlAttributes ?? {}) },
        generatePagePathFromLabel: (options.generatePageNameFromLabel
            ?? options.generatePagePathFromLabel
            ?? defaultGeneratePagePathFromLabel),
        postProcessPagePath: (options.postProcessPageName
            ?? options.postProcessPagePath
            ?? defaultPostProcessPagePath),
        postProcessPageHash: options.postProcessPageHash ?? defaultPostProcessPageHash,
        postProcessLabel: options.postProcessLabel ?? defaultPostProcessLabel,
        docsRoot: options.docsRoot ?? 'docs',
        tooltipFrontmatterFields: normalizeTooltipFrontmatterFields(options.tooltipFrontmatterField),
    };
}
function normalizeTooltipFrontmatterFields(fields) {
    const normalizedFields = Array.isArray(fields) ? fields : [fields ?? 'summary'];
    return normalizedFields.map((field) => field.trim()).filter((field) => field !== '');
}
function renderWikilink(meta, options, env) {
    let label = meta.rawLabel;
    const pagePath = meta.isSplit
        ? meta.originalPagePath
        : options.generatePagePathFromLabel(meta.originalPagePath);
    const absoluteBaseDirs = pathStrToArray(options.baseURL);
    const relativeBaseDirs = pathStrToArray(options.relativeBaseURL);
    let pageUrl = new Url(pagePath);
    if (pageUrl.file) {
        const file = options.postProcessPagePath(pagePath);
        pageUrl = new Url(file);
    }
    if (pageUrl.hash) {
        pageUrl = pageUrl.set({
            hash: options.postProcessPageHash(pageUrl.hash),
        });
    }
    label = options.postProcessLabel(label);
    if (isAbsolute(pagePath, options)) {
        pageUrl = pageUrl.set({
            root: '/',
            dirs: absoluteBaseDirs.concat(pageUrl.dirs ?? []),
        });
    }
    else if (pageUrl.file) {
        const dirs = relativeBaseDirs.concat(pageUrl.dirs ?? []);
        pageUrl = pageUrl.set({
            root: dirs.length > 1 ? '/' : null,
            dirs,
        });
    }
    if (pageUrl.file && options.uriSuffix) {
        pageUrl = pageUrl.set({
            file: `${pageUrl.file}${options.uriSuffix}`,
        });
    }
    let href = pageUrl.toString();
    const dirs = pageUrl.dirs ?? [];
    if (dirs.length >= 2 && dirs[1].startsWith('http')) {
        href = meta.originalPagePath;
    }
    const htmlAttrsString = renderHtmlAttributes(href, options.htmlAttributes);
    const escapedLabel = escapeHtml(label);
    const tooltip = readTooltipText(meta.originalPagePath, env, options);
    const hasCustomTitle = hasRenderableHtmlAttribute('title', options.htmlAttributes);
    if (tooltip !== '') {
        return `<VTooltip as-child><a ${htmlAttrsString}>${escapedLabel}</a><template #content><div>${escapeHtml(tooltip)}</div></template></VTooltip>`;
    }
    return `<a ${htmlAttrsString}${hasCustomTitle ? '' : ` title="${escapeHtmlAttribute(label)}"`}>${escapedLabel}</a>`;
}
function defaultGeneratePagePathFromLabel(label) {
    return label;
}
function defaultPostProcessPagePath(pagePath) {
    return pagePath
        .trim()
        .split('/')
        .map(sanitizePathSegment)
        .join('/')
        .replace(/\s+/g, '_');
}
function defaultPostProcessPageHash(pageHash) {
    return pageHash
        .trim()
        .split('/')
        .map(sanitizePathSegment)
        .join('/')
        .replace(/\s+/g, '_');
}
function defaultPostProcessLabel(label) {
    const trimmedLabel = label.trim();
    if (INITIAL_HASH_REGEX.test(trimmedLabel)) {
        return trimmedLabel.replace(INITIAL_HASH_REGEX, '');
    }
    return trimmedLabel.replace(/#[^#]*$/, '');
}
function isAbsolute(pagePath, options) {
    return options.makeAllLinksAbsolute || pagePath.charCodeAt(0) === 0x2f;
}
function pathStrToArray(pathStr) {
    return pathStr.split(DIR_SEPARATOR_REGEX).filter((dirName) => dirName !== '');
}
function sanitizePathSegment(segment) {
    const sanitized = segment
        .replace(ILLEGAL_FILENAME_CHARS_REGEX, '')
        .replace(CONTROL_FILENAME_CHARS_REGEX, '')
        .replace(RESERVED_FILENAME_REGEX, '')
        .replace(WINDOWS_RESERVED_FILENAME_REGEX, '')
        .replace(WINDOWS_TRAILING_FILENAME_REGEX, '');
    return truncateUtf8Bytes(sanitized, MAX_FILENAME_BYTES);
}
function truncateUtf8Bytes(value, maxBytes) {
    const encoder = new TextEncoder();
    let output = '';
    let byteLength = 0;
    for (const char of value) {
        const nextByteLength = encoder.encode(char).length;
        if (byteLength + nextByteLength > maxBytes) {
            break;
        }
        output += char;
        byteLength += nextByteLength;
    }
    return output;
}
function renderHtmlAttributes(href, htmlAttributes) {
    const attrs = [`href="${escapeHtmlAttribute(href)}"`];
    Object.entries(htmlAttributes).forEach(([attrName, attrValue]) => {
        if (!SAFE_ATTRIBUTE_NAME_REGEX.test(attrName) || attrValue === null || attrValue === undefined) {
            return;
        }
        attrs.push(`${attrName}="${escapeHtmlAttribute(String(attrValue))}"`);
    });
    return attrs.join(' ');
}
function hasRenderableHtmlAttribute(attrName, htmlAttributes) {
    const attrValue = htmlAttributes[attrName];
    return SAFE_ATTRIBUTE_NAME_REGEX.test(attrName) && attrValue !== null && attrValue !== undefined;
}
function readTooltipText(originalPagePath, env, options) {
    for (const filePath of getTooltipFileCandidates(originalPagePath, env, options.docsRoot)) {
        try {
            const linkFile = fs.readFileSync(filePath, 'utf8');
            const frontmatterMatch = /^---\s*\n([\s\S]*?)\n---/.exec(linkFile);
            const frontmatter = frontmatterMatch?.[1] ?? '';
            const tooltip = readFrontmatterFields(frontmatter, options.tooltipFrontmatterFields);
            if (tooltip !== '') {
                return tooltip;
            }
        }
        catch {
            // Try the next candidate path.
        }
    }
    return '';
}
function readFrontmatterFields(frontmatter, fields) {
    for (const field of fields) {
        const fieldMatch = new RegExp(`^${escapeRegExp(field)}:\\s*(.*)$`, 'm').exec(frontmatter);
        const value = stripWrappingQuotes(fieldMatch?.[1].trim() ?? '');
        if (value !== '') {
            return value;
        }
    }
    return '';
}
function getTooltipFileCandidates(originalPagePath, env, docsRootOption) {
    const docsRoot = path.resolve(docsRootOption);
    const pagePath = stripHash(originalPagePath).trim();
    if (pagePath === '' || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(pagePath)) {
        return [];
    }
    const markdownPath = pagePath.endsWith('.md') ? pagePath : `${pagePath}.md`;
    const candidates = [];
    const addCandidate = (candidate) => {
        const resolved = path.resolve(candidate);
        if ((resolved === docsRoot || resolved.startsWith(`${docsRoot}${path.sep}`))
            && !candidates.includes(resolved)) {
            candidates.push(resolved);
        }
    };
    const currentPagePath = resolveCurrentMarkdownPath(env, docsRoot);
    if (currentPagePath && !path.isAbsolute(markdownPath)) {
        addCandidate(path.join(path.dirname(currentPagePath), markdownPath));
    }
    addCandidate(path.join(docsRoot, markdownPath.replace(/^[/\\]+/, '')));
    let legacyRootPath = markdownPath;
    while (legacyRootPath.startsWith('../')) {
        legacyRootPath = legacyRootPath.slice(3);
    }
    addCandidate(path.join(docsRoot, legacyRootPath));
    addUniqueBasenameCandidate(markdownPath, docsRoot, addCandidate);
    return candidates;
}
function addUniqueBasenameCandidate(markdownPath, docsRoot, addCandidate) {
    const fileName = path.basename(markdownPath);
    const matches = getDocsFileIndex(docsRoot).get(fileName.toLowerCase()) ?? [];
    if (matches.length === 1) {
        addCandidate(matches[0]);
    }
}
function getDocsFileIndex(docsRoot) {
    const resolvedRoot = path.resolve(docsRoot);
    const cachedIndex = docsFileIndexByRoot.get(resolvedRoot);
    if (cachedIndex) {
        return cachedIndex;
    }
    const index = new Map();
    collectMarkdownFiles(resolvedRoot, index);
    docsFileIndexByRoot.set(resolvedRoot, index);
    return index;
}
function collectMarkdownFiles(directory, index) {
    if (!fs.existsSync(directory)) {
        return;
    }
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            collectMarkdownFiles(filePath, index);
            return;
        }
        if (entry.isFile() && entry.name.endsWith('.md')) {
            const key = entry.name.toLowerCase();
            const matches = index.get(key) ?? [];
            matches.push(filePath);
            index.set(key, matches);
        }
    });
}
function resolveCurrentMarkdownPath(env, docsRoot) {
    if (env.filePath) {
        return path.isAbsolute(env.filePath) ? env.filePath : path.join(docsRoot, env.filePath);
    }
    if (env.path) {
        return path.isAbsolute(env.path) ? env.path : path.resolve(env.path);
    }
    if (env.relativePath) {
        return path.join(docsRoot, env.relativePath);
    }
    return null;
}
function stripHash(value) {
    return value.split('#')[0];
}
function stripWrappingQuotes(value) {
    if ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function escapeHtmlAttribute(value) {
    return escapeHtml(value);
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return char;
        }
    });
}
//# sourceMappingURL=index.js.map