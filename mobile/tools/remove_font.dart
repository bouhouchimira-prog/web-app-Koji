import 'dart:io';

void main() {
  final dir = Directory('lib');
  final files = dir.listSync(recursive: true);
  int count = 0;
  for (var file in files) {
    if (file is File && file.path.endsWith('.dart')) {
      String content = file.readAsStringSync();
      if (content.contains("fontFamily:")) {
        content = content.replaceAll(RegExp(r"(\s*)fontFamily:\s*['" + '"' + r"]Outfit['" + '"' + r"],?"), "");
        file.writeAsStringSync(content);
        count++;
      }
    }
  }
  print('Removed Outfit from $count files');
}
