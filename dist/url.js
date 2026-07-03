const SCHEME_REGEX = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
export class Url {
    scheme;
    host;
    root;
    dirs;
    file;
    hash;
    constructor(input = {}) {
        const parts = typeof input === 'string' ? parse(input) : cloneParts(input);
        this.scheme = parts.scheme;
        this.host = parts.host;
        this.root = parts.root;
        this.dirs = parts.dirs;
        this.file = parts.file;
        this.hash = parts.hash;
        Object.freeze(this);
    }
    set(patch) {
        const next = {
            scheme: this.scheme,
            host: this.host,
            root: this.root,
            dirs: this.dirs ? [...this.dirs] : undefined,
            file: this.file,
            hash: this.hash,
        };
        if ('scheme' in patch) {
            next.scheme = patch.scheme;
        }
        if ('host' in patch) {
            next.host = patch.host;
        }
        if ('root' in patch) {
            next.root = patch.root ? '/' : patch.root;
        }
        if ('dirs' in patch) {
            next.dirs = patch.dirs && patch.dirs.length > 0 ? [...patch.dirs] : undefined;
        }
        if ('file' in patch) {
            next.file = patch.file;
        }
        if ('hash' in patch) {
            next.hash = patch.hash;
        }
        return new Url(next);
    }
    toString() {
        let output = '';
        if (this.scheme !== undefined) {
            output += `${this.scheme}:`;
        }
        if (this.host !== undefined) {
            output += `//${this.host}`;
        }
        if (this.root === '/') {
            output += '/';
        }
        if (this.dirs && this.dirs.length > 0) {
            output += `${this.dirs.join('/')}/`;
        }
        if (this.file !== undefined) {
            output += this.file;
        }
        if (this.hash !== undefined) {
            output += `#${encodeFragment(this.hash)}`;
        }
        return output;
    }
}
function cloneParts(parts) {
    return {
        scheme: parts.scheme,
        host: parts.host,
        root: parts.root,
        dirs: parts.dirs ? [...parts.dirs] : undefined,
        file: parts.file,
        hash: parts.hash,
    };
}
function parse(rawInput) {
    const input = rawInput.replace(/[\t\n\r]/g, '');
    let hash;
    let rest = input;
    const hashAt = rest.indexOf('#');
    if (hashAt !== -1) {
        hash = decodeFragment(rest.slice(hashAt + 1));
        rest = rest.slice(0, hashAt);
    }
    let scheme;
    let host;
    const schemeMatch = SCHEME_REGEX.exec(rest);
    if (schemeMatch) {
        scheme = schemeMatch[1];
        rest = rest.slice(schemeMatch[0].length);
        if (rest.startsWith('//')) {
            const authority = rest.slice(2);
            const pathAt = authority.search(/[/?#]/);
            if (pathAt === -1) {
                host = authority;
                rest = '';
            }
            else {
                host = authority.slice(0, pathAt);
                rest = authority.slice(pathAt);
            }
        }
    }
    const { root, dirs, file } = parsePath(rest);
    return { scheme, host, root, dirs, file, hash };
}
function parsePath(pathValue) {
    const root = pathValue.startsWith('/') ? '/' : undefined;
    const segments = pathValue.split('/');
    if (root) {
        segments.shift();
    }
    const fileSegment = segments.pop();
    const file = fileSegment === '' || fileSegment === undefined ? undefined : fileSegment;
    const dirs = segments.length > 0 ? segments : undefined;
    return { root, dirs, file };
}
function decodeFragment(raw) {
    const encoder = new TextEncoder();
    const bytes = [];
    for (let i = 0; i < raw.length; i += 1) {
        const char = raw[i];
        if (char === '%'
            && i + 2 <= raw.length - 1
            && /^[0-9a-fA-F]{2}$/.test(raw.slice(i + 1, i + 3))) {
            bytes.push(parseInt(raw.slice(i + 1, i + 3), 16));
            i += 2;
        }
        else {
            const codePoint = raw.codePointAt(i);
            if (codePoint === undefined) {
                continue;
            }
            const charBytes = encoder.encode(String.fromCodePoint(codePoint));
            bytes.push(...charBytes);
            if (codePoint > 0xffff) {
                i += 1;
            }
        }
    }
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
    }
    catch {
        return raw;
    }
}
function shouldEncode(char) {
    const codePoint = char.codePointAt(0);
    return (codePoint !== undefined
        && (codePoint < 0x20
            || char === ' '
            || char === '"'
            || char === '<'
            || char === '>'
            || char === '`'
            || char === '%'));
}
function encodeFragment(hash) {
    let output = '';
    for (const char of hash) {
        output += shouldEncode(char) ? encodeURIComponent(char) : char;
    }
    return output;
}
export default Url;
//# sourceMappingURL=url.js.map