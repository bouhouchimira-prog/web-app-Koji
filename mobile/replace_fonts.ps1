# PowerShell script to replace GoogleFonts with local fonts

$files = Get-ChildItem -Path "lib" -Filter "*.dart" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Remove google_fonts import
    $content = $content -replace "import 'package:google_fonts/google_fonts.dart';`n", ""
    
    # Replace GoogleFonts.outfit() with TextStyle(fontFamily: 'Outfit')
    # Pattern 1: GoogleFonts.outfit(...)
    $content = $content -replace "GoogleFonts\.outfit\(", "TextStyle(fontFamily: 'Outfit', "
    
    # Save the file
    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "Replaced GoogleFonts in all Dart files!"
Write-Host "Total files processed: $($files.Count)"
