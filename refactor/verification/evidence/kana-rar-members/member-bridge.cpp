// Bind the fixed upstream DLL implementation in one translation unit to read legacy link data.
#include "dll.cpp"
#include "../kana-rar/bridge.cpp"

static std::string reference_target;

extern "C" {
int kana_set_utf8_locale() { return setlocale(LC_CTYPE, "C.UTF-8") != nullptr; }

int kana_reference_in_data() {
  if (!current) return 0;
  DataSet *data = static_cast<DataSet *>(current);
  return data->Arc.Format != RARFMT50 && header.RedirType == FSREDIR_UNIXSYMLINK;
}

const char *kana_reference_target() {
  if (!current) return nullptr;
  const std::wstring &target = static_cast<DataSet *>(current)->Arc.FileHead.RedirName;
  if (target.size() >= 65536) return nullptr;
  reference_target.clear();
  WideToUtf(target, reference_target);
  return reference_target.c_str();
}

int kana_reference_directory() { return header.DirTarget != 0; }
int kana_windows_names() { return current && static_cast<DataSet *>(current)->Arc.FileHead.HSType == HSYS_WINDOWS; }

int kana_process_reference() {
  if (!kana_reference_in_data()) return ERAR_BAD_DATA;
  DataSet *data = static_cast<DataSet *>(current);
  if (data->Arc.FileHead.UnpSize < 0 || data->Arc.FileHead.UnpSize >= 65536) return ERAR_SMALL_BUF;
  // RAR_TEST normally omits legacy symlink bytes. Consume this header as data, with native decryption and CRC.
  // ProcessFile consumes the current header; the next header is read afresh by RARReadHeaderEx.
  data->Arc.FileHead.RedirType = FSREDIR_NONE;
  return RARProcessFile(current, RAR_TEST, nullptr, nullptr);
}
}
