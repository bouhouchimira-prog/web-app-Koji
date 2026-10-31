import os
import re

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Replace hardcoded backgroundColor: Colors.white
    content = re.sub(
        r'backgroundColor:\s*Colors\.white\b',
        r'backgroundColor: Theme.of(context).scaffoldBackgroundColor',
        content
    )

    # Replace hardcoded color: Colors.white for Containers/Cards
    content = re.sub(
        r'color:\s*Colors\.white\b',
        r'color: Theme.of(context).colorScheme.surface',
        content
    )

    # Replace hardcoded Colors.black
    content = re.sub(
        r'color:\s*Colors\.black\b',
        r'color: Theme.of(context).colorScheme.onSurface',
        content
    )

    # Replace hardcoded darkNavy color (0xFF0A1227 or 0xFF111827)
    content = re.sub(
        r'Color\(0xFF[0-9A-Fa-f]{6}\)',
        lambda m: 'Theme.of(context).colorScheme.primary' if m.group(0).upper() in ['COLOR(0xFF0A1227)', 'COLOR(0xFF111827)'] else m.group(0),
        content
    )

    # Note: we need to ensure that the file actually imports material.dart and has context available, 
    # but in most flutter widget files, context is available in the build method.
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {file_path}")

def main():
    lib_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lib')
    
    # We will exclude certain files from this automated refactoring
    exclude_files = ['theme.dart', 'theme_provider.dart', 'app_drawer.dart']
    
    count = 0
    for root, dirs, files in os.walk(lib_dir):
        for file in files:
            if file.endswith('.dart') and file not in exclude_files:
                process_file(os.path.join(root, file))
                count += 1
                
    print(f"Processed {count} files.")

if __name__ == "__main__":
    main()
