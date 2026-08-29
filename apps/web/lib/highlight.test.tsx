import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { highlightText } from './highlight';

describe('highlightText', () => {
  it('marks an exact evidence phrase without losing surrounding text', () => {
    const output = renderToStaticMarkup(
      <p>
        {highlightText('The agreement requires 99.95% monthly uptime.', ['99.95% monthly uptime'])}
      </p>,
    );
    expect(output).toContain('<mark>99.95% monthly uptime</mark>');
    expect(output).toContain('The agreement requires');
  });

  it('escapes punctuation in search terms', () => {
    const output = renderToStaticMarkup(<p>{highlightText('Target is 99.9%.', ['99.9%'])}</p>);
    expect(output).toContain('<mark>99.9%</mark>');
  });
});
