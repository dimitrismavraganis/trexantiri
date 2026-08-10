#!/usr/bin/env node
'use strict';

/**
 * Builds the bilingual site into dist/.
 *
 *   dist/index.html      English (default)
 *   dist/el/index.html   Greek
 *
 * The .html files at the repo root are the single source of truth and are
 * authored in Greek. English is produced by looking each Greek string up in
 * i18n/en.json, so there is only ever one copy of the markup to maintain.
 *
 * Most strings are matched by their exact Greek text, which keeps the source
 * files free of markup noise. Two places need the structure itself to change
 * between languages, and those carry an explicit attribute:
 *
 *   data-i18n="key"        replace the element's inner HTML wholesale
 *   data-i18n-words="key"  re-split a headline into per-word animated spans
 *
 * If a Greek string has no entry in en.json the build leaves it alone and
 * lists it at the end, so a copy edit that outruns its translation is loud
 * rather than silent.
 */

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://trexantiri.vercel.app';
const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

const PAGES = ['index.html', 'about.html', 'menu.html', 'contact.html'];
const STATIC_DIRS = ['css', 'js', 'assets'];

// The default language is served at the root; the other one under /<dir>/.
const LANGS = [
  { code: 'en', dir: '', short: 'ΕΛ', long: 'Ελληνικά', other: 'el' },
  { code: 'el', dir: 'el', short: 'EN', long: 'English', other: 'en' },
];

const ATTRS_TO_TRANSLATE = ['alt', 'aria-label', 'content', 'title'];

// ---------------------------------------------------------------- utilities

const GREEK = /[Ͱ-Ͽἀ-῿]/;

function hasGreek(s) {
  return GREEK.test(s);
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function encodeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function encodeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Runs `fn` over the parts of the document that are real markup, leaving the
 * contents of <script> and <style> untouched.
 */
function mapMarkup(html, fn) {
  const raw = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let out = '';
  let last = 0;
  let m;
  while ((m = raw.exec(html)) !== null) {
    out += fn(html.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(html.slice(last));
}

/** Finds the close tag matching an open tag, accounting for nesting. */
function findCloseTag(html, from, tagName) {
  const re = new RegExp('<(/?)' + tagName + '(?=[\\s/>])', 'gi');
  re.lastIndex = from;
  let depth = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1] !== '/') {
      depth++;
      continue;
    }
    if (depth === 0) return { start: m.index, end: html.indexOf('>', m.index) + 1 };
    depth--;
  }
  throw new Error('Unclosed <' + tagName + '> in source');
}

/** Replaces the inner HTML of every element carrying `marker="key"`. */
function replaceInner(html, marker, resolve) {
  const needle = marker + '="';
  let out = '';
  let pos = 0;
  for (;;) {
    const at = html.indexOf(needle, pos);
    if (at === -1) return out + html.slice(pos);

    const keyEnd = html.indexOf('"', at + needle.length);
    const key = html.slice(at + needle.length, keyEnd);
    const tagStart = html.lastIndexOf('<', at);
    const tagName = /^<([a-zA-Z0-9]+)/.exec(html.slice(tagStart))[1];
    const openEnd = html.indexOf('>', keyEnd);
    const close = findCloseTag(html, openEnd + 1, tagName);

    const current = html.slice(openEnd + 1, close.start);
    const replacement = resolve(key, current);

    out += html.slice(pos, openEnd + 1);
    out += replacement === undefined ? current : replacement;
    pos = close.start;
  }
}

// ------------------------------------------------------------- translation

function translateTextNodes(html, dict, missing) {
  return mapMarkup(html, (chunk) =>
    chunk.replace(/>([^<]+)</g, (whole, text) => {
      const parts = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
      const [, lead, body, tail] = parts;
      if (!body) return whole;

      const key = decodeEntities(body);
      if (!Object.prototype.hasOwnProperty.call(dict, key)) {
        if (hasGreek(key)) missing.add(key);
        return whole;
      }
      return '>' + lead + encodeText(dict[key]) + tail + '<';
    })
  );
}

function translateAttributes(html, dict, missing) {
  return mapMarkup(html, (chunk) =>
    chunk.replace(/<[a-zA-Z][^>]*>/g, (tag) => {
      let out = tag;
      for (const attr of ATTRS_TO_TRANSLATE) {
        const re = new RegExp('(\\s' + attr + '=")([^"]*)(")');
        out = out.replace(re, (whole, open, value, close) => {
          const key = decodeEntities(value);
          if (!Object.prototype.hasOwnProperty.call(dict, key)) {
            if (hasGreek(key)) missing.add(key);
            return whole;
          }
          return open + encodeAttr(dict[key]) + close;
        });
      }
      return out;
    })
  );
}

/** Rebuilds the per-word animated spans of a headline in the target language. */
function translateWordSpans(html, dict, missing) {
  return replaceInner(html, 'data-i18n-words', (key, current) => {
    const style = /style="([^"]*)"/.exec(current);
    if (!style) throw new Error('data-i18n-words="' + key + '" has no styled spans');

    const phrase = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : null;
    if (phrase === null) {
      if (hasGreek(key)) missing.add(key);
      return undefined;
    }
    return (
      '\n' +
      phrase
        .split(/\s+/)
        .map((w) => '          <span data-word style="' + style[1] + '">' + encodeText(w) + '</span>')
        .join('\n') +
      '\n        '
    );
  });
}

function applyExplicitOverrides(html, dict, missing) {
  return replaceInner(html, 'data-i18n', (key) => {
    if (!Object.prototype.hasOwnProperty.call(dict, key)) {
      missing.add(key);
      return undefined;
    }
    return dict[key];
  });
}

// ------------------------------------------------------------- URL rewiring

function pageUrl(page, dir) {
  const base = dir ? '/' + dir : '';
  // vercel.json sets trailingSlash:false, so /el/ 308s to /el. Emit the form
  // that is already canonical and skip the redirect. The site root is the one
  // URL that keeps its slash.
  return page === 'index.html' ? base || '/' : base + '/' + page.replace(/\.html$/, '');
}

function rewriteUrls(html, dir) {
  return html
    // Internal page links, resolved against the language root so they work
    // identically at / and at /el/.
    .replace(/href="(index|about|menu|contact)\.html(#[^"]*)?"/g, (whole, name, hash) =>
      'href="' + pageUrl(name + '.html', dir) + (hash || '') + '"'
    )
    // Shared assets live once at the output root, so both languages point at
    // the same absolute path.
    .replace(/(src|href)="(assets|css|js)\//g, '$1="/$2/');
}

function setLangSwitch(html, page, lang) {
  const target = pageUrl(page, LANGS.find((l) => l.code === lang.other).dir);
  return html.replace(
    /<a([^>]*?)href="[^"]*"([^>]*?)data-lang-switch="(short|long)"([^>]*)>[\s\S]*?<\/a>/g,
    (whole, before, mid, size, after) =>
      '<a' + before + 'href="' + target + '"' + mid + 'data-lang-switch="' + size + '"' + after + '>' +
      (size === 'short' ? lang.short : lang.long) +
      '</a>'
  );
}

function injectHead(html, page, lang) {
  const links = [
    '<link rel="canonical" href="' + SITE_URL + pageUrl(page, lang.dir) + '">',
    ...LANGS.map(
      (l) => '<link rel="alternate" hreflang="' + l.code + '" href="' + SITE_URL + pageUrl(page, l.dir) + '">'
    ),
    '<link rel="alternate" hreflang="x-default" href="' + SITE_URL + pageUrl(page, '') + '">',
  ];
  return html
    .replace(/<html lang="[^"]*"/, '<html lang="' + lang.code + '"')
    .replace('</head>', links.map((l) => l + '\n').join('') + '</head>');
}

/**
 * Tags Greek leaf elements on the English pages with lang="el".
 *
 * The menu keeps a subtitle in the other language next to each section
 * heading, and those subtitles are rendered through text-transform:uppercase.
 * Greek drops its accents in all caps (Μπύρες → ΜΠΥΡΕΣ), but browsers only
 * apply that rule when the element is marked as Greek — inside lang="en" they
 * fall back to English casing and leave the tonos on. It also lets screen
 * readers switch voice for the Greek fragments.
 *
 * Only the English build needs this: English text on the Greek pages has no
 * equivalent casing rule, so marking it would add noise for no effect.
 */
function markGreekFragments(html) {
  return mapMarkup(html, (chunk) =>
    chunk.replace(/<([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"]|"[^"]*")*)>([^<]+)<\/\1>/g,
      (whole, tag, attrs, text) => {
        if (/\slang="/.test(attrs)) return whole;
        if (!hasGreek(decodeEntities(text).trim())) return whole;
        return '<' + tag + attrs + ' lang="el">' + text + '</' + tag + '>';
      }
    )
  );
}

function stripBuildAttributes(html) {
  return html.replace(/\sdata-i18n(?:-words)?="[^"]*"/g, '');
}

// ------------------------------------------------------------------- build

function buildPage(source, page, lang, dict, missing) {
  let html = source;
  // A null dictionary means this is the language the source is written in.
  if (dict) {
    // Structural replacements go first: they swap whole subtrees, so running
    // them before the text pass keeps their Greek out of the missing report.
    html = applyExplicitOverrides(html, dict, missing);
    html = translateWordSpans(html, dict, missing);
    html = translateTextNodes(html, dict, missing);
    html = translateAttributes(html, dict, missing);
    html = markGreekFragments(html);
  }
  html = rewriteUrls(html, lang.dir);
  html = setLangSwitch(html, page, lang);
  html = injectHead(html, page, lang);
  return stripBuildAttributes(html);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

function main() {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'en.json'), 'utf8'));
  const missing = new Map();

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  for (const lang of LANGS) {
    // Greek is the language the source is written in, so it needs no dictionary.
    const table = lang.code === 'el' ? null : dict;
    const gaps = new Set();
    const dir = lang.dir ? path.join(OUT, lang.dir) : OUT;
    fs.mkdirSync(dir, { recursive: true });

    for (const page of PAGES) {
      const source = fs.readFileSync(path.join(ROOT, page), 'utf8');
      fs.writeFileSync(path.join(dir, page), buildPage(source, page, lang, table, gaps));
    }
    if (gaps.size) missing.set(lang.code, gaps);
    console.log('  ' + (lang.dir ? '/' + lang.dir + '/' : '/') + ' → ' + PAGES.length + ' pages (' + lang.code + ')');
  }

  for (const dir of STATIC_DIRS) copyDir(path.join(ROOT, dir), path.join(OUT, dir));
  console.log('  static → ' + STATIC_DIRS.join(', '));

  for (const [code, gaps] of missing) {
    console.warn('\n  ' + gaps.size + ' string(s) with no ' + code + ' translation in i18n/en.json:');
    for (const s of gaps) console.warn('    · ' + s);
  }
  console.log('\nBuilt ' + PAGES.length * LANGS.length + ' pages into dist/');
}

main();
