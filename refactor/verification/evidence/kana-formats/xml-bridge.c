/* Stream fixed Expat events into a source-tree proof without filesystem or network access. */
#include "expat_config.h"
#include <expat.h>
#include <emscripten.h>
#include <stdlib.h>

static XML_Parser parser;
static unsigned depth, nodes, output_bytes, depth_limit, node_limit, output_limit;
static int failure, skipped_subsets;

EM_JS(void, source_start, (const char *name, const char **attributes), {
  const pairs = [];
  for (let p = attributes; HEAPU32[p >> 2]; p += 8)
    pairs.push([UTF8ToString(HEAPU32[p >> 2]), UTF8ToString(HEAPU32[(p + 4) >> 2])]);
  Module.sourceEvent('start', UTF8ToString(name), pairs);
});
EM_JS(void, source_end, (void), { Module.sourceEvent('end'); });
EM_JS(void, source_text, (const char *text, int length), {
  Module.sourceEvent('text', UTF8ToString(text, length));
});
EM_JS(int, encoding_map, (const char *name, int *map), {
  const label = UTF8ToString(name).toLowerCase();
  const fixed = Module.singleByteMaps?.[label];
  if (fixed) {
    for (let index = 0; index < 256; index++) HEAP32[(map >> 2) + index] = fixed[index];
    return 1;
  }
  if (label === 'windows-1252') return 0;
  if (label !== 'windows-1251') return 0;
  const decoder = new TextDecoder(label, { fatal: true });
  for (let index = 0; index < 256; index++) {
    let value = -1;
    try { value = decoder.decode(Uint8Array.of(index)).codePointAt(0); } catch {}
    HEAP32[(map >> 2) + index] = value;
  }
  return 1;
});
static int XMLCALL unknown_encoding(void *context, const XML_Char *name, XML_Encoding *info) {
  info->data = NULL; info->convert = NULL; info->release = NULL;
  return encoding_map(name, info->map);
}
static void stop(int reason) {
  if (!failure) failure = reason;
  XML_StopParser(parser, XML_FALSE);
}
static void XMLCALL start(void *context, const XML_Char *name, const XML_Char **attributes) {
  if (++depth > depth_limit || ++nodes > node_limit) { stop(1); return; }
  if (!failure) source_start(name, attributes);
}
static void XMLCALL end(void *context, const XML_Char *name) {
  if (!failure) source_end();
  if (depth) depth--;
}
static void XMLCALL text(void *context, const XML_Char *value, int length) {
  if ((unsigned)length > output_limit - output_bytes) { stop(1); return; }
  output_bytes += length;
  if (!failure) source_text(value, length);
}
static void XMLCALL entity(void *context, const XML_Char *name, int parameter,
                          const XML_Char *value, int length, const XML_Char *base,
                          const XML_Char *system_id, const XML_Char *public_id,
                          const XML_Char *notation) {
  if (system_id || public_id) stop(2);
}
static void XMLCALL skipped(void *context, const XML_Char *name, int parameter) { stop(3); }
static int XMLCALL external(XML_Parser source, const XML_Char *context, const XML_Char *base,
                            const XML_Char *system_id, const XML_Char *public_id) {
  if (context || failure) { stop(2); return XML_STATUS_ERROR; }
  /* Only a bare external subset reaches here; entity declarations already fail explicitly. */
  skipped_subsets++;
  return XML_STATUS_OK;
}

int kana_xml_open(unsigned max_depth, unsigned max_nodes, unsigned max_output, unsigned amplification_threshold) {
  if (parser) return 0;
  parser = XML_ParserCreateNS(NULL, '\x1f');
  if (!parser) return 0;
  depth = nodes = output_bytes = 0;
  failure = skipped_subsets = 0;
  depth_limit = max_depth; node_limit = max_nodes; output_limit = max_output;
  XML_SetElementHandler(parser, start, end);
  XML_SetCharacterDataHandler(parser, text);
  XML_SetEntityDeclHandler(parser, entity);
  XML_SetSkippedEntityHandler(parser, skipped);
  XML_SetExternalEntityRefHandler(parser, external);
  XML_SetUnknownEncodingHandler(parser, unknown_encoding, NULL);
  XML_SetParamEntityParsing(parser, XML_PARAM_ENTITY_PARSING_ALWAYS);
  XML_SetBillionLaughsAttackProtectionMaximumAmplification(parser, 100.0f);
  XML_SetBillionLaughsAttackProtectionActivationThreshold(parser, amplification_threshold);
  return 1;
}
int kana_xml_feed(const char *data, int size, int final) { return parser ? XML_Parse(parser, data, size, final) : 0; }
int kana_xml_failure(void) { return failure; }
int kana_xml_error(void) { return parser ? XML_GetErrorCode(parser) : 0; }
int kana_xml_skipped_subsets(void) { return skipped_subsets; }
void kana_xml_close(void) { if (parser) XML_ParserFree(parser); parser = NULL; }
