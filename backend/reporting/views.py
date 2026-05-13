from django.http import FileResponse
from rest_framework.views import APIView
from seating.models import ExamSession, Allocation
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
import io

class GenerateSeatCardsView(APIView):
    """Generates a PDF containing 4 seat cards per page for students to find their desks."""
    def get(self, request, exam_session_id):
        exam = ExamSession.objects.get(id=exam_session_id)
        allocations = Allocation.objects.filter(exam_session=exam).select_related('student', 'seat')
        
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        for i, alloc in enumerate(allocations):
            # Calculate position for 4 cards per page
            idx = i % 4
            if i > 0 and idx == 0: 
                p.showPage()
            
            y_offset = height - ((idx + 1) * 200)
            
            # Draw Card Border
            p.setStrokeColor(colors.black)
            p.rect(50, y_offset, 500, 180)
            
            # Header
            p.setFont("Helvetica-Bold", 14)
            p.drawString(70, y_offset + 150, "SPU EXAM SEATING CARD")
            p.setFont("Helvetica", 10)
            p.drawString(70, y_offset + 135, f"Technical College of Informatics")
            
            # Student Details
            p.setFont("Helvetica-Bold", 12)
            p.drawString(70, y_offset + 100, f"STUDENT: {alloc.student.email.split('@')[0].upper()}")
            p.setFont("Helvetica", 10)
            p.drawString(70, y_offset + 85, f"Full ID: {alloc.student.email}")
            
            # Exam Details
            p.drawString(70, y_offset + 60, f"Session: {exam.title} ({exam.time_range})")
            p.drawString(70, y_offset + 45, f"Hall: {exam.hall.name}")
            
            # Seat Badge
            p.setFillColor(colors.black)
            p.rect(400, y_offset + 40, 120, 50, fill=1)
            p.setFillColor(colors.white)
            p.setFont("Helvetica-Bold", 16)
            p.drawCentredString(460, y_offset + 60, f"R{alloc.seat.row_index + 1}-C{alloc.seat.col_index + 1}")
            p.setFillColor(colors.black)

        p.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f"Seat_Cards_{exam_session_id}.pdf")

class GenerateAttendanceRosterView(APIView):
    """Generates a formal sign-in sheet for proctors to verify student presence."""
    def get(self, request, exam_session_id):
        exam = ExamSession.objects.get(id=exam_session_id)
        allocations = Allocation.objects.filter(exam_session=exam).select_related('student', 'seat').order_by('student__email')
        
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # Header Logic
        p.setFont("Helvetica-Bold", 16)
        p.drawCentredString(width/2, height - 50, "Official Attendance Roster")
        p.setFont("Helvetica", 12)
        p.drawCentredString(width/2, height - 70, f"Hall: {exam.hall.name} | Session: {exam.time_range}")
        
        # Table Header
        y = height - 120
        p.setFont("Helvetica-Bold", 10)
        p.drawString(50, y, "Seat")
        p.drawString(100, y, "Student Email")
        p.drawString(350, y, "Signature")
        p.line(50, y-5, 550, y-5)
        
        y -= 25
        p.setFont("Helvetica", 10)
        for alloc in allocations:
            if y < 50:
                p.showPage()
                y = height - 50
            
            p.drawString(50, y, f"R{alloc.seat.row_index+1}-C{alloc.seat.col_index+1}")
            p.drawString(100, y, alloc.student.email)
            p.rect(350, y-5, 150, 20) # Signature Box
            y -= 25
            
        p.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f"Roster_{exam_session_id}.pdf")

class GenerateHallMapView(APIView):
    """Generates a visual blueprint of the hall for proctors to audit the room layout."""
    def get(self, request, exam_session_id):
        exam = ExamSession.objects.get(id=exam_session_id)
        allocations = { (a.seat.row_index, a.seat.col_index): a.student.email.split('@')[0].upper() 
                       for a in Allocation.objects.filter(exam_session=exam).select_related('student', 'seat') }
        
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        p.setFont("Helvetica-Bold", 14)
        p.drawCentredString(width/2, height - 40, f"Visual Hall Map: {exam.hall.name}")
        p.setFont("Helvetica", 10)
        p.drawCentredString(width/2, height - 55, "FRONT / BOARD AREA")
        
        # Grid Drawing Logic
        cell_size = 40
        start_x = 50
        start_y = height - 100
        
        for r in range(exam.hall.rows):
            for c in range(exam.hall.cols):
                x = start_x + (c * cell_size)
                y = start_y - (r * cell_size)
                
                # Draw desk
                p.setStrokeColor(colors.lightgrey)
                p.rect(x, y, cell_size, cell_size)
                
                # If student is here, write name
                name = allocations.get((r, c))
                if name:
                    p.setFont("Helvetica-Bold", 6)
                    p.drawCentredString(x + cell_size/2, y + cell_size/2, name)
                
        p.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f"Hall_Map_{exam_session_id}.pdf")