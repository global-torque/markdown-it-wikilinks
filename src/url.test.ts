import { createWikilinkHref } from "./url.js";

describe("createWikilinkHref", () => {
  it("handles empty, suffixed, transformed, and absolute bases", () => {
    expect(createWikilinkHref("")).toBe("#");
    expect(createWikilinkHref("page.html")).toBe("./page.html");
    expect(createWikilinkHref("page", { uriSuffix: "" })).toBe("./page");
    expect(
      createWikilinkHref("page", {
        makeAllLinksAbsolute: true,
        baseURL: "",
      }),
    ).toBe("page.html");
    expect(
      createWikilinkHref("/page", { baseURL: "https://example.test/base/" }),
    ).toBe("https://example.test/base/page.html");
  });

  it("removes controls and encodes unsafe fragment characters once", () => {
    expect(createWikilinkHref("\u0000page#one%20two`<>")).toBe(
      "./page.html#one%20two%60%3C%3E",
    );
  });

  it("preserves dot segments and strips invalid path filename characters", () => {
    expect(createWikilinkHref("../a:<b>")).toBe("../ab.html");
  });
});
