"""
Batch converter script to convert all remaining Dart files to use responsive sizing.
This script will:
1. Add responsive_helper import
2. Add 'final responsive = context.responsive;' to build methods
3. Replace AppTheme.headingStyle with AppTheme.headingStyle(context)
4. Replace AppTheme.bodyStyle with AppTheme.bodyStyle(context)
5. Convert common hardcoded pixel values to responsive equivalents

Run this script from the project root:
python convert_to_responsive.py
"""

import re
import os
from pathlib import Path

# Files that still need conversion
FILES_TO_CONVERT = [
    "lib/features/auth/signup_screen.dart",
    "lib/features/auth/business_info_screen.dart",
    "lib/features/auth/profession_selection_screen.dart",
    "lib/features/home/home_screen.dart",
    "lib/features/onboarding/onboarding_screen.dart",
    "lib/features/quote/photo_preview_screen.dart",
    "lib/features/quote/quote_summary_screen.dart",
    "lib/features/quote/room_estimation_screen.dart",
    "lib/features/quote/room_selection_screen.dart",
    "lib/features/quote/room_task_screen.dart",
    "lib/features/quote/visual_evidence_grid_screen.dart",
    "lib/features/quote/visual_proof_screen.dart",
]

def add_responsive_import(content):
    """Add responsive_helper import if not present"""
    if "import 'package:koji/core/responsive_helper.dart';" in content:
        return content
    
    # Find the last import statement
    import_pattern = r"(import\s+['\"].*?['\"];)"
    imports = list(re.finditer(import_pattern, content))
    
    if imports:
        last_import = imports[-1]
        insert_pos = last_import.end()
        content = (content[:insert_pos] + 
                  "\nimport 'package:koji/core/responsive_helper.dart';" +
                  content[insert_pos:])
    
    return content

def add_responsive_variable(content):
    """Add responsive variable to build method if not present"""
    if "final responsive = context.responsive;" in content:
        return content
    
    # Find build method and add responsive variable after the opening brace
    build_pattern = r"(@override\s+Widget\s+build\(BuildContext\s+context\)\s*\{)"
    
    def replace_build(match):
        return match.group(1) + "\n    final responsive = context.responsive;\n"
    
    content = re.sub(build_pattern, replace_build, content)
    return content

def fix_theme_calls(content):
    """Fix AppTheme style calls to include context parameter"""
    # Fix headingStyle
    content = re.sub(
        r'AppTheme\.headingStyle\.copyWith',
        'AppTheme.headingStyle(context).copyWith',
        content
    )
    
    # Fix bodyStyle
    content = re.sub(
        r'AppTheme\.bodyStyle\.copyWith',
        'AppTheme.bodyStyle(context).copyWith',
        content
    )
    
    # Fix standalone calls
    content = re.sub(
        r'style:\s*AppTheme\.headingStyle(?![\(\.])',
        'style: AppTheme.headingStyle(context)',
        content
    )
    
    content = re.sub(
        r'style:\s*AppTheme\.bodyStyle(?![\(\.])',
        'style: AppTheme.bodyStyle(context)',
        content
    )
    
    return content

def convert_common_sizes(content):
    """Convert common hardcoded pixel values to responsive equivalents"""
    # This is a simplified conversion - you may need to adjust percentages
    # based on your specific design requirements
    
    replacements = {
        # Padding and margins
        r'const EdgeInsets\.symmetric\(horizontal:\s*24\.0?\)': 
            'responsive.paddingSymmetric(horizontalPercent: 6.4)',
        r'const EdgeInsets\.symmetric\(horizontal:\s*16\.0?\)':
            'responsive.paddingSymmetric(horizontalPercent: 4.3)',
        r'const EdgeInsets\.all\((\d+)\.0?\)':
            lambda m: f'EdgeInsets.all(responsive.width({float(m.group(1))/375*100:.1f}))',
        
        # SizedBox heights
        r'const SizedBox\(height:\s*40\.0?\)':
            'SizedBox(height: responsive.height(5))',
        r'const SizedBox\(height:\s*32\.0?\)':
            'SizedBox(height: responsive.height(4))',
        r'const SizedBox\(height:\s*24\.0?\)':
            'SizedBox(height: responsive.height(3))',
        r'const SizedBox\(height:\s*20\.0?\)':
            'SizedBox(height: responsive.height(2.5))',
        r'const SizedBox\(height:\s*16\.0?\)':
            'SizedBox(height: responsive.height(2))',
        r'const SizedBox\(height:\s*12\.0?\)':
            'SizedBox(height: responsive.height(1.5))',
        r'const SizedBox\(height:\s*8\.0?\)':
            'SizedBox(height: responsive.height(1))',
        
        # SizedBox widths
        r'const SizedBox\(width:\s*16\.0?\)':
            'SizedBox(width: responsive.width(4.3))',
        r'const SizedBox\(width:\s*12\.0?\)':
            'SizedBox(width: responsive.width(3.2))',
        r'const SizedBox\(width:\s*8\.0?\)':
            'SizedBox(width: responsive.width(2.1))',
        
        # Font sizes
        r'fontSize:\s*(\d+)\.0?(?![\d])':
            lambda m: f'fontSize: responsive.fontSize({m.group(1)})',
        
        # Icon sizes
        r'size:\s*(\d+)\.0?(?![\d])':
            lambda m: f'size: responsive.iconSize({m.group(1)})',
        
        # Border radius
        r'BorderRadius\.circular\((\d+)\.0?\)':
            lambda m: f'BorderRadius.circular(responsive.borderRadius({m.group(1)}))',
    }
    
    for pattern, replacement in replacements.items():
        if callable(replacement):
            content = re.sub(pattern, replacement, content)
        else:
            content = re.sub(pattern, replacement, content)
    
    return content

def convert_file(filepath):
    """Convert a single file to use responsive sizing"""
    print(f"Converting {filepath}...")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Apply conversions
        content = add_responsive_import(content)
        content = add_responsive_variable(content)
        content = fix_theme_calls(content)
        content = convert_common_sizes(content)
        
        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✓ Successfully converted {filepath}")
        return True
    
    except Exception as e:
        print(f"✗ Error converting {filepath}: {e}")
        return False

def main():
    """Main conversion function"""
    print("Starting batch conversion to responsive sizing...")
    print("=" * 60)
    
    project_root = Path("c:/Users/firas/OneDrive/Desktop/im2a/koji")
    
    if not project_root.exists():
        print(f"Error: Project root not found at {project_root}")
        return
    
    success_count = 0
    fail_count = 0
    
    for file_path in FILES_TO_CONVERT:
        full_path = project_root / file_path
        
        if not full_path.exists():
            print(f"⚠ File not found: {full_path}")
            fail_count += 1
            continue
        
        if convert_file(full_path):
            success_count += 1
        else:
            fail_count += 1
    
    print("=" * 60)
    print(f"Conversion complete!")
    print(f"✓ Successfully converted: {success_count} files")
    print(f"✗ Failed: {fail_count} files")
    print("\nPlease review the changes and run 'flutter analyze' to check for any issues.")

if __name__ == "__main__":
    main()
