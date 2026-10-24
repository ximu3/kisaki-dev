// Exercise lexical replay and tree repair independently of publication-specific styling.
export const markupCases = [
  ['plain-and-astral', '<p>甲😀e\u0301 Straße</p>'],
  ['references', '<p>&amp;&NotEqualTilde;&#x1f600;&notit; &quot x</p>'],
  ['crlf-and-carriage-return', '<p>A\r\nB\rC\nD</p>'],
  ['less-than-replay', '<p>A< B<😀C</p>'],
  ['less-than-at-eof', '<p>A<'],
  ['end-tag-at-eof', '<p>A</'],
  ['textarea-replay', '<textarea>\nA</wrong>B<😀C&amp;</textarea>'],
  ['title-replay', '<title>A</wrong>B< C&amp;</title><p>body</p>'],
  ['rawtext-replay', '<xmp>A</wrong>B< C</xmp>'],
  ['script-replay', '<script>A</wrong>B<!---->< C</script><p>body</p>'],
  ['script-double-escape', '<script><!--<script>test</script>--></script><p>body</p>'],
  ['script-replacement', '<script><!--A\0--B\0--></script><p>body</p>'],
  ['foreign-cdata', '<svg><![CDATA[A]B]]C]]]D😀]]></svg>'],
  ['foreign-cdata-eof', '<svg><![CDATA[A]]'],
  ['foreign-content', '<svg><text>甲&amp;乙</text><foreignObject><p>丙</p></foreignObject></svg>'],
  ['foreign-null-replacement', '<svg><text>A\0B</text></svg>'],
  [
    'math-content',
    '<math><mtext>甲</mtext><annotation-xml encoding="text/html"><p>乙</p></annotation-xml></math>'
  ],
  ['foster-parenting', '<div>A<table>before<tr><td>cell</td></tr>after</table>Z</div>'],
  ['formatting-reconstruction', '<p><b id="bold">A<i>B</b>C</i>D</p>'],
  ['adoption-agency', '<b id="bold">A<p>B</b>C</p>'],
  ['nested-anchors', '<a id="first">A<a id="second">B</a>C</a>'],
  ['implied-paragraphs', '<p id="one">A<p id="two">B<div>C</div>D'],
  ['implicit-table-elements', '<table><td>A<td>B</table>'],
  ['select-filtering', '<select><option>A<div>ignored-tag</div><option>B</select>'],
  ['duplicate-attributes', '<p id="first" id="second">A</p>'],
  ['merged-body-tags', '<html><head></head><body>A<body class="later">B</body></html>'],
  ['template-content', '<template><table>A<tr><td>B</td></tr></table></template><p>C</p>'],
  ['noscript-disabled', '<noscript><p>A&amp;B</p></noscript><p>C</p>'],
  ['leading-newline-pre', '<pre>\r\nA\r\nB</pre><listing>\nC</listing>'],
  ['null-in-data', '<p>A\0B</p><textarea>C\0D</textarea>'],
  ['literal-ampersands', '<p>&not-a-reference; &x &#no &#xno &amp</p>'],
  ['head-and-body-repair', '<title>A</title>before<body>B<head><meta charset="utf-8">C'],
  ['frameset-replaces-body', '<html><body> <frameset><frame src="about:blank"></frameset></html>'],
  ['comments-and-doctype', '<!doctype html><!--x--><p>A<!--y-->B<?z?>C</p>'],
  ['eof-in-markup', '<p>A<span title="unfinished'],
  ['supplementary-replay', '<textarea><😀</😀</textarea><svg><![CDATA[]😀]]😀]]></svg>']
].map(([name, source]) => ({ name, source }))

export const chunks = [1, 2, 7, 4096]
