from rest_framework import serializers
from django.db import models
from django.db.models import Q
from .models import Hall, Seat, ExamSession, ExamCohort, Allocation
from accounts.models import User, StudentEnrollment

class ExamCohortSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamCohort
        fields = ['department', 'stage', 'subject_name']

class AllocationSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    hall_name = serializers.CharField(source='exam_session.hall.name', read_only=True)
    time_slot = serializers.CharField(source='exam_session.time_range', read_only=True)
    
    class Meta:
        model = Allocation
        fields = ['id', 'student_email', 'hall_name', 'time_slot', 'seat']

class ExamSessionSerializer(serializers.ModelSerializer):
    hall_name = serializers.CharField(source='hall.name', read_only=True)
    cohorts_list = ExamCohortSerializer(source='cohorts', many=True, read_only=True)
    allocated_count = serializers.SerializerMethodField()
    waiting_list_count = serializers.SerializerMethodField()
    empty_seats = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = [
            'id', 'title', 'hall', 'hall_name', 
            'time_range', 'is_allocated', 'cohorts_list',
            'allocated_count', 'waiting_list_count', 'empty_seats'
        ]

    def get_allocated_count(self, obj):
        return obj.allocations.count()

    def get_empty_seats(self, obj):
        # Calculates truly available chairs by ignoring hallways
        functional_seats = obj.hall.seats.filter(seat_type='active', is_active=True).count()
        return functional_seats - obj.allocations.count()

    def get_waiting_list_count(self, obj):
        """
        Calculates the real waitlist using exact matching to prevent 
        crossover students from inflating numbers.
        """
        if not obj.is_allocated:
            return 0
        
        busy_ids = Allocation.objects.filter(
            exam_session__time_range=obj.time_range
        ).values_list('student_id', flat=True)
        
        cohort_q = Q()
        for c in obj.cohorts.all():
            # FIX: Removed subject_name from the query since StudentEnrollment no longer has it
            cohort_q |= Q(department=c.department, stage=c.stage)
            
        enrolled_ids = []
        if cohort_q:
            enrolled_ids = StudentEnrollment.objects.filter(cohort_q).values_list('student_id', flat=True)

        cohort_students = User.objects.filter(
            models.Q(id__in=enrolled_ids, role='student') |
            models.Q(id__in=obj.retake_students.values('id'), role='student')
        ).distinct()
        
        return cohort_students.exclude(id__in=busy_ids).count()

class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = ['id', 'row_index', 'col_index', 'is_active', 'seat_type']

class HallSerializer(serializers.ModelSerializer):
    capacity = serializers.SerializerMethodField()
    # FIX: Nested serialization prevents the white screen when clicking 'Manage Seats'
    seats = SeatSerializer(many=True, read_only=True) 

    class Meta:
        model = Hall
        fields = ['id', 'name', 'rows', 'cols', 'capacity', 'seats']

    def get_capacity(self, obj):
        # Only count actual desks; ignore broken chairs and hallway spaces
        return obj.seats.filter(seat_type='active', is_active=True).count()