/* Resolve the standard local catalog while keeping source XML parsing incremental and bounded. */
#include "expat_config.h"
#include <expat.h>
#include <emscripten.h>
#include <stdlib.h>
#include <string.h>

static XML_Parser parser, active_parser;
static unsigned depth, nodes, output_bytes, metadata_bytes;
static unsigned depth_limit, node_limit, output_limit, metadata_limit;
static int failure, skipped_subsets, catalog_uses, external_declarations;

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
EM_JS(int, local_catalog, (const char *public_id, char *destination), {
  if (!public_id || !Module.catalogIds.has(UTF8ToString(public_id))) return 0;
  if (destination) HEAPU8.set(Module.catalogBytes, destination);
  return Module.catalogBytes.length;
});
EM_JS(int, encoding_map, (const char *name, int *map), {
  const fixed = Module.singleByteMaps[UTF8ToString(name).toLowerCase()];
  if (!fixed) return 0;
  for (let index = 0; index < 256; index++) HEAP32[(map >> 2) + index] = fixed[index];
  return 1;
});

static void stop(int reason) {
  if (!failure) failure = reason;
  XML_StopParser(active_parser, XML_FALSE);
}

static int take_metadata(const char *value) {
  size_t length = value ? strlen(value) : 0;
  if (length > metadata_limit - metadata_bytes) { stop(1); return 0; }
  metadata_bytes += (unsigned)length;
  return 1;
}

static void XMLCALL start(void *context, const XML_Char *name, const XML_Char **attributes) {
  if (++depth > depth_limit || ++nodes > node_limit) { stop(1); return; }
  if (!take_metadata(name)) return;
  for (const XML_Char **attribute = attributes; *attribute; attribute += 2)
    if (!take_metadata(attribute[0]) || !take_metadata(attribute[1])) return;
  if (!failure) source_start(name, attributes);
}

static void XMLCALL end(void *context, const XML_Char *name) {
  if (!failure) source_end();
  if (depth) depth--;
}

static void XMLCALL text(void *context, const XML_Char *value, int length) {
  if ((unsigned)length > output_limit - output_bytes) { stop(1); return; }
  output_bytes += (unsigned)length;
  if (!failure) source_text(value, length);
}

static void XMLCALL entity(void *context, const XML_Char *name, int parameter,
                          const XML_Char *value, int length, const XML_Char *base,
                          const XML_Char *system_id, const XML_Char *public_id,
                          const XML_Char *notation) {
  if (active_parser != parser) return;
  if (!take_metadata(name) || !take_metadata(system_id) || !take_metadata(public_id)) return;
  if (value && (unsigned)length > metadata_limit - metadata_bytes) { stop(1); return; }
  if (value) metadata_bytes += (unsigned)length;
  if (system_id || public_id) external_declarations++;
}

static void XMLCALL skipped(void *context, const XML_Char *name, int parameter) {
  /* Skipping an external parameter subset is non-validating processing; missing content is not. */
  if (parameter) skipped_subsets++;
  else stop(3);
}

static int XMLCALL external(XML_Parser source, const XML_Char *context, const XML_Char *base,
                            const XML_Char *system_id, const XML_Char *public_id) {
  if (failure) return XML_STATUS_ERROR;
  if (context) { stop(2); return XML_STATUS_ERROR; }
  int length = local_catalog(public_id, NULL);
  if (!length) { skipped_subsets++; return XML_STATUS_OK; }
  XML_Parser child = XML_ExternalEntityParserCreate(source, NULL, "UTF-8");
  char *data = malloc((size_t)length);
  if (!child || !data) {
    if (child) XML_ParserFree(child);
    free(data);
    stop(1);
    return XML_STATUS_ERROR;
  }
  local_catalog(public_id, data);
  active_parser = child;
  int status = XML_Parse(child, data, length, XML_TRUE);
  active_parser = source;
  XML_ParserFree(child);
  free(data);
  catalog_uses++;
  if (!status && !failure) failure = 4;
  return status;
}

static int XMLCALL unknown_encoding(void *context, const XML_Char *name, XML_Encoding *info) {
  info->data = NULL;
  info->convert = NULL;
  info->release = NULL;
  return encoding_map(name, info->map);
}

int kana_xml_open(unsigned max_depth, unsigned max_nodes, unsigned max_output,
                  unsigned max_metadata, unsigned amplification_threshold) {
  if (parser) return 0;
  parser = XML_ParserCreateNS(NULL, '\x1f');
  if (!parser) return 0;
  active_parser = parser;
  depth = nodes = output_bytes = metadata_bytes = 0;
  failure = skipped_subsets = catalog_uses = external_declarations = 0;
  depth_limit = max_depth;
  node_limit = max_nodes;
  output_limit = max_output;
  metadata_limit = max_metadata;
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

int kana_xml_feed(const char *data, int size, int final) {
  return parser ? XML_Parse(parser, data, size, final) : 0;
}
int kana_xml_failure(void) { return failure; }
int kana_xml_error(void) { return parser ? XML_GetErrorCode(parser) : 0; }
int kana_xml_skipped_subsets(void) { return skipped_subsets; }
int kana_xml_catalog_uses(void) { return catalog_uses; }
int kana_xml_external_declarations(void) { return external_declarations; }
void kana_xml_close(void) {
  if (parser) XML_ParserFree(parser);
  parser = active_parser = NULL;
}
