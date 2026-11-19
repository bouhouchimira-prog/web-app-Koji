import 'package:flutter/material.dart';

// Pinceaux de signature partagés par Koji Pro (ma signature, intervention).
// L'ancien écran de signature Supabase de l'app Koji a été retiré : un devis
// se signe dans l'espace Koji Client (/client/devis/{id}) ou par lien
// (/client/signature-lien), avec les règles du site.

class SignaturePainter extends CustomPainter {
  final List<Offset?> points;
  SignaturePainter({required this.points});

  @override
  void paint(Canvas canvas, Size size) {
    Paint paint = Paint()
      ..color = const Color(0xFF0F2648)
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3.0;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }
  }

  @override
  bool shouldRepaint(SignaturePainter oldDelegate) =>
      oldDelegate.points != points;
}

class DashedRectPainter extends CustomPainter {
  final double strokeWidth;
  final Color color;
  final double gap;

  DashedRectPainter(
      {this.strokeWidth = 2.0, this.color = Colors.black, this.gap = 5.0});

  @override
  void paint(Canvas canvas, Size size) {
    Paint dashedPaint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    double x = size.width;
    double y = size.height;

    Path topPath =
        getDashedPath(a: const Offset(0, 0), b: Offset(x, 0), gap: gap);
    Path rightPath = getDashedPath(a: Offset(x, 0), b: Offset(x, y), gap: gap);
    Path bottomPath = getDashedPath(a: Offset(0, y), b: Offset(x, y), gap: gap);
    Path leftPath =
        getDashedPath(a: const Offset(0, 0), b: Offset(0, y), gap: gap);

    canvas.drawPath(topPath, dashedPaint);
    canvas.drawPath(rightPath, dashedPaint);
    canvas.drawPath(bottomPath, dashedPaint);
    canvas.drawPath(leftPath, dashedPaint);
  }

  Path getDashedPath(
      {required Offset a, required Offset b, required double gap}) {
    Path path = Path();
    path.moveTo(a.dx, a.dy);
    bool shouldDraw = true;

    // Simplified implementation for rectangle
    if (a.dy == b.dy) {
      // Horizontal
      double currentX = a.dx;
      while (currentX < b.dx) {
        if (shouldDraw) {
          path.lineTo(headersMin(currentX + gap, b.dx), a.dy);
        } else {
          path.moveTo(headersMin(currentX + gap, b.dx), a.dy);
        }
        currentX += gap;
        shouldDraw = !shouldDraw;
      }
    } else {
      // Vertical
      double currentY = a.dy;
      while (currentY < b.dy) {
        if (shouldDraw) {
          path.lineTo(a.dx, headersMin(currentY + gap, b.dy));
        } else {
          path.moveTo(a.dx, headersMin(currentY + gap, b.dy));
        }
        currentY += gap;
        shouldDraw = !shouldDraw;
      }
    }

    return path;
  }

  double headersMin(double a, double b) => a < b ? a : b;

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
