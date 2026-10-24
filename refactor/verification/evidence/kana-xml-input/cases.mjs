// Normal syntax and namespace cases deliberately accompany incomplete-content observations.
export const xhtmlPublicId = '-//W3C//DTD XHTML 1.1//EN'
export const cases = [
  { name: 'characters-and-whitespace', source: '<p> A&#65;&amp;B </p>', text: ' AA&B ' },
  {
    name: 'line-end-and-attribute-normalization',
    source: '<p a="A\r\nB&#13;C">A\r\nB\rC&#13;D</p>',
    text: 'A\nB\nC\rD',
    attributes: [['a', 'A B\rC']]
  },
  {
    name: 'adjacent-text-cdata-comment-pi',
    source: '<p>a<![CDATA[b]]><!-- x --><?skip x?>c</p>',
    text: 'abc',
    childCount: 1
  },
  {
    name: 'internal-text-entity',
    source: '<!DOCTYPE p [<!ENTITY word "内部😀">]><p>&word;</p>',
    text: '内部😀'
  },
  {
    name: 'internal-markup-entity',
    source: '<!DOCTYPE p [<!ENTITY word "<em>inside</em>">]><p>A&word;B</p>',
    text: 'AinsideB',
    childElement: 'em'
  },
  {
    name: 'internal-parameter-entity',
    source: '<!DOCTYPE p [<!ENTITY % decl "<!ENTITY word \'inside\'>">%decl;]><p>&word;</p>',
    text: 'inside'
  },
  {
    name: 'internal-default-attribute',
    source: '<!DOCTYPE p [<!ATTLIST p a NMTOKENS " A   B ">]><p/>',
    text: '',
    attributes: [['a', 'A B']]
  },
  {
    name: 'unused-external-general-declaration',
    source: '<!DOCTYPE p [<!ENTITY ext SYSTEM "https://xml-input.invalid/ext">]><p>safe</p>',
    text: 'safe'
  },
  {
    name: 'used-external-general-entity',
    source:
      '<!DOCTYPE p [<!ENTITY ext SYSTEM "https://xml-input.invalid/ext">]><p>left&ext;right</p>',
    reject: true
  },
  {
    name: 'unknown-external-subset-without-reference',
    source: '<!DOCTYPE p SYSTEM "https://xml-input.invalid/subset"><p>safe</p>',
    text: 'safe'
  },
  {
    name: 'unknown-external-subset-needed-entity',
    source: '<!DOCTYPE p SYSTEM "https://xml-input.invalid/subset"><p>left&missing;right</p>',
    reject: true
  },
  {
    name: 'external-parameter-needed-entity',
    source:
      '<!DOCTYPE p [<!ENTITY % decl SYSTEM "https://xml-input.invalid/subset">%decl;]><p>left&missing;right</p>',
    reject: true
  },
  { name: 'unbound-namespace-prefix', source: '<p><x:a/></p>', reject: true },
  {
    name: 'duplicate-expanded-attribute',
    source: '<p xmlns:a="urn:x" xmlns:b="urn:x" a:q="1" b:q="2"/>',
    reject: true
  },
  {
    name: 'namespace-and-attribute',
    source: '<p xmlns="urn:p" xmlns:a="urn:a" a:q="value"><a:b>text</a:b></p>',
    text: 'text',
    namespace: 'urn:p',
    attributes: [['urn:a\x1fq', 'value']]
  },
  { name: 'invalid-character-reference', source: '<p>A&#0;B</p>', reject: true },
  { name: 'xml-control-reference', source: '<p>&#128;</p>', text: '\u0080' },
  { name: 'undefined-entity', source: '<p>&missing;</p>', reject: true },
  { name: 'recursive-entity', source: '<!DOCTYPE p [<!ENTITY a "&a;">]><p>&a;</p>', reject: true },
  { name: 'incomplete-element', source: '<p><b>A</p>', reject: true },
  {
    name: 'xhtml-standard-catalog',
    mime: 'application/xhtml+xml',
    catalog: true,
    source: `<!DOCTYPE html PUBLIC "${xhtmlPublicId}" "https://xml-input.invalid/xhtml.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><body><p>A&nbsp;B&copy;C&NotEqualTilde;</p></body></html>`,
    text: 'A\u00a0B©C≂̸'
  },
  {
    name: 'xhtml-no-doctype-named-entity',
    mime: 'application/xhtml+xml',
    source: '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>A&nbsp;B</p></body></html>',
    reject: true
  },
  {
    name: 'xhtml-unknown-subset-named-entity',
    mime: 'application/xhtml+xml',
    source:
      '<!DOCTYPE html SYSTEM "https://xml-input.invalid/unknown.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><body><p>A&nbsp;B</p></body></html>',
    reject: true
  },
  {
    name: 'xhtml-internal-catalog-override',
    mime: 'application/xhtml+xml',
    catalog: true,
    source: `<!DOCTYPE html PUBLIC "${xhtmlPublicId}" "https://xml-input.invalid/xhtml.dtd" [<!ENTITY copy "local">]><html xmlns="http://www.w3.org/1999/xhtml"><body>&copy;</body></html>`,
    text: 'local'
  }
]
