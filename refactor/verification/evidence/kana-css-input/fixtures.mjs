// Original controlled author styles exercise source order, URL roles, and attribute semantics.
export const files = new Map([
  [
    '/book/styles/main.css',
    String.raw`@layer base,theme;
@import "../shared/base.css" layer(base) supports(display:block) screen;
@layer theme{.target{color:rgb(40,50,60);padding-inline-start:9px!important;font-size:calc(var(--size) + 1px)}}
@property --registered-paper{syntax:"<url>";inherits:true;initial-value:url("../art/paper.svg")}
.target{--registered-paper:url("../art/inline.svg")}
.target{background-image:url(../art/p\61 per.svg)}
.custom{background-image:var(--paper)}
@media(min-width:500px){.target{font-size:calc(var(--size) + 4px)}}
@supports(background-image:url("not-a-resource-check.svg")){.target{letter-spacing:1px}}
@supports(display:not-a-display-value){.target{background-image:url("../art/not-needed.svg")}}
.viewport{inline-size:10vw;block-size:10vh}
.resource[src="art/paper.svg"]{outline:3px solid rgb(120,30,80)}
.target[style*="url('art/inline.svg')"]{border-block-end:4px solid rgb(20,80,140)}
a{display:inline-block;white-space:nowrap;font:10px/1 monospace}
a[href="chapter.xhtml#target"]{text-decoration-thickness:3px}
a::after{content:attr(href)}
.literal::before{content:"page-break-before:page url(../never.svg)";display:none}
`
  ],
  [
    '/book/shared/base.css',
    `@import "nested.css";
.target{color:rgb(10,20,30);padding-inline-start:3px!important;--paper:url("paper.svg")}
`
  ],
  ['/book/shared/nested.css', '.target{--size:18px}'],
  [
    '/book/styles/svg.css',
    `@namespace svg url("http://www.w3.org/2000/svg");
@namespace x url("http://www.w3.org/1999/xlink");
svg|rect{fill:rgb(20,130,70)}
svg|use[x|href="art/symbol.svg#shape"]{opacity:0.4}
svg|use[*|href="art/symbol.svg#shape"]{stroke-width:3px}
`
  ],
  [
    '/book/art/paper.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#f8eeee"/></svg>'
  ],
  [
    '/book/shared/paper.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#eeeeff"/></svg>'
  ],
  [
    '/book/styles/paper.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#ffddcc"/></svg>'
  ],
  [
    '/book/paper.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#ddddee"/></svg>'
  ],
  [
    '/book/art/inline.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#eeffee"/></svg>'
  ],
  [
    '/book/art/symbol.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect id="shape" width="10" height="10" fill="#446688"/></svg>'
  ]
])

export const embeddedCss = `
@layer theme{.target{line-height:1.5;color:rgb(60,70,80)}}
html,body{margin:0;padding:0}
#flow{width:100vw;height:50vh;column-count:1;column-gap:20px;column-fill:auto}
.filler{block-size:120px}
.target{margin-block-start:4px;--label:"url(../never.svg)"}
@media(min-width:500px){.target{line-height:1.75}}
`

export function makeChapter(attributes, styleText, mode) {
  return `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><link ${attributes(
    { rel: 'stylesheet', href: 'styles/main.css' }
  )}/><link ${attributes({ rel: 'stylesheet', href: 'styles/svg.css' })}/><style>${styleText(
    embeddedCss + `html{writing-mode:${mode}}`
  )}</style></head><body><div id="flow"><div ${attributes({
    id: 'target',
    class: 'target literal',
    style:
      "color:rgb(90,100,110);padding-inline-start:7px;border-image-source:url('art/inline.svg')"
  })}>ABC</div><div id="custom" class="target custom">DEF</div><div ${attributes({
    id: 'inline-custom',
    class: 'target',
    style: 'background-image:var(--paper)'
  })}>GHI</div><div ${attributes({
    id: 'registered',
    class: 'target',
    style: 'background-image:var(--registered-paper)'
  })}>JKL</div><a ${attributes({
    id: 'link',
    href: 'chapter.xhtml#target'
  })}>Link</a><img ${attributes({
    id: 'image',
    class: 'resource',
    src: 'art/paper.svg',
    alt: 'Controlled resource',
    width: '10',
    height: '10'
  })}/><div class="viewport" id="viewport-box"></div><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10"><rect id="rect" width="5" height="5"/><use ${attributes(
    { id: 'use', 'xlink:href': 'art/symbol.svg#shape' }
  )}/></svg>${'<div class="filler">Source content</div>'.repeat(8)}</div><div ${attributes({
    id: 'viewport-control',
    style: 'position:fixed;inline-size:10vw;block-size:10vh;inset:0 auto auto 0'
  })}></div></body></html>`
}
