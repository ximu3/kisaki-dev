/* Inspect strict, incremental conversion into UTF-8 without changing XML syntax ownership. */
#include <ctype.h>
#include <errno.h>
#include <iconv.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

static size_t consumed;
static size_t produced;
static unsigned active;

/* The bridge always supplies a named codec; this symbol satisfies the unused locale branch. */
const char *locale_charset(void) { return "UTF-8"; }

uintptr_t kana_codec_open(const char *name) {
  size_t length = strlen(name);
  if (!length || length > 80 || !isalpha((unsigned char)name[0])) return 0;
  for (size_t i = 0; i < length; i++)
    if (!isalnum((unsigned char)name[i]) && name[i] != '-' && name[i] != '_' &&
        name[i] != '.') return 0;
  iconv_t converter = iconv_open("UTF-8", name);
  if (converter == (iconv_t)-1) return 0;
  active++;
  return (uintptr_t)converter;
}

int kana_codec_convert(uintptr_t handle, const char *input, size_t input_length,
                       char *output, size_t output_length) {
  const char *source = input;
  char *destination = output;
  size_t remaining = input_length;
  size_t capacity = output_length;
  errno = 0;
  size_t result = iconv((iconv_t)handle, input ? &source : NULL,
                       input ? &remaining : NULL, &destination, &capacity);
  consumed = input_length - remaining;
  produced = output_length - capacity;
  if (result != (size_t)-1) return 1;
  if (errno == EINVAL) return 2;
  if (errno == E2BIG) return 3;
  return -1;
}

size_t kana_codec_consumed(void) { return consumed; }
size_t kana_codec_produced(void) { return produced; }
unsigned kana_codec_active(void) { return active; }

void kana_codec_close(uintptr_t handle) {
  if (!handle) return;
  iconv_close((iconv_t)handle);
  active--;
}
