// Observe original metadata inside the fixed decoder before filesystem name repair.
#include "../kana-rar-members/member-bridge.cpp"

EM_JS(void, kana_raw_name, (int format, int host, int flags, const unsigned char *name, unsigned size, unsigned declared), {
  Module.rawName = { format, host, flags, declared: Module.rawNameLength ?? declared, bytes: Array.from(HEAPU8.subarray(name, name + size)) };
  Module.rawNameLength = null;
});
EM_JS(void, kana_name_length, (double length), { Module.rawNameLength = length; });
EM_JS(void, kana_decoded_name, (const wchar_t *name, unsigned size), {
  if (Module.rawName) Module.rawName.decodedUnits = Array.from(HEAPU32.subarray(name >> 2, (name >> 2) + size));
});
EM_JS(void, kana_raw_target, (const unsigned char *name, unsigned size), {
  Module.rawTarget = Array.from(HEAPU8.subarray(name, name + size));
});
