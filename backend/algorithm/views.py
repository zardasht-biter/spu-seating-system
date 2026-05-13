from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from seating.models import ExamSession, Seat, Allocation
from accounts.models import User, StudentEnrollment
from django.db import models

class RunAllocationView(APIView):
    """
    STRICT COLUMN FORMATION ENGINE (v3 - Vertical Staggering).
    Enforces the exact physical patterns requested:
    - 1 Cohort: 1 Empty 1 Empty (Strict Vertical Aisles)
    - 2+ Cohorts: 1 2 1 2 / 1 2 3 1
    
    VERTICAL STAGGERING:
    Implements the "1 E 1 E 1" vertical pattern by prioritizing even rows first.
    If a cohort runs out, its column remains EMPTY to preserve the formation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, exam_session_id):
        try:
            exam = ExamSession.objects.get(id=exam_session_id)
            assigned_cohorts = exam.cohorts.all().order_by('id')
            
            if not assigned_cohorts.exists():
                return Response({'error': 'Please select at least one cohort for this session.'}, status=400) 

            # 1. Clear previous allocations to allow for re-runs
            Allocation.objects.filter(exam_session=exam).delete()
            
            # 2. Collision Check: Exclude students already busy in other halls during this time slot
            busy_ids = list(Allocation.objects.filter(
                exam_session__time_range=exam.time_range
            ).exclude(exam_session=exam).values_list('student_id', flat=True))

            queues = []
            assigned_student_ids = []
            
            # 3. Build student queues for each selected cohort
            for c in assigned_cohorts:
                enrollments = StudentEnrollment.objects.filter(
                    department=c.department, 
                    stage=c.stage
                ).select_related('student')
                
                enrolled_student_ids = [e.student_id for e in enrollments]

                # Filter students (Role check, Busy check, and Duplicate check for retake crossovers)
                students = list(User.objects.filter(
                    id__in=enrolled_student_ids, 
                    role='student'
                ).exclude(id__in=busy_ids).exclude(id__in=assigned_student_ids).order_by('id'))
                
                queues.append(students)
                assigned_student_ids.extend([s.id for s in students])

            # 4. Fetch physical chairs (excluding hallways/paths and broken units)
            active_seats = list(Seat.objects.filter(
                hall=exam.hall, 
                seat_type='active', 
                is_active=True
            ).order_by('row_index', 'col_index'))

            allocations = []
            num_cohorts = len(queues)
       
            # 5. --- TWO-PASS VERTICAL STAGGERING ---
            # Pass 0: Even Rows (Priority spacing: 1 E 1 E 1)
            # Pass 1: Odd Rows (Fill only if cohort still has remaining students)
            for current_pass in [0, 1]:
                for seat in active_seats:
                    # Skip if seat was already assigned in the first pass
                    if any(a.seat_id == seat.id for a in allocations):
                        continue

                    # Column Logic: Determines which cohort queue belongs in this column
                    if num_cohorts == 1:
                        # For single cohorts, enforce a strict "Checkerboard" column gap
                        if seat.col_index % 2 != 0:
                            continue 
                        target_q = 0
                    else:
                        # For multiple cohorts, alternate them by column index
                        target_q = seat.col_index % num_cohorts

                    # Vertical Row Staggering Logic
                    # Pass 0: Fill Only Even Rows (0, 2, 4...) to create spacing
                    if current_pass == 0 and seat.row_index % 2 != 0:
                        continue
                    # Pass 1: Fill Only Odd Rows (1, 3, 5...) as overflow
                    if current_pass == 1 and seat.row_index % 2 == 0:
                        continue

                    # Seat the student if their specific cohort queue has people left
                    if target_q < len(queues) and queues[target_q]:
                        student = queues[target_q].pop(0)
                        allocations.append(Allocation(
                            exam_session=exam, 
                            student=student, 
                            seat=seat
                        ))
                    # Note: If queues[target_q] is empty, the seat remains empty to protect the zebra pattern

            # 6. Finalize and Save using bulk_create for performance
            Allocation.objects.bulk_create(allocations)
            exam.is_allocated = True
            exam.save()

            total_waiting = sum(len(q) for q in queues)

            return Response({
                'message': 'Allocation complete with Vertical Staggering (Trio-Zebra Engine).',
                'allocated_count': len(allocations),
                'waiting_list_count': total_waiting,
                'empty_seats': len(active_seats) - len(allocations)
            })

        except ExamSession.DoesNotExist:
            return Response({'error': 'Exam session not found.'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)