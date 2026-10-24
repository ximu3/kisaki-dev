/* Export the fixed converter's actual alias groups for a generated XML input registry. */
#include "../kana-xml-codecs/bridge.c"
#include <emscripten.h>

EM_JS(void, record_codec, (const char *alias, const char *canonical), {
  Module.codecName(UTF8ToString(alias), UTF8ToString(canonical));
});

static int list_codec(unsigned count, const char *const *names, void *context) {
  (void)context;
  for (unsigned i = 0; i < count; i++)
    record_codec(names[i], iconv_canonicalize(names[i]));
  return 0;
}

void kana_codec_list(void) { iconvlist(list_codec, NULL); }
