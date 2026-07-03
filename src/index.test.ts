import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import wikilinks, { type WikilinksOptions } from './index.js';

function renderInline(src: string, options: WikilinksOptions = {}, env: Record<string, unknown> = {}): string {
  return new MarkdownIt().use(wikilinks(options)).renderInline(src, env);
}

describe('@global-torque/markdown-it-wikilinks', () => {
  it('renders simple wiki links with the default relative URL behavior', () => {
    expect(renderInline('[[contact]]')).toBe(
      '<a href="./contact.html" title="contact">contact</a>',
    );
  });

  it('renders nested page paths without normalizing the legacy /./ href segment', () => {
    expect(renderInline('[[docs/Main Page]]')).toBe(
      '<a href="/./docs/Main_Page.html" title="docs/Main Page">docs/Main Page</a>',
    );
  });

  it('renders piped labels while keeping the link target from the left side', () => {
    expect(renderInline('[[docs/Main Page|Readable Label]]')).toBe(
      '<a href="/./docs/Main_Page.html" title="Readable Label">Readable Label</a>',
    );
  });

  it('leaves invalid wiki link syntax untouched', () => {
    expect(renderInline('[[missing')).toBe('[[missing');
    expect(renderInline('[[broken\nlink]]')).not.toContain('<a ');
  });

  it('renders anchors with the default hash post-processor', () => {
    expect(renderInline('[[docs/Main Page#Anchor Value]]')).toBe(
      '<a href="/./docs/Main_Page.html#Anchor_Value" title="docs/Main Page">docs/Main Page</a>',
    );
  });

  it('renders custom HTML attributes with escaped values and rejects unsafe names', () => {
    expect(renderInline('[[foo]]', {
      htmlAttributes: {
        class: 'wiki-link',
        'data-label': '"quoted" & raw',
        'bad attr': 'ignored',
      },
    })).toBe(
      '<a href="./foo.html" class="wiki-link" data-label="&quot;quoted&quot; &amp; raw" title="foo">foo</a>',
    );
  });

  it('does not render a duplicate fallback title when a custom title is supplied', () => {
    expect(renderInline('[[foo|Foo]]', {
      htmlAttributes: {
        title: 'Custom title',
      },
    })).toBe('<a href="./foo.html" title="Custom title">Foo</a>');
  });

  it('supports legacy option aliases', () => {
    const generatePageNameFromLabel = vi.fn(() => 'generated page');
    const postProcessPageName = vi.fn(() => 'legacy-page');

    expect(renderInline('[[Original Label]]', {
      generatePageNameFromLabel,
      postProcessPageName,
    })).toBe('<a href="./legacy-page.html" title="Original Label">Original Label</a>');
    expect(generatePageNameFromLabel).toHaveBeenCalledWith('Original Label');
    expect(postProcessPageName).toHaveBeenCalledWith('generated page');
  });

  it('renders tooltip markup from the configured frontmatter field', () => {
    const docsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wikilinks-docs-'));
    fs.writeFileSync(path.join(docsRoot, 'Target.md'), [
      '---',
      'description: Advayta tooltip',
      '---',
      '',
      '# Target',
    ].join('\n'));

    const html = renderInline('[[Target]]', {
      docsRoot,
      tooltipFrontmatterField: 'description',
    });

    expect(html).toContain('<VTooltip as-child>');
    expect(html).toContain('<a href="./Target.html">Target</a>');
    expect(html).toContain('Advayta tooltip');
  });

  it('resolves tooltip text for same-folder relative wiki links', () => {
    const docsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wikilinks-docs-'));
    const folder = path.join(docsRoot, 'section');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'Source.md'), '# Source');
    fs.writeFileSync(path.join(folder, 'Target.md'), [
      '---',
      'summary: Same folder tooltip',
      '---',
      '',
      '# Target',
    ].join('\n'));

    const html = renderInline(
      '[[Target|same folder]]',
      { docsRoot },
      { filePath: path.join(folder, 'Source.md') },
    );

    expect(html).toContain('<VTooltip as-child>');
    expect(html).toContain('<a href="./Target.html">same folder</a>');
    expect(html).toContain('Same folder tooltip');
  });

  it('escapes href, title, attributes, tooltip text, and visible label text', () => {
    const docsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wikilinks-docs-'));
    fs.writeFileSync(path.join(docsRoot, 'bad.md'), [
      '---',
      'summary: <unsafe> & raw',
      '---',
      '',
      '# Bad',
    ].join('\n'));

    const html = renderInline('[[bad|<script>alert("x")</script>]]', {
      docsRoot,
      htmlAttributes: {
        title: '<unsafe>',
      },
    });

    expect(html).toBe(
      '<VTooltip as-child><a href="./bad.html" title="&lt;unsafe&gt;">&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</a><template #content><div>&lt;unsafe&gt; &amp; raw</div></template></VTooltip>',
    );
  });
});
