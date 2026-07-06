import type MarkdownIt from 'markdown-it';
type StringTransformer = (value: string) => string;
type HtmlAttributeValue = string | number | boolean | null | undefined;
type HtmlAttributes = Record<string, HtmlAttributeValue>;
export interface WikilinksOptions {
    baseURL?: string;
    relativeBaseURL?: string;
    makeAllLinksAbsolute?: boolean;
    uriSuffix?: string;
    htmlAttributes?: HtmlAttributes;
    generatePagePathFromLabel?: StringTransformer;
    postProcessPagePath?: StringTransformer;
    postProcessPageHash?: StringTransformer;
    postProcessLabel?: StringTransformer;
    postProcessPageName?: StringTransformer;
    generatePageNameFromLabel?: StringTransformer;
    docsRoot?: string;
    tooltipFrontmatterField?: string | string[];
}
export default function wikilinks(options?: WikilinksOptions): (md: MarkdownIt) => void;
export {};
//# sourceMappingURL=index.d.ts.map