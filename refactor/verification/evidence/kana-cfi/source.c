/* Preserve the XML parser's declared ID attribute alongside normal source facts. */
#include "../kana-xml-entry/xml.c"

int kana_cfi_id_attribute(void) {
  return active_parser ? XML_GetIdAttributeIndex(active_parser) : -1;
}
