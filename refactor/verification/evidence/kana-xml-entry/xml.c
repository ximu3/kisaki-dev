/* Reuse Expat for declaration syntax and the full source; selection of bytes stays outside it. */
#include "../kana-xml-input/bridge.c"

static XML_Parser declaration_parser;
static int declaration_seen;

EM_JS(void, record_declaration, (const char *version, const char *encoding, int standalone), {
  Module.xmlDeclaration({
    version: version ? UTF8ToString(version) : null,
    encoding: encoding ? UTF8ToString(encoding) : null,
    standalone
  });
});

static void XMLCALL entry_declaration(void *context, const XML_Char *version,
                                      const XML_Char *encoding, int standalone) {
  (void)context;
  declaration_seen = 1;
  record_declaration(version, encoding, standalone);
  XML_StopParser(declaration_parser, XML_FALSE);
}

int kana_entry_declaration(const char *data, int length) {
  declaration_seen = 0;
  declaration_parser = XML_ParserCreate("UTF-8");
  if (!declaration_parser) return 0;
  XML_SetXmlDeclHandler(declaration_parser, entry_declaration);
  int status = XML_Parse(declaration_parser, data, length, XML_FALSE);
  int accepted = declaration_seen &&
      (status == XML_STATUS_OK || XML_GetErrorCode(declaration_parser) == XML_ERROR_ABORTED);
  XML_ParserFree(declaration_parser);
  declaration_parser = NULL;
  return accepted;
}

int kana_entry_open(const char *encoding, unsigned max_depth, unsigned max_nodes,
                    unsigned max_output, unsigned max_metadata, unsigned amplification_threshold) {
  if (!kana_xml_open(max_depth, max_nodes, max_output, max_metadata, amplification_threshold)) return 0;
  if (XML_SetEncoding(parser, encoding) == XML_STATUS_ERROR) {
    kana_xml_close();
    return 0;
  }
  return 1;
}

int kana_entry_active(void) { return (parser != NULL) + (declaration_parser != NULL); }
