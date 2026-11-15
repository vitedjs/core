import { describe, expect, it } from 'vitest';

import { applyPageMetadata } from './html';

const shell = '<!doctype html>\n<html>\n  <head>\n    <title>Vited</title>\n  </head>\n</html>\n';

describe('applyPageMetadata()', () => {
  it('formats the document title as `<page title> – <site title>`', () => {
    expect(applyPageMetadata(shell, { title: 'My Docs' }, {}, { title: 'Guide' })).toContain(
      '<title>Guide – My Docs</title>',
    );
  });

  it('uses the package name as the site title when none is configured', () => {
    expect(applyPageMetadata(shell, {}, { name: 'my-docs' }, { title: 'Guide' })).toContain(
      '<title>Guide – my-docs</title>',
    );
  });

  it('does not repeat a page title that matches the site title', () => {
    expect(applyPageMetadata(shell, { title: 'My Docs' }, {}, { title: 'My Docs' })).toContain(
      '<title>My Docs</title>',
    );
  });
});
