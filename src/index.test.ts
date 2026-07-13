import MarkdownIt from "markdown-it";
import wikilinks, { type WikilinksOptions } from "./index.js";

function renderInline(
  source: string,
  options: WikilinksOptions = {},
  env: Readonly<Record<string, unknown>> = {},
): string {
  return new MarkdownIt().use(wikilinks(options)).renderInline(source, env);
}

describe("@global-torque/markdown-it-wikilinks core", () => {
  it("renders escaped ordinary anchors without framework markup", () => {
    expect(renderInline("[[contact]]")).toBe(
      '<a href="./contact.html" title="contact">contact</a>',
    );
    expect(renderInline("[[docs/Main Page|Readable Label]]")).toBe(
      '<a href="./docs/Main_Page.html" title="Readable Label">Readable Label</a>',
    );
  });

  it("leaves incomplete and multiline syntax as text", () => {
    expect(renderInline("[[missing")).toBe("[[missing");
    expect(renderInline("[[broken\nlink]]")).not.toContain("<a ");
  });

  it("supports anchors, current-page anchors, queries, Unicode, and existing escapes", () => {
    expect(renderInline("[[docs/Café%20Menu?mode=full#À la carte]]")).toBe(
      '<a href="./docs/Café%20Menu.html?mode=full#À_la_carte" title="docs/Café%20Menu?mode=full">docs/Café%20Menu?mode=full</a>',
    );
    expect(renderInline("[[#Current Heading]]")).toBe(
      '<a href="#Current_Heading" title="Current Heading">Current Heading</a>',
    );
  });

  it("keeps unlabeled query and fragment boundaries outside host path generation", () => {
    const generatePagePathFromLabel = vi.fn((path: string) =>
      path.toLowerCase().replaceAll(" ", "-"),
    );
    expect(
      renderInline("[[Guide Page?mode=full#Current Heading]]", {
        generatePagePathFromLabel,
        uriSuffix: "",
      }),
    ).toContain('href="./guide-page?mode=full#Current_Heading"');
    expect(
      renderInline("[[#Current Heading]]", {
        generatePagePathFromLabel,
        uriSuffix: "",
      }),
    ).toContain('href="#Current_Heading"');
    expect(generatePagePathFromLabel).toHaveBeenNthCalledWith(1, "Guide Page");
    expect(generatePagePathFromLabel).toHaveBeenCalledTimes(1);
  });

  it.each([
    "https://example.test/a?q=1#two",
    "http://example.test/a",
    "mailto:hello@example.test?subject=Hi",
    "tel:+12025550123",
  ])("preserves the supported external destination %s", (target) => {
    expect(renderInline(`[[${target}|external]]`)).toContain(
      `href="${target.replaceAll("&", "&amp;")}"`,
    );
  });

  it("neutralizes unsupported executable schemes", () => {
    expect(renderInline("[[javascript:alert(1)|unsafe]]")).toBe(
      '<a href="#" title="unsafe">unsafe</a>',
    );
  });

  it("joins absolute, forced-absolute, relative, and parent destinations without /./", () => {
    expect(renderInline("[[/guide/start]]", { baseURL: "/docs/" })).toContain(
      'href="/docs/guide/start.html"',
    );
    expect(
      renderInline("[[guide/start]]", {
        baseURL: "https://example.test/base",
        makeAllLinksAbsolute: true,
      }),
    ).toContain('href="https://example.test/base/guide/start.html"');
    expect(
      renderInline("[[guide/start]]", { relativeBaseURL: "../" }),
    ).toContain('href="../guide/start.html"');
    expect(renderInline("[[../sibling]]")).toContain('href="../sibling.html"');
  });

  it("applies the clean path callbacks only to their defined boundaries", () => {
    const generatePagePathFromLabel = vi.fn(
      () => "generated page?keep=yes#Heading Here",
    );
    const postProcessPagePath = vi.fn((value: string) =>
      value.replace("generated page", "page"),
    );
    expect(
      renderInline("[[Original Label]]", {
        generatePagePathFromLabel,
        postProcessPagePath,
        uriSuffix: "",
      }),
    ).toBe(
      '<a href="./page?keep=yes#Heading_Here" title="Original Label">Original Label</a>',
    );
    expect(generatePagePathFromLabel).toHaveBeenCalledWith("Original Label");
    expect(postProcessPagePath).toHaveBeenCalledWith("generated page");
  });

  it("supports a synchronous host href resolver", () => {
    expect(
      renderInline("[[target]]", {
        resolveHref: (context) => `/resolved?from=${context.defaultHref}`,
      }),
    ).toContain('href="/resolved?from=./target.html"');
  });

  it.each([
    "javascript:alert(1)",
    " JaVaScRiPt:alert(1) ",
    "java\u0000script:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ])("neutralizes an unsafe host-resolved destination %s", (destination) => {
    expect(
      renderInline("[[target|Target]]", {
        resolveHref: () => destination,
      }),
    ).toContain('href="#"');
  });

  it.each([
    "/resolved/path?mode=full#section",
    "../relative/path",
    "https://example.test/resolved",
    "mailto:security@example.test",
  ])("preserves a safe host-resolved destination %s", (destination) => {
    expect(
      renderInline("[[target|Target]]", {
        resolveHref: () => destination,
      }),
    ).toContain(`href="${destination}"`);
  });

  it("falls tooltip text back to a standard title without a UI renderer", () => {
    expect(
      renderInline("[[target|Target]]", {
        resolveTooltip: () => "Safe tooltip",
      }),
    ).toBe('<a href="./target.html" title="Safe tooltip">Target</a>');
  });

  it("delegates optional framework markup to the host renderer", () => {
    expect(
      renderInline("[[target|Target]]", {
        resolveTooltip: () => "<unsafe> & text",
        renderTooltip: ({ anchorHtml, escapedTooltip, href }) =>
          `<HostTooltip data-href="${href}">${anchorHtml}<span>${escapedTooltip}</span></HostTooltip>`,
      }),
    ).toBe(
      '<HostTooltip data-href="./target.html"><a href="./target.html">Target</a><span>&lt;unsafe&gt; &amp; text</span></HostTooltip>',
    );
  });

  it("escapes all anchor-controlled values and rejects unsafe or reserved attributes", () => {
    expect(
      renderInline("[[bad<label>?a=1&b=2|<script>'\"&</script>]]", {
        htmlAttributes: {
          class: "wiki-link",
          title: "<custom & title>",
          "data-state": "ready",
          "aria-label": "safe anchor",
          href: "javascript:override()",
          onclick: "alert(1)",
          onmouseover: "alert(2)",
          style: "background: url(javascript:alert(3))",
          formaction: "javascript:alert(4)",
          srcdoc: "<script>alert(5)</script>",
          "xlink:href": "javascript:alert(6)",
          "bad attr": "ignored",
          empty: null,
          missing: undefined,
          enabled: false,
        },
      }),
    ).toBe(
      '<a href="./badlabel.html?a=1&amp;b=2" class="wiki-link" title="&lt;custom &amp; title&gt;" data-state="ready" aria-label="safe anchor">&lt;script&gt;&#39;&quot;&amp;&lt;/script&gt;</a>',
    );
  });

  it("treats HTML attribute names case-insensitively when applying title fallback", () => {
    expect(
      renderInline("[[target|Target]]", {
        htmlAttributes: { TITLE: "Host title" },
        resolveTooltip: () => "Resolved tooltip",
      }),
    ).toBe('<a href="./target.html" TITLE="Host title">Target</a>');
  });

  it("does not mutate caller options or attributes", () => {
    const attributes = { class: "original" };
    const options: WikilinksOptions = { htmlAttributes: attributes };
    const plugin = wikilinks(options);
    attributes.class = "changed";
    expect(new MarkdownIt().use(plugin).renderInline("[[target]]")).toContain(
      'class="original"',
    );
  });

  it("escapes a deterministic corpus without producing raw markup", () => {
    for (const value of [
      "<",
      ">",
      "&",
      '"',
      "'",
      "<img src=x>",
      "plain",
      "é",
    ]) {
      const html = renderInline(`[[target|${value}]]`);
      expect(html).not.toContain("<img");
      expect(html.startsWith("<a ")).toBe(true);
      expect(html.endsWith("</a>")).toBe(true);
    }
  });

  it("fuzzes generated labels, destinations, attributes, and tooltip text", () => {
    let state = 0x9e3779b9;
    const next = () => {
      state =
        (Math.imul(state ^ (state >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0;
      return state;
    };
    const alphabet = "abcXYZ09 &<>\"'`=/script:onerror";

    for (let sample = 0; sample < 512; sample += 1) {
      let value = "";
      const length = next() % 48;
      for (let index = 0; index < length; index += 1) {
        value += alphabet[next() % alphabet.length] ?? "";
      }
      const html = renderInline("[[safe|Generated]]", {
        htmlAttributes: { "data-fuzz": value },
        resolveHref: () => `/safe?q=${value}`,
        resolveTooltip: () => value,
      });

      expect(html.startsWith('<a href="')).toBe(true);
      expect(html.endsWith("</a>")).toBe(true);
      expect(html.match(/<a /g)).toHaveLength(1);
      expect(html.match(/<\/a>/g)).toHaveLength(1);
      expect(html).not.toContain("<script");
      expect(html).not.toContain("<img");
      expect(html).not.toContain('onerror="');
    }
  });
});
