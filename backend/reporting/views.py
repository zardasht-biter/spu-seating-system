from django.http import FileResponse
from rest_framework.views import APIView
from seating.models import ExamSession, Allocation
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import io

class GenerateSeatCardsView(APIView):
    def get(self, request, exam_session_id):
        exam = ExamSession.objects.get(id=exam_session_id)
        allocations = Allocation.objects.filter(exam_session=exam).select_related('student', 'seat')
        
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        for i, alloc in enumerate(allocations):
            y = 800 - ((i % 4) * 200)
            if i > 0 and i % 4 == 0: p.showPage(); y = 800
            p.rect(50, y-150, 500, 150)
            p.drawString(70, y-30, f"Student: {alloc.student.email}")
            p.drawString(70, y-60, f"Exam: {exam.title}")
            p.drawString(70, y-90, f"Seat: R{alloc.seat.row_index} C{alloc.seat.col_index}")
        p.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename="seat_cards.pdf")

class GenerateAttendanceRosterView(APIView):
    def get(self, request, exam_session_id):
        # Stub for Roster PDF
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        p.drawString(100, 800, "Attendance Roster Placeholder")
        p.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename="roster.pdf")

class GenerateHallMapView(APIView):
    def get(self, request, exam_session_id):
        # Stub for Hall Map PDF
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        p.drawString(100, 800, "Hall Map Placeholder")
        p.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename="map.pdf")
