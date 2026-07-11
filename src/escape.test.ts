import { escapeHtml, escapeHtmlAttribute } from "./escape.js";

describe("HTML escaping", () => {
  it("escapes every special character and preserves ordinary text", () => {
    expect(escapeHtml("&<>\"' ordinary")).toBe(
      "&amp;&lt;&gt;&quot;&#39; ordinary",
    );
    expect(escapeHtmlAttribute('"<&')).toBe("&quot;&lt;&amp;");
  });

  it("satisfies the escaping property for a generated fuzz corpus", () => {
    let state = 0x12345678;
    const next = () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state;
    };
    const alphabet = "abcXYZ09&<>\"'\u0000\u2028é";
    const reference = (value: string) => {
      let result = "";
      for (const character of value) {
        switch (character) {
          case "&":
            result += "&amp;";
            break;
          case "<":
            result += "&lt;";
            break;
          case ">":
            result += "&gt;";
            break;
          case '"':
            result += "&quot;";
            break;
          case "'":
            result += "&#39;";
            break;
          default:
            result += character;
        }
      }
      return result;
    };

    for (let sample = 0; sample < 1_024; sample += 1) {
      let value = "";
      const length = next() % 96;
      for (let index = 0; index < length; index += 1) {
        value += alphabet[next() % alphabet.length] ?? "";
      }
      expect(escapeHtml(value)).toBe(reference(value));
      expect(escapeHtmlAttribute(value)).toBe(reference(value));
    }
  });
});
