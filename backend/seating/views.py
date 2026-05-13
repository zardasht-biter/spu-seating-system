import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import transaction, IntegrityError
from django.db.models import Count, Q
from .models import Hall, ExamSession, Allocation, ExamCohort, Seat
from accounts.models import User, StudentEnrollment
from .serializers import ExamSessionSerializer

# --- 1. HALL MANAGEMENT ---

class HallListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # VISIBILITY: All admins can view the hall list
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(status=403)
            
        halls = Hall.objects.all().order_by('name')
        data = []
        for h in halls:
            capacity = sum(row.count('seat') for row in h.seating_grid) if h.seating_grid else 0
            data.append({
                'id': h.id,
                'name': h.name,
                'rows': h.rows,
                'cols': h.cols,
                'capacity': capacity,
                'seating_grid': h.seating_grid
            })
        return Response(data)

    def post(self, request):
        # SECURITY: Only admins with HALLS permission can create halls
        if not request.user.has_perm_to('HALLS'):
            return Response({'error': 'Unauthorized. HALLS permission required.'}, status=403)

        name = request.data.get('name')
        rows = int(request.data.get('rows', 5))
        cols = int(request.data.get('cols', 5))
        
        initial_grid = [['seat' for _ in range(cols)] for _ in range(rows)]
        
        hall = Hall.objects.create(
            name=name,
            rows=rows,
            cols=cols,
            seating_grid=initial_grid
        )
        
        # Instantly spawn the physical database chairs for the algorithm
        seats_to_create = []
        for r in range(rows):
            for c in range(cols):
                seats_to_create.append(Seat(hall=hall, row_index=r, col_index=c, seat_type='active', is_active=True))
        Seat.objects.bulk_create(seats_to_create)
        
        return Response({'id': hall.id, 'name': hall.name}, status=201)

class HallDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        # VISIBILITY: All admins can view hall details
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(status=403)

        try:
            hall = Hall.objects.get(pk=pk)
            return Response({
                'id': hall.id,
                'name': hall.name,
                'rows': hall.rows,
                'cols': hall.cols,
                'seating_grid': hall.seating_grid
            })
        except Hall.DoesNotExist:
            return Response({'error': 'Hall not found'}, status=404)

    def put(self, request, pk):
        # SECURITY: Only admins with HALLS permission can modify layouts
        if not request.user.has_perm_to('HALLS'):
            return Response({'error': 'Unauthorized. HALLS permission required.'}, status=403)

        hall = Hall.objects.get(pk=pk)
        action = request.data.get('action') 

        if action == 'save_layout':
            grid = request.data.get('grid')
            hall.seating_grid = grid
            hall.rows = request.data.get('rows')
            hall.cols = request.data.get('cols')
            hall.save()
            
            # Sync layout carving to physical database chairs
            Seat.objects.filter(hall=hall).delete()
            seats_to_create = []
            for r in range(hall.rows):
                for c in range(hall.cols):
                    cell_type = grid[r][c]
                    if cell_type == 'seat':
                        seats_to_create.append(Seat(hall=hall, row_index=r, col_index=c, seat_type='active', is_active=True))
                    elif cell_type == 'path':
                        seats_to_create.append(Seat(hall=hall, row_index=r, col_index=c, seat_type='space', is_active=False))
            Seat.objects.bulk_create(seats_to_create)

        return Response({
            'id': hall.id,
            'name': hall.name,
            'rows': hall.rows, 
            'cols': hall.cols, 
            'seating_grid': hall.seating_grid
        })

    def delete(self, request, pk):
        # SECURITY: Only admins with HALLS permission can delete halls
        if not request.user.has_perm_to('HALLS'):
            return Response({'error': 'Unauthorized. HALLS permission required.'}, status=403)

        hall = Hall.objects.get(pk=pk)
        hall.delete()
        return Response(status=204)


# --- 2. EXAM SESSIONS & COHORTS ---

class AvailableCohortsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # VISIBILITY: Admins can see the pool of available students
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(status=403)

        cohorts = StudentEnrollment.objects.values(
            'department', 'stage'
        ).annotate(
            pool_size=Count('student', distinct=True)
        ).order_by('department', 'stage')

        data = []
        for idx, c in enumerate(cohorts):
            seated = Allocation.objects.filter(
                exam_session__cohorts__department=c['department'],
                exam_session__cohorts__stage=c['stage'],
                student__enrollments__department=c['department'],
                student__enrollments__stage=c['stage']
            ).values('student').distinct().count()

            data.append({
                'id': f"cohort-{idx}",
                'department': c['department'],
                'stage': c['stage'],
                'subject_name': 'General', 
                'pool_size': c['pool_size'],
                'seated_count': seated
            })
        return Response(data)

class ExamSessionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        # VISIBILITY: Admins can view the session list
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(status=403)

        exams = ExamSession.objects.all().order_by('-id')
        return Response(ExamSessionSerializer(exams, many=True).data)

    def post(self, request):
        # SECURITY: Only admins with EXAMS permission can create sessions
        if not request.user.has_perm_to('EXAMS'):
            return Response({'error': 'Unauthorized. EXAMS permission required.'}, status=403)

        data = request.data
        try:
            hall = Hall.objects.get(id=data.get('hall'))
            exam = ExamSession.objects.create(
                title=data.get('title', 'Room Mapping'),
                hall=hall,
                time_range=data.get('time_range')
            )
            for c in data.get('cohorts', []):
                ExamCohort.objects.create(
                    exam_session=exam, 
                    department=c.get('department'),
                    stage=c.get('stage'),
                    subject_name=c.get('subject_name', 'General')
                )
            return Response({'id': exam.id}, status=201)
        except IntegrityError:
            return Response({'error': f"Double Booking Prevented! {hall.name} is already booked for this time."}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

class ExamSessionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def delete(self, request, pk):
        # SECURITY: Only admins with EXAMS permission can delete sessions
        if not request.user.has_perm_to('EXAMS'):
            return Response({'error': 'Unauthorized. EXAMS permission required.'}, status=403)

        try:
            ExamSession.objects.get(pk=pk).delete()
            return Response({'message': 'Deleted.'}, status=200)
        except ExamSession.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)


# --- 3. ALGORITHM & VISUAL AUDIT ---

class VisualAuditView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        # VISIBILITY: All admins can view the visual seating audit
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(status=403)

        try:
            exam = ExamSession.objects.get(id=pk)
            seats = Seat.objects.filter(hall=exam.hall).order_by('row_index', 'col_index')
            allocations = Allocation.objects.filter(exam_session=exam).select_related('student', 'seat')
            
            time_slot_busy_ids = list(Allocation.objects.filter(
                exam_session__time_range=exam.time_range
            ).values_list('student_id', flat=True))
            
            seats_data = [{'id': s.id, 'row_index': s.row_index, 'col_index': s.col_index, 'seat_type': s.seat_type, 'is_active': s.is_active} for s in seats]

            alloc_data = []
            crossovers = []
            
            for a in allocations:
                student = a.student
                matching_enrollments = student.enrollments.filter(
                    department__in=exam.cohorts.values_list('department', flat=True),
                    stage__in=exam.cohorts.values_list('stage', flat=True)
                )
                
                is_retake = matching_enrollments.count() > 1
                if is_retake:
                    crossovers.append({
                        'email': student.email.split('@')[0].upper(),
                        'subjects': " & ".join([f"Stage {e.stage}" for e in matching_enrollments])
                    })
                
                main_enr = matching_enrollments.first()
                alloc_data.append({
                    'seat_id': a.seat.id,
                    'student_name': student.email.split('@')[0].upper(),
                    'full_email': student.email,
                    'department': main_enr.department if main_enr else student.department,
                    'stage': main_enr.stage if main_enr else student.stage,
                    'subject': "General",
                    'is_retake': is_retake
                })

            overflow_data = []
            added_overflow_ids = set() 
            for cohort in exam.cohorts.all():
                unseated = User.objects.filter(
                    enrollments__department=cohort.department, enrollments__stage=cohort.stage, 
                    role='student'
                ).exclude(id__in=time_slot_busy_ids).distinct()
                
                for u in unseated:
                    if u.id not in added_overflow_ids:
                        matching_enrs = u.enrollments.filter(
                            department__in=exam.cohorts.values_list('department', flat=True),
                            stage__in=exam.cohorts.values_list('stage', flat=True)
                        )
                        is_retake = matching_enrs.count() > 1
                        overflow_data.append({
                            'email': u.email, 
                            'department': cohort.department, 
                            'stage': cohort.stage, 
                            'subject': 'General',
                            'is_retake': is_retake 
                        })
                        added_overflow_ids.add(u.id)

            return Response({
                'hall_cols': exam.hall.cols, 'seats': seats_data, 'allocations': alloc_data, 'overflow': overflow_data, 'crossovers': crossovers 
            })
        except ExamSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)

class RunAllocationView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request): 
        if not request.user.has_perm_to('ALLOCATION'):
            return Response({'error': 'Unauthorized. ALLOCATION permission required.'}, status=403)
        return Response({'message': 'Use algorithm API path.'})

class StudentSeatView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        allocations = Allocation.objects.filter(student=request.user).select_related('exam_session', 'seat', 'exam_session__hall')
        data = [{
            'id': a.id,
            'exam_details': {
                'title': a.exam_session.title or "Session", 
                'hall_name': a.exam_session.hall.name, 
                'date': str(a.exam_session.date), 
                'start_time': a.exam_session.time_range,
                'hall_rows': a.exam_session.hall.rows,
                'hall_cols': a.exam_session.hall.cols,
                'seating_grid': a.exam_session.hall.seating_grid
            },
            'seat_details': {
                'row_index': a.seat.row_index + 1 if a.seat else 0, 
                'col_index': a.seat.col_index + 1 if a.seat else 0
            }
        } for a in allocations]
        return Response(data)