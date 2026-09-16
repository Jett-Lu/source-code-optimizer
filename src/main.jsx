import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { examples } from './examples';
import './styles.css';

const languages = [{ id: 'js', label: 'JavaScript' }, { id: 'html', label: 'HTML' }, { id: 'css', label: 'CSS' }];
const bytes = value => new TextEncoder().encode(value).length;
const formatBytes = value => value < 1024 ? `${value.toLocaleString()} B` : `${(value / 1024).toFixed(1)} KiB`;
const emptyResults = { js: null, html: null, css: null };

function Editor({ label, value, onChange, placeholder, filename, readOnly }) {
  const gutter = useRef(null);
  const count = Math.min(value.split('\n').length, 3000);
  return <section className="editor" aria-label={`${label} panel`}>
    <div className="editor-heading"><label htmlFor={readOnly ? 'output' : 'source'}>{label}</label><span className="filename" title={filename}>{filename}</span></div>
    <div className="editor-body"><div className="line-numbers" ref={gutter} aria-hidden="true">{Array.from({ length: count }, (_, i) => <div key={i}>{i + 1}</div>)}</div>
      <textarea id={readOnly ? 'output' : 'source'} value={value} onChange={onChange} readOnly={readOnly} placeholder={placeholder} spellCheck="false" autoCapitalize="off" autoCorrect="off" wrap={readOnly ? 'soft' : 'off'} onScroll={event => { if (gutter.current) gutter.current.scrollTop = event.target.scrollTop; }} />
    </div>
  </section>;
}

function App() {
  const [language, setLanguage] = useState('js');
  const [level, setLevel] = useState('balanced');
  const [drafts, setDrafts] = useState({ ...examples });
  const [filenames, setFilenames] = useState({ js: 'example.js', css: 'example.css', html: 'example.html' });
  const [results, setResults] = useState(emptyResults);
  const [preserveLicense, setPreserveLicense] = useState(true);
  const [collapseWhitespace, setCollapseWhitespace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef(null);
  const revision = useRef(0);
  const request = useRef(null);
  const source = drafts[language];
  const result = results[language];
  const filename = filenames[language];

  function invalidate(all = false) {
    revision.current++;
    request.current?.abort();
    setBusy(false); setError(''); setNotice('');
    setResults(prev => all ? { ...emptyResults } : { ...prev, [language]: null });
  }
  function selectLanguage(id) {
    revision.current++; request.current?.abort(); setBusy(false); setError(''); setNotice(''); setLanguage(id);
  }
  async function optimizeCode() {
    const ticket = ++revision.current;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setNotice(''); setResults(prev => ({ ...prev, [language]: null }));
    try {
      const response = await fetch('/api/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, language, level, preserveLicense, collapseWhitespace }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Optimization failed.');
      if (ticket === revision.current) setResults(prev => ({ ...prev, [language]: data }));
    } catch (err) { if (ticket === revision.current && err.name !== 'AbortError') setError(err.message === 'Failed to fetch' ? 'Cannot reach the local optimizer. Restart Source Code Optimizer and try again.' : err.message); }
    finally { if (ticket === revision.current) setBusy(false); }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const extension = file.name.split('.').pop().toLowerCase();
    const detected = ({ js: 'js', mjs: 'js', cjs: 'js', html: 'html', htm: 'html', css: 'css' })[extension];
    if (!detected) { setError('Choose a .js, .mjs, .cjs, .html, .htm, or .css file.'); return; }
    if (file.size > 1048576) { setError('This version accepts files up to 1 MiB.'); return; }
    invalidate(); const ticket = revision.current;
    try {
      const text = await file.text();
      if (ticket !== revision.current) return;
      if (text.includes('\0')) throw new Error('Choose a UTF-8 text file.');
      setDrafts(prev => ({ ...prev, [detected]: text }));
      setFilenames(prev => ({ ...prev, [detected]: file.name }));
      setResults(prev => ({ ...prev, [detected]: null }));
      setLanguage(detected); setNotice(`Imported ${file.name}. Your original is unchanged.`);
    } catch (err) { if (ticket === revision.current) setError(err.message); }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.code], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = filename.replace(/(?:\.min)?\.[^.]+$/, '') + '.min.' + filename.split('.').pop();
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Your optimized copy is ready in Downloads.');
  }
  async function copy() {
    try { await navigator.clipboard.writeText(result.code); setNotice('Optimized code copied.'); }
    catch { setError('Copy is unavailable here. Select the preview text or download the file.'); }
  }

  return <>
    <main><div className="intro"><h1>Source Code Optimizer</h1></div>
      <div className="toolbar"><div className="tabs" role="tablist" aria-label="Code language">{languages.map(item => <button type="button" role="tab" aria-selected={language === item.id} key={item.id} className={language === item.id ? 'tab active' : 'tab'} onClick={() => selectLanguage(item.id)}>{item.label}</button>)}</div><div className="file-actions"><label className="level-picker">Level <select aria-label="Optimization level" value={level} onChange={event => { invalidate(true); setLevel(event.target.value); }}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></select></label><button onClick={() => input.current.click()}>Import file</button><input ref={input} type="file" accept=".js,.mjs,.cjs,.html,.htm,.css" onChange={importFile} hidden/></div></div>
      <div className="editors"><Editor label="Source" filename={filename} value={source} onChange={event => { invalidate(); setDrafts(prev => ({ ...prev, [language]: event.target.value })); }} placeholder="Paste your code here…"/><Editor label="Optimized" filename={filename.replace(/(?:\.min)?\.[^.]+$/, '') + '.min.' + filename.split('.').pop()} value={result?.code ?? ''} readOnly placeholder={busy ? 'Finding a smaller form…' : 'Optimized code appears here.'}/></div>
      <div className="stats" aria-label="Size comparison"><div><strong>{formatBytes(result?.inputBytes ?? bytes(source))}</strong><span>Original</span></div><div><strong>{result ? formatBytes(result.outputBytes) : '—'}</strong><span>Optimized</span></div><div className="saved"><strong>{result ? `${result.savedPercent.toFixed(1)}%` : '—'}</strong><span>{result ? `${formatBytes(result.savedBytes)} saved` : 'Saved'}</span></div></div>
      <div className="actions"><div className="options"><label className="checkbox"><input type="checkbox" checked={preserveLicense} onChange={event => { invalidate(true); setPreserveLicense(event.target.checked); }}/>Preserve license comments</label>{language === 'html' && <label className="checkbox"><input type="checkbox" checked={collapseWhitespace} onChange={event => { invalidate(true); setCollapseWhitespace(event.target.checked); }}/>Collapse text whitespace</label>}</div><div className="output-actions"><button className="primary" disabled={busy || !source.trim()} onClick={optimizeCode}>{busy ? 'Optimizing…' : 'Optimize code'}</button>{result && <button onClick={copy}>Copy</button>}<button disabled={!result || busy} onClick={download}>Download</button></div></div>
      <div className="feedback" aria-live="polite" aria-atomic="true">{error && <p className="error" role="alert">{error}</p>}{notice && <p>{notice}</p>}{language === 'html' && collapseWhitespace && <p>Whitespace collapse can change text spacing.</p>}{result?.warnings.filter(warning => warning.includes('candidate was larger')).map(warning => <p key={warning}>{warning}</p>)}</div>

    </main></>;
}

createRoot(document.getElementById('root')).render(<App/>);
