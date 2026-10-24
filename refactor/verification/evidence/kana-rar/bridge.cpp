// Experimental UnRAR DLL bridge. The upstream sources and license are kept unchanged.
#include "rar.hpp"
#include "dll.hpp"
#include <emscripten.h>
#include <emscripten/heap.h>

EM_ASYNC_JS(int, kana_output, (const unsigned char *data, unsigned int size), {
  try {
    Module['maxNativeOutput'] = Math.max(Module['maxNativeOutput'] || 0, size);
    for (let offset = 0; offset < size; offset += 65536) {
      const count = Math.min(65536, size - offset);
      const chunk = HEAPU8.slice(data + offset, data + offset + count);
      await Module['hostOutput'](chunk);
    }
    return 0;
  } catch (error) {
    Module['outputFailed'] = true;
    return -1;
  }
});

EM_JS(int, kana_has_volume, (const char *path), {
  return Module['hasVolume'](UTF8ToString(path)) ? 1 : 0;
});

static HANDLE current = nullptr;
static RARHeaderDataEx header = {};
static std::wstring password;
static std::vector<wchar_t> member_name(65536);
static std::string utf8_name;
static unsigned int archive_flags = 0;

static int CALLBACK callback(UINT message, LPARAM user_data, LPARAM first, LPARAM second) {
  switch (message) {
    case UCM_PROCESSDATA:
      return kana_output(reinterpret_cast<const unsigned char *>(first), static_cast<unsigned int>(second));
    case UCM_NEEDPASSWORDW:
      if (password.empty()) return -1;
      wcsncpyz(reinterpret_cast<wchar_t *>(first), password.c_str(), static_cast<size_t>(second));
      return 1;
    case UCM_LARGEDICT:
      return 0;
    case UCM_CHANGEVOLUMEW: {
      if (second == RAR_VOL_NOTIFY) return 1;
      std::string path;
      WideToUtf(std::wstring(reinterpret_cast<const wchar_t *>(first)), path);
      return kana_has_volume(path.c_str()) ? 1 : -1;
    }
    case UCM_CHANGEVOLUME:
      if (second == RAR_VOL_NOTIFY) return 1;
      return kana_has_volume(reinterpret_cast<const char *>(first)) ? 1 : -1;
    default:
      return 0;
  }
}

extern "C" {
int kana_open(const char *path, const char *secret, int list_only) {
  if (current) return ERAR_UNKNOWN;
  password.clear();
  UtfToWide(secret ? secret : "", password);
  RAROpenArchiveDataEx input = {};
  input.ArcName = const_cast<char *>(path);
  input.OpenMode = list_only ? RAR_OM_LIST : RAR_OM_EXTRACT;
  input.Callback = callback;
  current = RAROpenArchiveEx(&input);
  archive_flags = input.Flags;
  return input.OpenResult;
}

int kana_next() {
  if (!current) return ERAR_EOPEN;
  header = {};
  member_name[0] = 0;
  header.FileNameEx = member_name.data();
  header.FileNameExSize = static_cast<unsigned int>(member_name.size());
  const int result = RARReadHeaderEx(current, &header);
  if (result != ERAR_SUCCESS) return result;
  if (wcslen(member_name.data()) == member_name.size() - 1) return ERAR_SMALL_BUF;
  utf8_name.clear();
  WideToUtf(std::wstring(member_name.data()), utf8_name);
  return ERAR_SUCCESS;
}

int kana_process(int discard) {
  if (!current) return ERAR_EOPEN;
  return RARProcessFile(current, discard ? RAR_SKIP : RAR_TEST, nullptr, nullptr);
}

int kana_close() {
  int result = current ? RARCloseArchive(current) : ERAR_SUCCESS;
  current = nullptr;
  std::fill(password.begin(), password.end(), 0);
  password.clear();
  utf8_name.clear();
  return result;
}

const char *kana_name() { return utf8_name.c_str(); }
unsigned int kana_flags() { return header.Flags; }
unsigned int kana_archive_flags() { return archive_flags; }
unsigned int kana_crc() { return header.FileCRC; }
unsigned int kana_hash_type() { return header.HashType; }
unsigned int kana_redirection() { return header.RedirType; }
unsigned int kana_dictionary() { return header.DictSize; }
unsigned int kana_heap_bytes() { return emscripten_get_heap_size(); }
double kana_unpacked_size() { return static_cast<double>((static_cast<uint64_t>(header.UnpSizeHigh) << 32) | header.UnpSize); }
}
