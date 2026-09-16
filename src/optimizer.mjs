import { minify as minifyJS } from 'terser';
import CleanCSS from 'clean-css';
import { minify as minifyHTML } from 'html-minifier-terser';
import postcss from 'postcss';
import { parse } from 'acorn';

export const MAX_BYTES = 1024 * 1024;
const licensePattern = /@license|@preserve|copyright|^!/i;

export async function optimize({ source, language, level = 'balanced', preserveLicense = true, collapseWhitespace = false } = {}) {
  if (!['conservative', 'balanced', 'aggressive'].includes(level)) throw new Error('Choose a valid optimization level: conservative, balanced, or aggressive.');
  const aggressive = level === 'aggressive';
  const conservative = level === 'conservative';
  if (!['js', 'css', 'html'].includes(language)) throw new Error('Choose JavaScript, HTML, or CSS.');
  if (typeof source !== 'string' || !source.trim()) throw new Error('Add some code before optimizing.');
  const inputBytes = Buffer.byteLength(source, 'utf8');
  if (inputBytes > MAX_BYTES) throw new Error('This version accepts files up to 1 MiB.');
  if (typeof preserveLicense !== 'boolean' || typeof collapseWhitespace !== 'boolean') throw new Error('Invalid optimization options.');
  let code;
  const checks = [];
  const warnings = [];
  if (language === 'js') {
    let sourceType = 'script';
    try { parse(source, { ecmaVersion: 'latest', sourceType }); }
    catch { sourceType = 'module'; parse(source, { ecmaVersion: 'latest', sourceType }); }
    const result = await minifyJS(source, {
      // Keep public bindings; module mode would implicitly enable top-level removal.
      module: false, toplevel: false, keep_fnames: !aggressive, keep_classnames: !aggressive,
      compress: conservative ? false : { defaults: true, unsafe: false, passes: aggressive ? 5 : 2, keep_fargs: true, directives: false },
      mangle: conservative ? false : { toplevel: false, properties: false, keep_fnames: !aggressive, keep_classnames: !aggressive },
      format: { comments: preserveLicense ? licensePattern : false },
    });
    code = result.code;
    parse(code, { ecmaVersion: 'latest', sourceType });
    checks.push('JavaScript syntax checked', 'Public names preserved');
    warnings.push('Behavior is not automatically verified. Test the exported file in your project.');
  } else if (language === 'css') {
    const root = postcss.parse(source);
    // Normalize recognized license comments so clean-css keeps them.
    root.walkComments(comment => {
      if (!preserveLicense || !licensePattern.test(comment.text)) { comment.remove(); return; }
      if (preserveLicense && licensePattern.test(comment.text) && !comment.text.startsWith('!')) comment.text = '!' + comment.text;
    });
    const result = new CleanCSS({
      inline: ['none'], rebase: false,
      level: conservative ? 0 : { 1: { specialComments: preserveLicense ? 'all' : 0 }, 2: aggressive },
    }).minify(root.toString());
    if (result.errors.length) throw new Error(result.errors.join(' '));
    // Do not silently discard malformed rules that a forgiving optimizer repairs.
    if (result.warnings.length) throw new Error('CSS needs review: ' + result.warnings.join(' '));
    code = result.styles;
    postcss.parse(code);
    checks.push('CSS syntax parsed', 'External imports left untouched');
    warnings.push('Check appearance in your project. Browser compatibility is not automatically tested.');
  } else {
    code = await minifyHTML(source, {
      removeComments: true,
      ignoreCustomComments: preserveLicense ? [licensePattern] : [],
      collapseWhitespace, conservativeCollapse: true,
      removeAttributeQuotes: aggressive, removeOptionalTags: false,
      minifyJS: false, minifyCSS: false,
      caseSensitive: true, keepClosingSlash: true,
    });
    checks.push('HTML processed', 'Embedded scripts and styles preserved');
    warnings.push('HTML processing is not full validation. Test layout and behavior in your project.');
    if (collapseWhitespace) warnings.push('Whitespace collapse can change text spacing and white-space CSS behavior.');
  }
  if (Buffer.byteLength(code, 'utf8') > inputBytes) {
    code = source;
    warnings.push('The optimized candidate was larger; your original was kept.');
  }
  const outputBytes = Buffer.byteLength(code, 'utf8');
  return { code, level, inputBytes, outputBytes, savedBytes: inputBytes - outputBytes,
    savedPercent: ((inputBytes - outputBytes) / inputBytes) * 100, checks, warnings };
}
